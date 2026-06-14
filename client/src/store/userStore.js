import { create } from 'zustand';

const useUserStore = create((set) => ({
  friendStatuses: {},
  // { userId: { isOnline, lastSeen } }

  updateFriendStatus: ({ userId, isOnline, lastSeen }) => {
    if (!userId) return;
    set((state) => ({
      friendStatuses: {
        ...state.friendStatuses,
        [userId]: { 
          isOnline, 
          lastSeen: lastSeen ? new Date(lastSeen) : null 
        },
      },
    }));
  },
}));

export default useUserStore;
