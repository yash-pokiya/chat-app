import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import api from '../utils/api';
import useUserStore from '../store/userStore';
import useFriendStore from '../store/friendStore';

const ConversationContext = createContext(null);

/**
 * ConversationProvider — global store for the DM / friends list.
 *
 * Fetches once on mount, then stays in sync via socket events:
 *   • dm:notification   → other user sent YOU a message (updates preview + bumps unread)
 *   • friend:accepted   → new friend added to list
 *   • friend:removed    → friend removed from list
 */
export const ConversationProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { friends, setFriends, removeFriend } = useFriendStore();
  const [loading, setLoading] = useState(true);

  // ── Fetch friends list on login ──────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setFriends([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get('/friends/list')
      .then(({ data }) => {
        if (data.success) {
          setFriends(data.friends);
          data.friends.forEach((f) => {
            useUserStore.getState().updateFriendStatus({
              userId: f.id,
              isOnline: f.isOnline,
              lastSeen: f.lastSeen,
            });
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  // ── Sort helper (most-recent first) ──────────────────────────────────
  const sortByRecent = (list) =>
    [...list].sort((a, b) => {
      const ta = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;
      const tb = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;
      return tb - ta;
    });

  // ── Update last message for a specific conversation ──────────────────
  const updateLastMessage = useCallback(
    ({ dmId, friendId, message, incrementUnread = false }) => {
      setFriends((prev) => {
        const updated = prev.map((f) => {
          const match =
            (dmId && f.dmId?.toString() === dmId?.toString()) ||
            (friendId && f.id?.toString() === friendId?.toString());
          if (!match) return f;

          const content =
            message.type === 'image'
              ? '📷 Photo'
              : message.type === 'audio'
                ? '🎵 Voice message'
                : message.type === 'sketch'
                  ? '✏️ Sketch'
                  : message.type === 'location'
                    ? '📍 Location'
                    : message.content || '';

          return {
            ...f,
            dmId: dmId || f.dmId,
            lastMessage: {
              content: content.slice(0, 60),
              type: message.type || 'text',
              status: message.status || 'sent',
              createdAt: message.createdAt || new Date().toISOString(),
              senderId:
                message.senderId?._id || message.senderId || friendId,
            },
            unreadCount: incrementUnread
              ? (f.unreadCount || 0) + 1
              : f.unreadCount,
          };
        });
        return sortByRecent(updated);
      });
    },
    []
  );

  // ── Mark a conversation as read (clear badge) ────────────────────────
  const markAsRead = useCallback((dmId) => {
    setFriends((prev) =>
      prev.map((f) =>
        f.dmId?.toString() === dmId?.toString()
          ? { ...f, unreadCount: 0 }
          : f
      )
    );
  }, []);

  // ── Re-fetch from server (after accepting friend request, etc.) ──────
  const refreshFriends = useCallback(async () => {
    try {
      const { data } = await api.get('/friends/list');
      if (data.success) {
        setFriends(data.friends);
        data.friends.forEach((f) => {
          useUserStore.getState().updateFriendStatus({
            userId: f.id,
            isOnline: f.isOnline,
            lastSeen: f.lastSeen,
          });
        });
      }
    } catch {}
  }, []);

  // ── Socket listeners — update list in real time ──────────────────────
  useEffect(() => {
    if (!socket || !user) return;

    // When the OTHER user sends us a message while we're NOT in that DM:
    const onDMNotification = ({ dmId, message, from }) => {
      updateLastMessage({
        dmId,
        friendId: from.id,
        message,
        incrementUnread: true,
      });
    };

    // When a friend is accepted, refresh to pick up the new entry:
    const onFriendAccepted = () => refreshFriends();
    const onFriendRemoved = ({ byUserId }) => {
      removeFriend(byUserId);
    };

    // When messages status updates (e.g., delivered)
    const onMessagesStatusUpdate = ({ dmId, messageIds, status }) => {
      setFriends((prev) =>
        prev.map((f) => {
          if (f.dmId?.toString() === dmId?.toString() && f.lastMessage) {
            const myId = user?.id || user?._id;
            const isSentByMe = f.lastMessage.senderId?.toString() === myId?.toString();
            if (isSentByMe) {
              return {
                ...f,
                lastMessage: {
                  ...f.lastMessage,
                  status: status,
                },
              };
            }
          }
          return f;
        })
      );
    };

    // When partner has seen the messages
    const onMessagesSeenConfirmed = ({ conversationId, messageIds, seenAt }) => {
      setFriends((prev) =>
        prev.map((f) => {
          if (f.dmId?.toString() === conversationId?.toString() && f.lastMessage) {
            const myId = user?.id || user?._id;
            const isSentByMe = f.lastMessage.senderId?.toString() === myId?.toString();
            if (isSentByMe) {
              return {
                ...f,
                lastMessage: {
                  ...f.lastMessage,
                  status: 'seen',
                },
              };
            }
          }
          return f;
        })
      );
    };

    socket.on('dm:notification', onDMNotification);
    socket.on('friend:request:accepted', onFriendAccepted);
    socket.on('friend:removed', onFriendRemoved);
    socket.on('messages:status:update', onMessagesStatusUpdate);
    socket.on('messages:seen:confirmed', onMessagesSeenConfirmed);

    return () => {
      socket.off('dm:notification', onDMNotification);
      socket.off('friend:request:accepted', onFriendAccepted);
      socket.off('friend:removed', onFriendRemoved);
      socket.off('messages:status:update', onMessagesStatusUpdate);
      socket.off('messages:seen:confirmed', onMessagesSeenConfirmed);
    };
  }, [socket, user, updateLastMessage, refreshFriends, setFriends]);

  return (
    <ConversationContext.Provider
      value={{
        friends,
        setFriends,
        loading,
        updateLastMessage,
        markAsRead,
        refreshFriends,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversations = () => {
  const context = useContext(ConversationContext);
  if (!context)
    throw new Error(
      'useConversations must be used within ConversationProvider'
    );
  return context;
};
