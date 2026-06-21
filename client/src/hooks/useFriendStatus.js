import { useEffect } from 'react';
import useUserStore from '../store/userStore';

const useFriendStatus = ({ socket }) => {
  const { updateFriendStatus } = useUserStore();

  useEffect(() => {
    if (!socket) return;

    const handleStatusChange = ({ userId, isOnline, lastSeen }) => {
      console.log(`👤 Friend status update: ${userId}, isOnline: ${isOnline}`);
      updateFriendStatus({ userId, isOnline, lastSeen });
    };

    const handleSync = ({ statuses }) => {
      console.log('🔄 Syncing friend statuses:', statuses.length);
      statuses.forEach(({ userId, isOnline, lastSeen }) => {
        updateFriendStatus({ userId, isOnline, lastSeen });
      });
    };

    socket.on('friend:status', handleStatusChange);
    socket.on('friends:status:sync', handleSync);

    return () => {
      socket.off('friend:status', handleStatusChange);
      socket.off('friends:status:sync', handleSync);
    };
  }, [socket, updateFriendStatus]);
};

export default useFriendStatus;
