import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './hooks/useAuth';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (token) {
      const newSocket = io(window.location.origin, {
        auth: { token },
        transports: ['websocket', 'polling'], // Allow both for better local performance
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on('connect', () => {
        console.log('Socket link established: Neural node synced');
        setConnected(true);
      });

      newSocket.on('connect_error', (err) => {
        console.warn('Socket link failure (expected during handshake):', err.message);
        setConnected(false);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket link severed:', reason);
        setConnected(false);
        if (reason === 'io server disconnect') {
          // the disconnection was initiated by the server, you need to reconnect manually
          newSocket.connect();
        }
      });

      setSocket(newSocket);

      return () => {
        if (newSocket) {
          newSocket.removeAllListeners();
          newSocket.disconnect();
        }
      };
    } else {
      setSocket(null);
      setConnected(false);
    }
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
