import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import useFriendStore from '../store/friendStore';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user, setUser } = useAuth();
  const { pendingRequests, setPendingRequests, removePendingRequest } = useFriendStore();
  const [notifications, setNotifications] = useState([]);

  // Load initial pending requests
  useEffect(() => {
    if (!user) return;
    api.get('/friends/requests').then(({ data }) => {
      if (data.success) setPendingRequests(data.requests || []);
    }).catch(() => {});
  }, [user, setPendingRequests]);

  // Socket listeners for real-time notifications
  useEffect(() => {
    if (!socket || !user) return;

    const onFollowReceived = ({ from }) => {
      addNotification({
        type: 'follow',
        message: `@${from.username} started following you`,
        from,
      });
      toast(`❤️ @${from.username} started following you!`, { duration: 4000 });
    };

    const onFollowRemoved = ({ byUserId }) => {
      // Silent — no toast needed for unfollows
    };

    const onFriendOnline = ({ userId, username }) => {
      // Silently update online status
    };

    const onFriendOffline = ({ userId }) => {
      // Silently update offline status
    };

    const onDMNotification = ({ dmId, message, from }) => {
      addNotification({
        type: 'dm',
        message: `@${from.username}: ${message.content?.slice(0, 50) || 'Sent a message'}`,
        dmId,
        from,
      });
    };

    socket.on('follow:received', onFollowReceived);
    socket.on('follow:removed', onFollowRemoved);
    socket.on('friend:online', onFriendOnline);
    socket.on('friend:offline', onFriendOffline);
    socket.on('dm:notification', onDMNotification);

    return () => {
      socket.off('follow:received', onFollowReceived);
      socket.off('follow:removed', onFollowRemoved);
      socket.off('friend:online', onFriendOnline);
      socket.off('friend:offline', onFriendOffline);
      socket.off('dm:notification', onDMNotification);
    };
  }, [socket, user]);

  const addNotification = useCallback((notif) => {
    setNotifications((prev) => [{ id: Date.now(), ...notif }, ...prev].slice(0, 50));
  }, []);

  const clearNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const removeFromPending = useCallback((userId) => {
    removePendingRequest(userId);
  }, [removePendingRequest]);

  return (
    <NotificationContext.Provider value={{
      pendingRequests, setPendingRequests,
      notifications, addNotification, clearNotification,
      removeFromPending,
      pendingCount: pendingRequests.length,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
