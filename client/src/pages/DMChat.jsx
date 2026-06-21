import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext';
import { useConversations } from '../context/ConversationContext';
import { useLocation } from '../hooks/useLocation';
import ReactionBar from '../components/ReactionBar';
import SwipeableMessage from '../components/SwipeableMessage';
import BackgroundPicker from '../components/BackgroundPicker';
import ChatBackgroundView from '../components/ChatBackgroundView';
import {
  ArrowLeft, Send, Image, MapPin, Video, Phone, FileText, Timer,
  Pencil, Smile, MoreVertical, Pin, Reply, Copy, Trash2, Mic, Plus, Palette
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import IncomingCall from '../components/IncomingCall';
import PinnedMessage from '../components/PinnedMessage';
import SharedNotepad from '../components/SharedNotepad';
import DrawingCanvas from '../components/DrawingCanvas';
import TimerBubble from '../components/TimerBubble';
import LocationBubble from '../components/LocationBubble';
import ImageMessage from '../components/ImageMessage';
import ImageLightbox from '../components/ImageLightbox';
import { ReplyBar, QuotedMessage } from '../components/ReplyPreview';
import UploadingBubble from '../components/UploadingBubble';
import UnreadDivider from '../components/UnreadDivider';
import useSeenManager from '../hooks/useSeenManager';
import { OnlineDot, StatusText } from '../components/OnlineStatus';
import MessageTicks from '../components/MessageTicks';

// Message formatting parser
const parseFormatting = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~(.*?)~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code class="bg-black/10 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-black/10 rounded-lg p-2 text-xs font-mono overflow-x-auto mt-1 whitespace-pre-wrap">$1</pre>');
};

function Avatar({ user, size = 8, className = '' }) {
  const sizeMap = {
    8: 'w-8 h-8',
    9: 'w-9 h-9',
    10: 'w-10 h-10',
    11: 'w-11 h-11',
    12: 'w-12 h-12',
  };
  const s = sizeMap[size] || 'w-8 h-8';
  if (user?.avatar) return <img src={user.avatar} className={`${s} rounded-xl object-cover flex-shrink-0 ${className}`} alt={user.displayName} />;
  return (
    <div className={`${s} rounded-xl bg-gradient-to-br from-violet-400 to-cyan-400 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${className}`}>
      {(user?.displayName || user?.username || '?')[0].toUpperCase()}
    </div>
  );
}

const PRESET_TINTS = {
  default: {
    bg: 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl',
    border: 'border-gray-100 dark:border-gray-800'
  },
  lavender: {
    bg: 'bg-violet-50/70 dark:bg-violet-950/40 backdrop-blur-xl',
    border: 'border-violet-200/50 dark:border-violet-900/40 shadow-[0_1px_8px_rgba(139,92,246,0.08)]'
  },
  mint: {
    bg: 'bg-emerald-50/70 dark:bg-emerald-950/40 backdrop-blur-xl',
    border: 'border-emerald-200/50 dark:border-emerald-900/40 shadow-[0_1px_8px_rgba(16,185,129,0.08)]'
  },
  peach: {
    bg: 'bg-amber-50/70 dark:bg-orange-950/40 backdrop-blur-xl',
    border: 'border-amber-200/50 dark:border-orange-900/40 shadow-[0_1px_8px_rgba(245,158,11,0.08)]'
  },
  sky: {
    bg: 'bg-sky-50/70 dark:bg-sky-950/40 backdrop-blur-xl',
    border: 'border-sky-200/50 dark:border-sky-900/40 shadow-[0_1px_8px_rgba(14,165,233,0.08)]'
  },
  rose: {
    bg: 'bg-rose-50/70 dark:bg-rose-950/40 backdrop-blur-xl',
    border: 'border-rose-200/50 dark:border-rose-900/40 shadow-[0_1px_8px_rgba(244,63,94,0.08)]'
  },
  dots: {
    bg: 'bg-white/85 dark:bg-gray-900/85 backdrop-blur-xl',
    border: 'border-gray-200/30 dark:border-gray-800/30'
  },
  grid: {
    bg: 'bg-white/85 dark:bg-gray-900/85 backdrop-blur-xl',
    border: 'border-gray-200/30 dark:border-gray-800/30'
  }
};

const CUSTOM_TINT = {
  bg: 'bg-white/60 dark:bg-gray-950/50 backdrop-blur-xl',
  border: 'border-gray-200/20 dark:border-gray-800/20 shadow-lg'
};

