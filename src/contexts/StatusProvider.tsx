import React, { createContext, useEffect, useRef, useState } from 'react';
import { knezClient } from '../services/KnezClient';
import { KnezHealthResponse, CognitiveState } from '../domain/DataContracts';

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
  const isConnected = online && !!health && health.status === "ok";
  const isDegraded = online && !!health && health.status !== "ok";

  const timeoutRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const healthRef = useRef<KnezHealthResponse | null>(null);

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
      const delay = current && current.status === "ok" ? 3000 : 1500;
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
