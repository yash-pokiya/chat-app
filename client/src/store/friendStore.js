import { create } from 'zustand';

const useFriendStore = create((set) => ({
  friends: [],
  pendingRequests: [], // received requests
  sentRequests: [], // sent requests

  // Initial load from API (supports functional updates):
  setFriends: (f) => set((state) => ({
    friends: typeof f === 'function' ? f(state.friends) : f
  })),
  setPendingRequests: (r) => set((state) => ({
    pendingRequests: typeof r === 'function' ? r(state.pendingRequests) : r
  })),
  setSentRequests: (r) => set((state) => ({
    sentRequests: typeof r === 'function' ? r(state.sentRequests) : r
  })),

  // Real-time updates:
  addFriend: (user) => set((state) => {
    const userId = user._id || user.id;
    const exists = state.friends.some((f) => (f._id || f.id) === userId);
    return {
      friends: exists ? state.friends : [...state.friends, user],
    };
  }),

  removeFriend: (userId) => set((state) => ({
    friends: state.friends.filter((f) => (f._id || f.id) !== userId),
  })),

  addPendingRequest: (user) => set((state) => {
    const userId = user._id || user.id;
    const exists = state.pendingRequests.some((r) => (r._id || r.id) === userId);
    return {
      pendingRequests: exists ? state.pendingRequests : [...state.pendingRequests, user],
    };
  }),

  removePendingRequest: (userId) => set((state) => ({
    pendingRequests: state.pendingRequests.filter((r) => (r._id || r.id) !== userId),
  })),

  addSentRequest: (user) => set((state) => {
    const userId = user._id || user.id;
    const exists = state.sentRequests.some((r) => (r._id || r.id) === userId);
    return {
      sentRequests: exists ? state.sentRequests : [...state.sentRequests, user],
    };
  }),

  removeSentRequest: (userId) => set((state) => ({
    sentRequests: state.sentRequests.filter((r) => (r._id || r.id) !== userId),
  })),
}));

export default useFriendStore;
