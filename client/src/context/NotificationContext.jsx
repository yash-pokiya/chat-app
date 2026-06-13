import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user, setUser } = useAuth();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Load initial pending requests
  useEffect(() => {
    if (!user) return;
    api.get('/friends/requests').then(({ data }) => {
      if (data.success) setPendingRequests(data.requests);
    }).catch(() => {});
  }, [user]);

  // Socket listeners for real-time notifications
  useEffect(() => {
    if (!socket || !user) return;

    const onFriendRequest = ({ from }) => {
      setPendingRequests((prev) => {
        const exists = prev.some((r) => r._id === from.id || r.id === from.id);
        if (exists) return prev;
        return [{ _id: from.id, ...from }, ...prev];
      });
      addNotification({
        type: 'friend_request',
        message: `@${from.username} sent you a friend request`,
        from,
      });
      toast(`👋 @${from.username} wants to be your friend!`, {
        icon: '🤝',
        duration: 5000,
      });
    };

    const onFriendAccepted = ({ by }) => {
      addNotification({
        type: 'friend_accepted',
        message: `@${by.username} accepted your friend request`,
        from: by,
      });
      toast.success(`🎉 @${by.username} accepted your friend request!`);
      // Update user's friends list
      setUser((prev) => prev ? { ...prev, friends: [...(prev.friends || []), by] } : prev);
    };

    const onFriendDeclined = ({ byUserId }) => {
      // Remove from sentRequests if we track them
      toast(`A friend request was declined`, { icon: '😔', duration: 3000 });
    };

    const onFriendRemoved = ({ byUserId }) => {
      // Remove from local friends list
      setUser((prev) => prev ? {
        ...prev,
        friends: (prev.friends || []).filter((f) => (f._id || f.id || f) !== byUserId),
      } : prev);
      toast('A friend removed you from their list', { icon: '💔', duration: 3000 });
    };

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

    socket.on('friend:request:received', onFriendRequest);
    socket.on('friend:accepted', onFriendAccepted);
    socket.on('friend:declined', onFriendDeclined);
    socket.on('friend:removed', onFriendRemoved);
    socket.on('follow:received', onFollowReceived);
    socket.on('follow:removed', onFollowRemoved);
    socket.on('friend:online', onFriendOnline);
    socket.on('friend:offline', onFriendOffline);
    socket.on('dm:notification', onDMNotification);

    return () => {
      socket.off('friend:request:received', onFriendRequest);
      socket.off('friend:accepted', onFriendAccepted);
      socket.off('friend:declined', onFriendDeclined);
      socket.off('friend:removed', onFriendRemoved);
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
    setPendingRequests((prev) => prev.filter((r) => (r._id || r.id) !== userId));
  }, []);

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
