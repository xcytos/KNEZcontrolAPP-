import React, { createContext, useEffect, useRef, useState } from 'react';
import { knezClient } from '../services/KnezClient';
import { KnezHealthResponse, CognitiveState } from '../domain/DataContracts';
import { isOverallHealthyStatus } from '../utils/health';

interface StatusContextValue {
  online: boolean;
  isConnected: boolean;
  isDegraded: boolean;
  lastCheck: number | null;
  health: KnezHealthResponse | null;
  healthFresh: boolean;
  cognitiveState: CognitiveState | null;
  forceCheck: () => Promise<void>;
}

export const StatusContext = createContext<StatusContextValue | null>(null);

export const StatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [health, setHealth] = useState<KnezHealthResponse | null>(null);
  const [healthFresh, setHealthFresh] = useState(false);
  const [online, setOnline] = useState(false);
  const [cognitiveState, setCognitiveState] = useState<CognitiveState | null>(null);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  
  // Derived state
  const isConnected = online && !!health && isOverallHealthyStatus(health.status);
  const isDegraded = online && !!health && !isOverallHealthyStatus(health.status);

  const timeoutRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const healthRef = useRef<KnezHealthResponse | null>(null);
  const unhealthyCountRef = useRef(0);

  const performCheck = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const now = Date.now();

    try {
      const [h, c] = await Promise.allSettled([
        knezClient.health(),
        knezClient.getCognitiveState()
      ]);

      if (h.status === "fulfilled") {
        setHealth(h.value);
        setHealthFresh(true);
        setOnline(true);
      } else {
        setHealthFresh(false);
        setOnline(false);
      }

      if (c.status === "fulfilled") {
        setCognitiveState(c.value);
      } else {
        setCognitiveState(null);
      }
      
      setLastCheck(now);
    } catch (e) {
      setHealthFresh(false);
      setOnline(false);
      setCognitiveState(null);
      setLastCheck(now);
    } finally {
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    healthRef.current = health;
  }, [health]);

  useEffect(() => {
    const scheduleNext = async () => {
      await performCheck();
      const current = healthRef.current;
      const isOk = !!current && current.status === "ok";
      unhealthyCountRef.current = isOk ? 0 : Math.min(10, unhealthyCountRef.current + 1);
      const baseDelay = isOk ? 30000 : Math.min(60000, 2500 * Math.pow(2, unhealthyCountRef.current));
      const hiddenPenalty = typeof document !== "undefined" && document.hidden ? 180000 : 0;
      const jitter = Math.floor(Math.random() * 500);
      const delay = Math.max(5000, baseDelay + hiddenPenalty + jitter);
      timeoutRef.current = window.setTimeout(scheduleNext, delay);
    };

    scheduleNext();

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return (
    <StatusContext.Provider value={{ 
      online,
      isConnected, 
      isDegraded, 
      lastCheck, 
      health, 
      healthFresh,
      cognitiveState,
      forceCheck: performCheck 
    }}>
      {children}
    </StatusContext.Provider>
  );
};
