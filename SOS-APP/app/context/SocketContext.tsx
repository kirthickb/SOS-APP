import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import socketService, { SOSCallback } from '../services/socket';
import { useAuth } from './AuthContext';

interface SocketContextType {
  isConnected: boolean;
  subscribeToSOS: (callback: SOSCallback) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      // Connect to WebSocket when user is authenticated
      connectSocket();
    } else {
      // Disconnect when user logs out
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated]);

  const connectSocket = async () => {
    try {
      await socketService.connect();
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setIsConnected(false);
      
      // Retry connection after 5 seconds
      setTimeout(() => {
        if (isAuthenticated) {
          connectSocket();
        }
      }, 5000);
    }
  };

  const disconnectSocket = () => {
    socketService.disconnect();
    setIsConnected(false);
  };

  const subscribeToSOS = (callback: SOSCallback): (() => void) => {
    return socketService.subscribeToSOS(callback);
  };

  return (
    <SocketContext.Provider value={{ isConnected, subscribeToSOS }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
