import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { knezClient } from '../services/KnezClient';
import { KnezHealthResponse, CognitiveState } from '../domain/DataContracts';

interface StatusContextValue {
  isConnected: boolean;
  isDegraded: boolean;
  lastCheck: number | null;
  health: KnezHealthResponse | null;
  cognitiveState: CognitiveState | null;
  forceCheck: () => Promise<void>;
}

const StatusContext = createContext<StatusContextValue | null>(null);

export const StatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [health, setHealth] = useState<KnezHealthResponse | null>(null);
  const [cognitiveState, setCognitiveState] = useState<CognitiveState | null>(null);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  
  // Derived state
  const isConnected = !!health && health.status === "ok";
  const isDegraded = !!health && health.status !== "ok";

  const checkRef = useRef<number>(0);

  const performCheck = async () => {
    const now = Date.now();
    // Debounce checks (max 1 per second)
    if (now - checkRef.current < 1000) return;
    checkRef.current = now;

    try {
      const [h, c] = await Promise.allSettled([
        knezClient.health(),
        knezClient.getCognitiveState()
      ]);

      if (h.status === "fulfilled") {
        setHealth(h.value);
      } else {
        setHealth(null);
      }

      if (c.status === "fulfilled") {
        setCognitiveState(c.value);
      } else {
        setCognitiveState(null);
      }
      
      setLastCheck(now);
    } catch (e) {
      setHealth(null);
      setCognitiveState(null);
    }
  };

  useEffect(() => {
    // Initial check
    performCheck();
    
    // Poll every 3 seconds
    const interval = setInterval(performCheck, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <StatusContext.Provider value={{ 
      isConnected, 
      isDegraded, 
      lastCheck, 
      health, 
      cognitiveState,
      forceCheck: performCheck 
    }}>
      {children}
    </StatusContext.Provider>
  );
};

export const useStatus = () => {
  const ctx = useContext(StatusContext);
  if (!ctx) throw new Error("useStatus must be used within StatusProvider");
  return ctx;
};
