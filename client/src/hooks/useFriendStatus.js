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

    socket.on('friend:status', handleStatusChange);

    return () => {
      socket.off('friend:status', handleStatusChange);
    };
  }, [socket, updateFriendStatus]);
};

export default useFriendStatus;