export default function DMChat() {
  const { dmId } = useParams();
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();

  const [dm, setDm] = useState(null);
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [activePickerMessageId, setActivePickerMessageId] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [chatBackground, setChatBackground] = useState({ type: 'preset', presetId: 'default' });
  
  const getThemeTint = () => {
    if (!chatBackground) return PRESET_TINTS.default;
    if (chatBackground.type === 'custom') {
      return CUSTOM_TINT;
    }
    const presetId = chatBackground.presetId || 'default';
    return PRESET_TINTS[presetId] || PRESET_TINTS.default;
  };
  const themeTint = getThemeTint();

  const pickerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [showNotepad, setShowNotepad] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showTimerInput, setShowTimerInput] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxSaveFn, setLightboxSaveFn] = useState(null);
  const [timerMinutes, setTimerMinutes] = useState('5');
  const [timerState, setTimerState] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const longPressRef = useRef(null);
  const isFirstLoad = useRef(true);

  const location = useLocation({ socket, dmId });

  const {
    callState,
    initiateCall, formatDuration,
  } = useCall();

  const { updateLastMessage, markAsRead } = useConversations();

  // ✅ Manages seen for this specific conversation:
  useSeenManager({
    socket,
    conversationId: dmId,
    messages,
    currentUser: user,
    otherUserId: partner?.id || partner?._id,
    setMessages,
  });

  // Load DM thread
  useEffect(() => {
    const loadDM = async () => {
      try {
        // Fetch DM info by partner userId first — but we have dmId, so get messages
        const { data: msgData } = await api.get(`/dm/${dmId}/messages`);
        if (!msgData.success) return;
        setMessages(msgData.messages);
        if (msgData.pinnedMessage) {
          setPinnedMessage(msgData.pinnedMessage);
        }
        // Track first unread for scroll positioning:
        if (msgData.firstUnreadId) {
          setFirstUnreadId(msgData.firstUnreadId);
          setUnreadCount(msgData.unreadCount || 0);
        }

        // Use dm participants to find the partner!
        if (msgData.dm && msgData.dm.participants) {
          const otherParticipant = msgData.dm.participants.find(p => p._id.toString() !== user.id);
          if (otherParticipant) {
            setPartner({
              id: otherParticipant._id,
              username: otherParticipant.username,
              displayName: otherParticipant.displayName,
              avatar: otherParticipant.avatar,
              isOnline: otherParticipant.isOnline,
            });
          }
        } else if (msgData.messages.length > 0) {
          const partnerMsg = msgData.messages.find(m => m.senderId?._id?.toString() !== user.id);
          if (partnerMsg && partnerMsg.senderId) {
            const partnerData = partnerMsg.senderId;
            setPartner({
              id: partnerData._id,
              username: partnerData.username,
              displayName: partnerData.displayName,
              avatar: partnerData.avatar,
            });
          }
        }
      } catch (err) {
        toast.error('Failed to load messages.');
      } finally {
        setLoading(false);
      }
    };

    if (dmId && user) loadDM();
  }, [dmId, user]);

  // Also load DM details to get partner info even if no messages
  useEffect(() => {
    if (!dmId) return;
    // We'll parse the partner from the dm participants
    // We'll make a HEAD request or use existing session data
    // For now, get partner from URL query or use /api/profile endpoint
    const params = new URLSearchParams(window.location.search);
    const partnerUsername = params.get('partner');
    if (partnerUsername) {
      api.get(`/profile/${partnerUsername}`).then(({ data }) => {
        if (data.success) {
          setPartner({
            id: data.profile.id,
            username: data.profile.username,
            displayName: data.profile.displayName,
            avatar: data.profile.avatar,
            isOnline: data.profile.isOnline,
          });
        }
      }).catch(() => {});
    }
  }, [dmId]);

  // Join DM socket room + clear unread
  // Re-runs when `connected` toggles (handles reconnection → re-joins room)
  useEffect(() => {
    if (!socket || !dmId || !connected) return;
    socket.emit('dm:join', { dmId });
    // Clear unread badge on home screen instantly:
    markAsRead(dmId);
    // Also clear in backend DB:
    api.put(`/dm/${dmId}/read`).catch(() => {});
  }, [socket, dmId, connected]);
 
  // Fetch current background on chat load
  useEffect(() => {
    if (!dmId) return;
    api.get(`/dm/${dmId}/background`).then(({ data }) => {
      if (data.success) setChatBackground(data.background);
    }).catch(() => {});
  }, [dmId]);

  // Listen for real-time background sync from partner
  useEffect(() => {
    if (!socket) return;
    const onBackgroundUpdated = ({ background }) => {
      setChatBackground(background);
    };
    const onWallpaperUpdate = ({ background }) => {
      setChatBackground(background);
    };
    socket.on('dm:background:updated', onBackgroundUpdated);
    socket.on('wallpaper:update', onWallpaperUpdate);
    return () => {
      socket.off('dm:background:updated', onBackgroundUpdated);
      socket.off('wallpaper:update', onWallpaperUpdate);
    };
  }, [socket]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setActivePickerMessageId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Socket event listeners for incoming messages
  useEffect(() => {
    if (!socket || !dmId) return;

    const onNewMessage = (msg) => {
      // Skip own messages — sender adds them via callback in handleSend
      const senderId = msg.senderId?._id || msg.senderId;
      if (senderId?.toString() === user?.id?.toString()) return;
      setMessages((prev) => [...prev, msg]);
      // Update home screen preview for messages from partner:
      updateLastMessage({ dmId, message: msg });
    };

    const onTyping = ({ userId }) => { if (userId !== user.id) setPartnerTyping(true); };
    const onStopTyping = ({ userId }) => { if (userId !== user.id) setPartnerTyping(false); };

    const onMessageReacted = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, reactions } : m));
      if (reactions && reactions.length > 0) {
        const latest = reactions[reactions.length - 1];
        const newId = Date.now();
        const newItems = [
          { id: `${newId}-1`, messageId, emoji: latest.emoji, offset: -15 },
          { id: `${newId}-2`, messageId, emoji: latest.emoji, offset: 0 },
          { id: `${newId}-3`, messageId, emoji: latest.emoji, offset: 15 },
        ];
        setFloatingEmojis((prev) => [...prev, ...newItems]);
        setTimeout(() => {
          setFloatingEmojis((prev) => prev.filter((item) => !newItems.map(n => n.id).includes(item.id)));
        }, 800);
      }
    };

    const onMessagePinned = ({ message }) => setPinnedMessage(message);
    const onMessageUnpinned = () => setPinnedMessage(null);

    const onMessagesStatusUpdate = ({ messageIds, status }) => {
      setMessages((prev) =>
        prev.map((m) =>
          messageIds.includes(m._id) ? { ...m, status } : m
        )
      );
    };

    // Timer events
    const onTimerStarted = ({ seconds, totalSeconds }) => setTimerState({ seconds, totalSeconds, isRunning: true });
    const onTimerTick = ({ seconds, totalSeconds, isRunning }) => setTimerState({ seconds, totalSeconds, isRunning });
    const onTimerEnded = () => {
      setTimerState(null);
      toast('⏱️ Timer ended!', { icon: '🔔', duration: 5000 });
    };
    const onTimerCancelled = () => setTimerState(null);

    socket.on('dm:new-message', onNewMessage);
    socket.on('user-typing', onTyping);
    socket.on('user-stop-typing', onStopTyping);
    socket.on('message:reacted', onMessageReacted);
    socket.on('messages:status:update', onMessagesStatusUpdate);
    socket.on('message:pinned', onMessagePinned);
    socket.on('message:unpinned', onMessageUnpinned);
    socket.on('timer:started', onTimerStarted);
    socket.on('timer:tick', onTimerTick);
    socket.on('timer:ended', onTimerEnded);
    socket.on('timer:cancelled', onTimerCancelled);

    return () => {
      socket.off('dm:new-message', onNewMessage);
      socket.off('user-typing', onTyping);
      socket.off('user-stop-typing', onStopTyping);
      socket.off('message:reacted', onMessageReacted);
      socket.off('messages:status:update', onMessagesStatusUpdate);
      socket.off('message:pinned', onMessagePinned);
      socket.off('message:unpinned', onMessageUnpinned);
      socket.off('timer:started', onTimerStarted);
      socket.off('timer:tick', onTimerTick);
      socket.off('timer:ended', onTimerEnded);
      socket.off('timer:cancelled', onTimerCancelled);
    };
  }, [socket, dmId, user]);

  // ── Initial scroll: runs ONCE after messages load ──────────────
  useEffect(() => {
    if (!isFirstLoad.current || loading || messages.length === 0) return;
    isFirstLoad.current = false;

    // Small delay to let DOM render before scrolling:
    requestAnimationFrame(() => {
      if (firstUnreadId) {
        // Scroll to the unread divider instantly (no animation):
        const dividerEl = document.getElementById('unread-divider');
        if (dividerEl) {
          dividerEl.scrollIntoView({ behavior: 'instant', block: 'center' });
        } else {
          // Fallback: scroll to the first unread message:
          const msgEl = document.getElementById(`msg-${firstUnreadId}`);
          if (msgEl) msgEl.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      } else {
        // All read → scroll to bottom instantly:
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }
      setInitialScrollDone(true);
    });
  }, [messages, loading, firstUnreadId]);

  // ── New message scroll: runs when a new message arrives AFTER initial load ──
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (!initialScrollDone) return;
    if (messages.length <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length;
      return;
    }
    prevMessageCountRef.current = messages.length;

    const lastMsg = messages[messages.length - 1];
    const lastSenderId = lastMsg?.senderId?._id || lastMsg?.senderId;
    const isMyMessage = lastSenderId?.toString() === user?.id?.toString();

    if (isMyMessage) {
      // Own message → always scroll to bottom smoothly:
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Partner message → only auto-scroll if near bottom:
    const container = containerRef.current;
    if (container) {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 150) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setShowScrollBtn(true);
      }
    }
  }, [messages, initialScrollDone, user]);

  // ── Scroll container handler: hide "new messages" when near bottom ──
  const handleScroll = useCallback(() => {
    if (activePickerMessageId) {
      setActivePickerMessageId(null);
      setAnchorRect(null);
    }
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 100 && showScrollBtn) {
      setShowScrollBtn(false);
    }
  }, [showScrollBtn, activePickerMessageId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBtn(false);
    // Clear unread divider when user scrolls down:
    setFirstUnreadId(null);
    setUnreadCount(0);
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput('');
    setReplyTo(null);
    socket?.emit('stop-typing', { dmId });

    setSending(true);
    try {
      await new Promise((resolve, reject) => {
        socket.emit('dm:send-message', { dmId, content, type: 'text', replyTo: replyTo?._id }, (res) => {
          if (res?.error) reject(new Error(res.error));
          else {
            // Add the sent message to chat IMMEDIATELY from callback:
            if (res.message) {
              setMessages((prev) => [...prev, res.message]);
            }
            // Update home screen preview instantly for sender:
            updateLastMessage({
              dmId,
              friendId: partner?.id,
              message: {
                content,
                type: 'text',
                status: res.message?.status || 'sent',
                createdAt: res.message?.createdAt || new Date().toISOString(),
                senderId: user?.id,
              },
            });
            resolve();
          }
        });
      });
    } catch (err) {
      toast.error(err.message);
      setInput(content);
    } finally { setSending(false); }
  };

  const handleTyping = () => {
    socket?.emit('typing', { dmId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('stop-typing', { dmId });
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleLongPress = (msg, e) => {
    e.preventDefault();
    if (navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch (_) {}
    }
    const messageEl = document.getElementById(`msg-${msg._id}`);
    if (messageEl) {
      setAnchorRect(messageEl.getBoundingClientRect());
    }
    setActivePickerMessageId(msg._id);
  };

  const handlePin = (msg) => {
    socket?.emit('message:pin', { messageId: msg._id, dmId });
  };

  const handleReply = (msg) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  };

  const handleCopy = (msg) => {
    navigator.clipboard.writeText(msg.content || '');
    toast.success('Copied!');
  };

  const handleUnpin = () => {
    socket?.emit('message:unpin', { dmId });
    setPinnedMessage(null);
  };

  const handleReact = (messageId, emoji) => {
    socket?.emit('message:react', {
      messageId,
      emoji,
      userId: user.id,
      dmId,
    });
  };

  const handleImageSend = async (url, cloudinaryId) => {
    socket?.emit('dm:send-message', { dmId, content: url, type: 'image', cloudinaryId }, (res) => {
      // Add sent image to chat immediately:
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
      }
      updateLastMessage({
        dmId,
        friendId: partner?.id,
        message: { content: url, type: 'image', status: res?.message?.status || 'sent', createdAt: res?.message?.createdAt || new Date().toISOString(), senderId: user?.id },
      });
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Only images allowed.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB.'); return; }

    const uploadId = Date.now().toString();
    const previewUrl = URL.createObjectURL(file);

    // 1. Add pending upload bubble INSTANTLY:
    setUploads((prev) => [...prev, {
      id: uploadId,
      preview: previewUrl,
      progress: 0,
      status: 'uploading',
    }]);

    const formData = new FormData();
    formData.append('image', file);
    formData.append('dmId', dmId);

    try {
      // 2. Upload to MERN server with progress tracking:
      const { data } = await api.post('/chat/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            const percent = pct;
            console.log('Upload progress:', percent);
            setUploads((prev) => prev.map((u) =>
              u.id === uploadId ? { ...u, progress: pct } : u
            ));
          }
        }
      });

      if (data.success) {
        // 3. Mark as done:
        setUploads((prev) => prev.map((u) =>
          u.id === uploadId ? { ...u, progress: 100, status: 'done' } : u
        ));

        // Send message
        await handleImageSend(data.url, data.cloudinaryId);

        // 4. Remove upload bubble after 500ms:
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
          URL.revokeObjectURL(previewUrl);
        }, 500);
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploads((prev) => prev.map((u) =>
        u.id === uploadId ? { ...u, status: 'error' } : u
      ));
      toast.error('Upload failed.');
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        URL.revokeObjectURL(previewUrl);
      }, 3000);
    }
  };

  const handleStartTimer = () => {
    const mins = parseInt(timerMinutes, 10);
    if (isNaN(mins) || mins < 1) { toast.error('Enter a valid number of minutes'); return; }
    socket?.emit('timer:start', { dmId, seconds: mins * 60 });
    setShowTimerInput(false);
  };



  const isMine = (msg) => (msg.senderId?._id || msg.senderId) === user?.id || (msg.senderId?._id || msg.senderId)?.toString() === user?.id?.toString();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-50 relative overflow-hidden">
      {/* Sticky Wallpaper Background */}
      <ChatBackgroundView background={chatBackground} />

      {/* Incoming call overlay — handled globally by CallProvider */}

      {/* Notepad */}
      {showNotepad && <SharedNotepad roomCode={`dm_${dmId}`} socket={socket} onClose={() => setShowNotepad(false)} />}

      {/* Drawing canvas */}
      {showDrawing && <DrawingCanvas onSend={handleImageSend} onClose={() => setShowDrawing(false)} dmId={dmId} />}

      {/* Timer input modal */}
      <AnimatePresence>
        {showTimerInput && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowTimerInput(false); }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
              <h3 className="font-bold text-gray-900 mb-4 text-center">⏱️ Set Shared Timer</h3>
              <div className="flex items-center gap-3 mb-4">
                <input type="number" min={1} max={60} value={timerMinutes}
                  onChange={(e) => setTimerMinutes(e.target.value)}
                  className="flex-1 text-center text-3xl font-bold border-2 border-violet-200 rounded-2xl py-3 outline-none focus:border-violet-500"
                />
                <span className="text-gray-400 font-medium">min</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowTimerInput(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">Cancel</button>
                <button onClick={handleStartTimer} className="flex-1 py-2.5 bg-violet-500 text-white rounded-xl text-sm font-semibold">Start ▶</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Top bar */}
      <div className={`flex-shrink-0 z-20 transition-all duration-300 px-4 py-2.5 sm:py-3 flex items-center gap-3 pt-[calc(0.625rem+env(safe-area-inset-top))] border-b ${themeTint.bg} ${themeTint.border}`}>
        <button onClick={() => navigate('/')} className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-500 transition-colors flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        {partner && (
          <Link to={`/profile/${partner.username}`} className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar user={partner} size={10} />
              <OnlineDot userId={partner.id || partner._id} size="sm" className="absolute -bottom-0.5 -right-0.5" />
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <p className="font-semibold text-gray-900 text-[15px] truncate">
                {partner.displayName || partner.username}
              </p>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {partnerTyping
                  ? <span className="text-violet-500 font-medium">typing...</span>
                  : <StatusText userId={partner.id || partner._id} />}
              </p>
            </div>
          </Link>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setShowNotepad(true)} className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-500 transition-colors" title="Shared Notepad">
            <FileText size={18} />
          </button>
          <button onClick={() => setShowTimerInput(true)} className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-500 transition-colors" title="Shared Timer">
            <Timer size={18} />
          </button>
          <button onClick={() => setShowBackgroundPicker(true)} className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-500 transition-colors" title="Customize Background">
            <Palette size={18} />
          </button>
          {partner && (
            <>
              <button 
                onClick={() => {
                  if (!partner.id && !partner._id) {
                    toast.error('User info not loaded yet')
                    return
                  }
                  initiateCall({
                    _id:         partner.id || partner._id,
                    username:    partner.username,
                    displayName: partner.displayName || partner.username,
                    avatar:      partner.avatar,
                  }, 'audio')
                }}
                className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-500 transition-colors" 
                title="Audio Call"
              >
                <Phone size={18} />
              </button>
              <button 
                onClick={() => {
                  if (!partner.id && !partner._id) {
                    toast.error('User info not loaded yet')
                    return
                  }
                  initiateCall({
                    _id:         partner.id || partner._id,
                    username:    partner.username,
                    displayName: partner.displayName || partner.username,
                    avatar:      partner.avatar,
                  }, 'video')
                }}
                className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-500 transition-colors" 
                title="Video Call"
              >
                <Video size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pinned message */}
      {pinnedMessage && (
        <PinnedMessage
          message={pinnedMessage}
          onScrollTo={() => {
            document.getElementById(`msg-${pinnedMessage._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          onUnpin={handleUnpin}
        />
      )}

      {/* Messages */}
      <div 
        ref={containerRef} 
        onScroll={handleScroll} 
        className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-5 space-y-3 min-h-0 relative z-10 bg-transparent"
      >
        {messages.map((msg, idx) => {
          const mine = isMine(msg);
          const showDivider = firstUnreadId && msg._id === firstUnreadId;
          return (
            <React.Fragment key={msg._id}>
            {showDivider && <UnreadDivider count={unreadCount} />}
            <SwipeableMessage mine={mine} onReply={() => handleReply(msg)}>
              <motion.div
                id={`msg-${msg._id}`}
                initial={initialScrollDone ? { opacity: 0, y: 10 } : false}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2.5 ${mine ? 'justify-end' : 'justify-start'} msg-in relative z-10`}
                onContextMenu={(e) => { e.preventDefault(); handleLongPress(msg, e); }}
                onTouchStart={(e) => {
                  longPressRef.current = setTimeout(() => handleLongPress(msg, e), 450);
                }}
                onTouchEnd={() => clearTimeout(longPressRef.current)}
                onTouchMove={() => clearTimeout(longPressRef.current)}
              >
                {!mine && <Avatar user={msg.senderId} size={8} className="mt-auto mb-0.5 mr-0.5" />}
 
                <div className={`max-w-[78%] sm:max-w-[70%] lg:max-w-sm ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1 relative group`}>
                  {/* Floating Emojis */}
                  <div className="absolute inset-0 pointer-events-none z-40 overflow-visible">
                    {floatingEmojis
                      .filter((fe) => fe.messageId === msg._id)
                      .map((item) => (
                        <span
                          key={item.id}
                          className="absolute animate-float-up text-2xl select-none"
                          style={{
                            bottom: '100%',
                            left: `calc(50% + ${item.offset}px)`,
                          }}
                        >
                          {item.emoji}
                        </span>
                      ))}
                  </div>
 
                  {/* Message bubble + reaction picker button wrapper */}
                  <div className="relative flex items-center gap-2">
                    <div className="relative">
                      {msg.type === 'image' ? (
                        <div className={`flex flex-col gap-1.5 p-1.5 rounded-2xl relative z-10 ${mine ? 'bg-violet-600/10 dark:bg-violet-900/20' : 'bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700'}`}>
                          {msg.replyTo && (
                            <QuotedMessage
                              replyTo={msg.replyTo}
                              isSent={false}
                              onScrollTo={(id) => {
                                document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                            />
                          )}
                          <ImageMessage
                            src={msg.content}
                            onOpenLightbox={(url, saveFn) => {
                              setLightboxImage(url);
                              setLightboxSaveFn(() => saveFn);
                            }}
                          />
                        </div>
                      ) : msg.type === 'location' ? (
                        <div className={`flex flex-col gap-1.5 p-1.5 rounded-2xl relative z-10 ${mine ? 'bg-violet-600/10 dark:bg-violet-900/20' : 'bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700'}`}>
                          {msg.replyTo && (
                            <QuotedMessage
                              replyTo={msg.replyTo}
                              isSent={false}
                              onScrollTo={(id) => {
                                document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                            />
                          )}
                          <LocationBubble
                            id={msg._id}
                            myCoords={location.myCoords}
                            partnerCoords={location.partnerCoords}
                            myUsername={user?.username}
                            partnerUsername={partner?.username}
                            distance={location.distance}
                            partnerStopped={location.partnerStopped}
                          />
                        </div>
                      ) : msg.type === 'timer' ? (
                        timerState && (
                          <div className={`flex flex-col gap-1.5 p-1.5 rounded-2xl relative z-10 ${mine ? 'bg-violet-600/10 dark:bg-violet-900/20' : 'bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700'}`}>
                            {msg.replyTo && (
                              <QuotedMessage
                                replyTo={msg.replyTo}
                                isSent={false}
                                onScrollTo={(id) => {
                                  document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                              />
                            )}
                            <TimerBubble
                              seconds={timerState.seconds}
                              totalSeconds={timerState.totalSeconds}
                              isRunning={timerState.isRunning}
                              onPause={() => socket?.emit('timer:pause', { dmId })}
                              onCancel={() => socket?.emit('timer:cancel', { dmId })}
                            />
                          </div>
                        )
                      ) : (
                        <div className={`${mine ? 'bubble-sent' : 'bubble-recv'} ${
                          chatBackground?.type === 'custom' ? 'shadow-md backdrop-blur-sm bg-white/95 dark:bg-gray-850/95' : ''
                        } relative z-10`}>
                          {msg.replyTo && (
                            <QuotedMessage
                              replyTo={msg.replyTo}
                              isSent={mine}
                              onScrollTo={(id) => {
                                document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                            />
                          )}
                          <p dangerouslySetInnerHTML={{ __html: parseFormatting(msg.content) }} className="break-words" />
                        </div>
                      )}
                    </div>

                    {/* Reaction picker hover button */}
                    <button
                      onClick={() => {
                        if (activePickerMessageId === msg._id) {
                          setActivePickerMessageId(null);
                          setAnchorRect(null);
                        } else {
                          const messageEl = document.getElementById(`msg-${msg._id}`);
                          if (messageEl) {
                            setAnchorRect(messageEl.getBoundingClientRect());
                          }
                          setActivePickerMessageId(msg._id);
                        }
                      }}
                      className={`absolute top-1/2 -translate-y-1/2 ${
                        mine ? '-left-8' : '-right-8'
                      } w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center text-sm transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-gray-200 dark:hover:bg-gray-700 z-10`}
                    >
                      😊
                    </button>

                    {/* Reaction bar popup */}
                    {activePickerMessageId === msg._id && anchorRect && (
                      <ReactionBar
                        message={msg}
                        currentUser={user}
                        anchorRect={anchorRect}
                        onReact={(emoji) => {
                          handleReact(msg._id, emoji);
                          setActivePickerMessageId(null);
                          setAnchorRect(null);
                        }}
                        onClose={() => {
                          setActivePickerMessageId(null);
                          setAnchorRect(null);
                        }}
                        onReply={() => handleReply(msg)}
                        onPin={() => handlePin(msg)}
                        onCopy={() => handleCopy(msg)}
                        isMe={mine}
                      />
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 px-1.5 mt-0.5">
                    <span className="text-[11px] text-gray-400 font-medium">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {mine && <MessageTicks status={msg.status} />}
                  </div>

                  {/* Reactions display */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {Object.values(msg.reactions.reduce((acc, r) => {
                        if (!acc[r.emoji]) {
                          acc[r.emoji] = { emoji: r.emoji, count: 0, userIds: [] };
                        }
                        acc[r.emoji].count += 1;
                        acc[r.emoji].userIds.push(r.userId);
                        return acc;
                      }, {})).map((r, idx) => {
                        const hasReacted = r.userIds.includes(user?.id?.toString() || user?._id?.toString());
                        return (
                          <button
                            key={idx}
                            onClick={() => handleReact(msg._id, r.emoji)}
                            className={`border rounded-full px-2.5 py-1 text-xs flex items-center gap-1 shadow-sm hover:scale-110 active:scale-95 transition-all font-medium ${
                              hasReacted
                                ? 'bg-violet-100 border-violet-300 text-violet-700'
                                : 'bg-white border-gray-200 text-gray-800'
                            }`}
                          >
                            <span>{r.emoji}</span>
                            {r.count > 1 && <span className="text-[10px]">{r.count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {mine && <Avatar user={user} size={8} className="mt-auto mb-0.5 ml-0.5" />}
              </motion.div>
            </SwipeableMessage>
            </React.Fragment>
          );
        })}

        {/* Live timer in chat */}
        {timerState && <TimerBubble
          seconds={timerState.seconds}
          totalSeconds={timerState.totalSeconds}
          isRunning={timerState.isRunning}
          onPause={() => socket?.emit('timer:pause', { dmId })}
          onCancel={() => socket?.emit('timer:cancel', { dmId })}
        />}

        {/* Location sharing indicator */}
        {(location.isSharing || location.partnerCoords) && (
          <div className="flex justify-center my-2">
            <LocationBubble
              id="live"
              myCoords={location.myCoords}
              partnerCoords={location.partnerCoords}
              myUsername={user?.username}
              partnerUsername={partner?.username}
              distance={location.distance}
              partnerStopped={location.partnerStopped}
            />
          </div>
        )}

        {partnerTyping && (
          <div className="flex gap-2 items-end">
            <Avatar user={partner} size={8} />
            <div className="bubble-recv flex gap-1 items-center px-4 py-3">
              {[0, 1, 2].map((i) => <span key={i} className="typing-dot" />)}
            </div>
          </div>
        )}

        {uploads.map((upload) => (
          <UploadingBubble key={upload.id} upload={upload} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating "New messages" button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-violet-500 text-white text-xs font-semibold rounded-full shadow-lg hover:bg-violet-600 active:scale-95 transition-all flex items-center gap-1.5 animate-bounce"
        >
          ↓ New messages
        </button>
      )}

      {/* Reply bar */}
      <AnimatePresence>
        {replyTo && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
            <ReplyBar replyingTo={replyTo} onCancel={() => setReplyTo(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className={`flex-shrink-0 transition-all duration-300 px-3 sm:px-4 py-2.5 sm:py-3 flex items-end gap-1.5 sm:gap-2 pb-[calc(0.625rem+env(safe-area-inset-bottom))] border-t ${themeTint.bg} ${themeTint.border}`}>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

        {/* Hide secondary icons on very small screens */}
        <div className="hidden xs:flex items-center gap-0.5">
          <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-400 transition-colors flex-shrink-0">
            <Image size={19} />
          </button>
          <button onClick={() => setShowDrawing(true)} className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-400 transition-colors flex-shrink-0">
            <Pencil size={19} />
          </button>
          <button
            onClick={() => location.isSharing ? location.stop() : location.start()}
            className={`p-2 rounded-xl transition-colors flex-shrink-0 ${location.isSharing ? 'bg-violet-100 text-violet-500' : 'hover:bg-gray-100 text-gray-400'}`}
          >
            <MapPin size={19} />
          </button>
        </div>

        {/* On very narrow screens (<375px), collapse extra icons into a single "+" button */}
        <button
          onClick={() => setShowMoreOptions(true)}
          className="xs:hidden p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-400 flex-shrink-0"
        >
          <Plus size={19} />
        </button>

        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); handleTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          className="flex-1 min-w-0 field-pill resize-none max-h-32 py-2.5 px-4 text-[15px]"
          style={{ minHeight: '42px' }}
        />

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-violet-200 hover:opacity-90 hover:shadow-lg disabled:opacity-40 disabled:shadow-none transition-all flex-shrink-0"
        >
          <Send size={17} />
        </motion.button>
      </div>

      {/* Expandable options sheet on mobile */}
      <AnimatePresence>
        {showMoreOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => setShowMoreOptions(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full rounded-t-3xl p-5 shadow-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-gray-900 mb-4 text-center">More Actions</h3>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    setShowMoreOptions(false);
                    fileInputRef.current?.click();
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-gray-50 active:scale-95 transition-all text-gray-600"
                >
                  <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-500">
                    <Image size={24} />
                  </div>
                  <span className="text-xs font-semibold">Send Image</span>
                </button>

                <button
                  onClick={() => {
                    setShowMoreOptions(false);
                    setShowDrawing(true);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-gray-50 active:scale-95 transition-all text-gray-600"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-500">
                    <Pencil size={24} />
                  </div>
                  <span className="text-xs font-semibold">Drawing Canvas</span>
                </button>

                <button
                  onClick={() => {
                    setShowMoreOptions(false);
                    if (location.isSharing) {
                      location.stop();
                    } else {
                      location.start();
                    }
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-gray-50 active:scale-95 transition-all text-gray-600"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${location.isSharing ? 'bg-green-100 text-green-500' : 'bg-pink-100 text-pink-500'}`}>
                    <MapPin size={24} />
                  </div>
                  <span className="text-xs font-semibold">{location.isSharing ? 'Stop Location' : 'Share Location'}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage}
          onSave={lightboxSaveFn}
          onClose={() => {
            setLightboxImage(null);
            setLightboxSaveFn(null);
          }}
        />
      )}
      {/* Background Picker Drawer */}
      {showBackgroundPicker && (
        <BackgroundPicker
          dmId={dmId}
          currentBackground={chatBackground}
          onClose={() => setShowBackgroundPicker(false)}
          onUpdate={(bg) => {
            setChatBackground(bg);
            setShowBackgroundPicker(false);
          }}
        />
      )}
    </div>
  );
}
