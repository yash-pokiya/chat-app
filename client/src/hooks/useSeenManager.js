import { useEffect, useRef, useCallback } from 'react';

const useSeenManager = ({
  socket,
  conversationId,
  messages,
  currentUser,
  otherUserId,
  setMessages,  // pass setter so hook can update status
}) => {
  const seenMessageIds = useRef(new Set());

  //────────────────────────────────────────
  // Tell server this chat is now open:
  //────────────────────────────────────────
  useEffect(() => {
    const currentId = currentUser?._id || currentUser?.id;
    if (!socket || !conversationId || !currentId) return;

    // Opened chat:
    socket.emit('chat:open', {
      userId: currentId,
      conversationId,
    });
    console.log('👁️ chat:open emitted:', conversationId);

    return () => {
      // Closed chat (unmount / navigate away):
      socket.emit('chat:close', { userId: currentId });
      console.log('👁️ chat:close emitted');
    };
  }, [socket, conversationId, currentUser]);

  //────────────────────────────────────────
  // Mark visible messages as seen:
  //────────────────────────────────────────
  const markMessagesAsSeen = useCallback(() => {
    const currentId = currentUser?._id || currentUser?.id;
    if (!socket || !messages?.length || !currentId || !otherUserId) return;

    // Find messages from other user that aren't seen yet:
    const unseenIds = messages
      .filter((m) => {
        const senderId = m.senderId?._id || m.senderId;
        const fromOtherUser = senderId?.toString() === otherUserId.toString();
        const notSeen = m.status !== 'seen' && m.status !== 'read';
        const notTracked = !seenMessageIds.current.has(m._id);
        return fromOtherUser && notSeen && notTracked;
      })
      .map((m) => m._id);

    if (unseenIds.length === 0) return;

    // Track them locally to avoid duplicate emits:
    unseenIds.forEach((id) => seenMessageIds.current.add(id));

    console.log(`👁️ Marking ${unseenIds.length} as seen`);

    socket.emit('messages:seen', {
      conversationId,
      messageIds: unseenIds,
      seenBy: currentId,
      senderId: otherUserId,
    });
  }, [socket, messages, conversationId, currentUser, otherUserId]);

  // Mark seen when:
  // 1. New messages arrive
  // 2. Tab becomes visible
  // 3. Chat first opens
  useEffect(() => {
    if (document.visibilityState === 'visible') {
      markMessagesAsSeen();
    }
  }, [messages, markMessagesAsSeen]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        markMessagesAsSeen();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [markMessagesAsSeen]);

  //────────────────────────────────────────
  // Update message status in UI when seen:
  //────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleSeenConfirmed = ({ conversationId: cId, messageIds, seenAt }) => {
      if (cId !== conversationId) return;
      console.log(`✅ Seen confirmed for ${messageIds.length} msgs`);

      // Update message statuses in parent component:
      setMessages((prev) =>
        prev.map((m) =>
          messageIds.includes(m._id) ? { ...m, status: 'seen', seenAt } : m
        )
      );
    };

    socket.on('messages:seen:confirmed', handleSeenConfirmed);

    return () => {
      socket.off('messages:seen:confirmed', handleSeenConfirmed);
    };
  }, [socket, conversationId, setMessages]);
};

export default useSeenManager;
