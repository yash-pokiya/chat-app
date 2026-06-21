import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('token');

    // Connect to the backend
    const socketUrl = import.meta.env.VITE_BACKEND_URL || '/';
    const socketInstance = io(socketUrl, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    setSocket(socketInstance);

    const userId = user._id || user.id;

    const registerOnline = () => {
      if (userId) {
        socketInstance.emit('user:online', { userId });
        console.log('🟢 [Socket] Registered online:', socketInstance.id);
      }
    };

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected:', socketInstance.id);
      setConnected(true);
      registerOnline();
    });

    socketInstance.on('reconnect', () => {
      console.log('🔄 [Socket] Reconnected, re-registering...');
      registerOnline();
    });

    socketInstance.io.on('reconnect_attempt', () => {
      console.log('🔄 [Socket] Attempting reconnect...');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setConnected(false);
    });

    return () => {
      socketInstance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};
