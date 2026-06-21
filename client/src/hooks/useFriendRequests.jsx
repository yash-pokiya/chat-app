import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import useFriendStore from '../store/friendStore';
import api from '../utils/api';
import FriendRequestToast from '../components/FriendRequestToast';

const useFriendRequests = ({ socket, currentUser }) => {
  const {
    pendingRequests,
    addPendingRequest,
    removePendingRequest,
    addFriend,
    removeFriend,
    removeSentRequest,
  } = useFriendStore();

  const activeToasts = useRef({});

  const handleAccept = async (fromUser) => {
    const fromUserId = fromUser._id || fromUser.id;
    if (activeToasts.current[fromUserId]) {
      toast.dismiss(activeToasts.current[fromUserId]);
      delete activeToasts.current[fromUserId];
    }
    try {
      // 1. API call:
      await api.post(`/friends/accept/${fromUserId}`);

      // 2. Update own UI instantly:
      addFriend(fromUser);
      removePendingRequest(fromUserId);

      // 3. Notify sender via socket INSTANTLY:
      socket?.emit('friend:request:accept', {
        fromUserId: currentUser._id || currentUser.id,
        toUserId: fromUserId,
        acceptingUser: {
          _id: currentUser._id || currentUser.id,
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatar: currentUser.avatar,
        },
      });

      toast.success(`You are now friends with @${fromUser.username}!`, { duration: 3500 });
    } catch (err) {
      console.error('Accept error:', err);
      toast.error('Failed to accept request', { duration: 3500 });
    }
  };

  const handleDecline = async (fromUser) => {
    const fromUserId = fromUser._id || fromUser.id;
    if (activeToasts.current[fromUserId]) {
      toast.dismiss(activeToasts.current[fromUserId]);
      delete activeToasts.current[fromUserId];
    }
    try {
      await api.delete(`/friends/decline/${fromUserId}`);
      removePendingRequest(fromUserId);

      socket?.emit('friend:request:decline', {
        fromUserId: currentUser._id || currentUser.id,
        toUserId: fromUserId,
      });
      toast.success('Friend request declined.', { duration: 3500 });
    } catch (err) {
      console.error('Decline error:', err);
    }
  };

  useEffect(() => {
    // If a request is no longer in pendingRequests, dismiss its toast:
    Object.keys(activeToasts.current).forEach((userId) => {
      const isStillPending = pendingRequests.some((r) => (r._id || r.id)?.toString() === userId);
      if (!isStillPending) {
        toast.dismiss(activeToasts.current[userId]);
        delete activeToasts.current[userId];
      }
    });
  }, [pendingRequests]);

  useEffect(() => {
    if (!socket || !currentUser) return;

    //──────────────────────────────────────
    // RECEIVE FRIEND REQUEST (real-time)
    //──────────────────────────────────────
    const onFriendRequestReceived = ({ fromUser }) => {
      console.log('📨 Friend request from:', fromUser.username);

      // ✅ Add to pending list in global store INSTANTLY:
      addPendingRequest(fromUser);

      // ✅ Dismiss any existing toast for this user first:
      const targetUserId = (fromUser._id || fromUser.id)?.toString();
      if (activeToasts.current[targetUserId]) {
        toast.dismiss(activeToasts.current[targetUserId]);
      }

      // ✅ Show notification banner (works on ANY page):
      const toastId = toast.custom(
        (t) => (
          <FriendRequestToast
            fromUser={fromUser}
            duration={8000}
            onAccept={() => {
              toast.dismiss(t.id);
              handleAccept(fromUser);
            }}
            onDecline={() => {
              toast.dismiss(t.id);
              handleDecline(fromUser);
            }}
          />
        ),
        {
          duration: 8000,
          position: window.innerWidth < 640 ? 'top-center' : 'top-right',
          id: `friend-req-${targetUserId}`,
        }
      );
      activeToasts.current[targetUserId] = toastId;
    };

    //──────────────────────────────────────
    // FRIEND REQUEST ACCEPTED (real-time)
    //──────────────────────────────────────
    const onFriendRequestAccepted = ({ acceptedBy }) => {
      console.log('✅ Request accepted by:', acceptedBy.username);

      // ✅ Add to friends list in global store INSTANTLY:
      addFriend(acceptedBy);

      // ✅ Remove from sent requests INSTANTLY:
      removeSentRequest(acceptedBy._id || acceptedBy.id);

      // ✅ Show success notification on ANY page:
      toast.custom(
        (t) => (
          <div
            onClick={() => toast.dismiss(t.id)}
            className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-green-200 dark:border-green-900/60 rounded-2xl px-4 py-3 shadow-lg cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-green-100 dark:bg-green-950 flex-shrink-0">
              {acceptedBy.avatar ? (
                <img src={acceptedBy.avatar} className="w-full h-full object-cover" alt={acceptedBy.username} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-green-500 font-bold">
                  {acceptedBy.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                @{acceptedBy.username} accepted your request! 🎉
              </p>
              <p className="text-xs text-gray-400 mt-0.5">You are now friends</p>
            </div>
          </div>
        ),
        { duration: 5000, position: 'top-right' }
      );
    };

    //──────────────────────────────────────
    // FRIEND REQUEST DECLINED
    //──────────────────────────────────────
    const onFriendRequestDeclined = ({ byUserId }) => {
      removeSentRequest(byUserId);
    };

    //──────────────────────────────────────
    // UNFRIENDED
    //──────────────────────────────────────
    const onFriendRemoved = ({ byUserId }) => {
      removeFriend(byUserId);
    };

    socket.on('friend:request:received', onFriendRequestReceived);
    socket.on('friend:request:accepted', onFriendRequestAccepted);
    socket.on('friend:request:declined', onFriendRequestDeclined);
    socket.on('friend:removed', onFriendRemoved);

    return () => {
      socket.off('friend:request:received', onFriendRequestReceived);
      socket.off('friend:request:accepted', onFriendRequestAccepted);
      socket.off('friend:request:declined', onFriendRequestDeclined);
      socket.off('friend:removed', onFriendRemoved);
    };
  }, [socket, currentUser, addPendingRequest, addFriend, removeSentRequest, removeFriend]);

  return { handleAccept, handleDecline };
};

export default useFriendRequests;
