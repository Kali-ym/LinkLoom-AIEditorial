import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  clearConnection,
  CONSOLE_UNAUTHORIZED_EVENT,
  readConnection,
  writeConnection,
  type ConsoleConnection,
} from '../domain/connection/consoleConnection';

export type ConnectionHealth = 'unknown' | 'checking' | 'connected' | 'disconnected';

interface AuthContextType {
  connection: ConsoleConnection | null;
  isAuthenticated: boolean;
  health: ConnectionHealth;
  lastHeartbeatAt: string | null;
  connect: (connection: ConsoleConnection) => void;
  disconnect: () => void;
  setHealth: (health: ConnectionHealth, heartbeatAt?: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connection, setConnection] = useState<ConsoleConnection | null>(() => readConnection());
  const [health, setHealthState] = useState<ConnectionHealth>(() =>
    readConnection() ? 'unknown' : 'disconnected',
  );
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);

  const connect = useCallback((next: ConsoleConnection) => {
    writeConnection(next);
    setConnection(next);
    setHealthState('connected');
    setLastHeartbeatAt(new Date().toISOString());
  }, []);

  const disconnect = useCallback(() => {
    clearConnection();
    setConnection(null);
    setHealthState('disconnected');
    setLastHeartbeatAt(null);
  }, []);

  const setHealth = useCallback((next: ConnectionHealth, heartbeatAt?: string | null) => {
    setHealthState(next);
    if (heartbeatAt !== undefined) {
      setLastHeartbeatAt(heartbeatAt);
    } else if (next === 'connected') {
      setLastHeartbeatAt(new Date().toISOString());
    }
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      disconnect();
    };
    window.addEventListener(CONSOLE_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(CONSOLE_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [disconnect]);

  const value = useMemo(
    () => ({
      connection,
      isAuthenticated: Boolean(connection),
      health,
      lastHeartbeatAt,
      connect,
      disconnect,
      setHealth,
    }),
    [connection, health, lastHeartbeatAt, connect, disconnect, setHealth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
