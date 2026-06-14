import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext';
import { useConversations } from '../context/ConversationContext';
import { useLocation } from '../hooks/useLocation';
import ReactionBar from '../components/ReactionBar';
import {
  ArrowLeft, Send, Image, MapPin, Video, Phone, FileText, Timer,
  Pencil, Smile, MoreVertical, Pin, Reply, Copy, Trash2, Mic
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import IncomingCall from '../components/IncomingCall';
import PinnedMessage from '../components/PinnedMessage';
import SharedNotepad from '../components/SharedNotepad';
import DrawingCanvas from '../components/DrawingCanvas';
import TimerBubble from '../components/TimerBubble';
import LocationBubble from '../components/LocationBubble';
import BlurredMedia from '../components/BlurredMedia';
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
  const s = `w-${size} h-${size}`;
  if (user?.avatar) return <img src={user.avatar} className={`${s} rounded-xl object-cover flex-shrink-0 ${className}`} alt={user.displayName} />;
  return (
    <div className={`${s} rounded-xl bg-gradient-to-br from-violet-400 to-cyan-400 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${className}`}>
      {(user?.displayName || user?.username || '?')[0].toUpperCase()}
    </div>
  );
}

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
  const pickerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [showNotepad, setShowNotepad] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showTimerInput, setShowTimerInput] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState('5');
  const [timerState, setTimerState] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
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
    callState, callType, remoteUser: callRemoteUser,
    initiateCall, acceptCall, rejectCall, endCall, formatDuration, callDuration,
    incomingSignalRef,
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

        // Get DM info — we'll infer partner from messages or a separate call
        // Fetch by getting DM via the partner's userId (we need to figure out partner from URL or messages)
        // Alternative: use messages senderId to figure out partner
        if (msgData.messages.length > 0) {
          const firstMsg = msgData.messages[0];
          // partner is the one who isn't me
          const partnerData = firstMsg.senderId?._id?.toString() !== user.id
            ? firstMsg.senderId
            : null;
          if (partnerData) {
            setPartner({ id: partnerData._id, username: partnerData.username, displayName: partnerData.displayName, avatar: partnerData.avatar });
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
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 100 && showScrollBtn) {
      setShowScrollBtn(false);
    }
  }, [showScrollBtn]);

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
    setContextMenu({ message: msg, x: e.clientX || e.touches?.[0]?.clientX, y: e.clientY || e.touches?.[0]?.clientY });
    setActivePickerMessageId(msg._id);
  };

  const handlePin = (msg) => {
    socket?.emit('message:pin', { messageId: msg._id, dmId });
    setContextMenu(null);
  };

  const handleReply = (msg) => { setReplyTo(msg); setContextMenu(null); inputRef.current?.focus(); };

  const handleCopy = (msg) => {
    navigator.clipboard.writeText(msg.content || '');
    toast.success('Copied!');
    setContextMenu(null);
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
        message: { content: url, type: 'image', createdAt: res?.message?.createdAt || new Date().toISOString(), senderId: user?.id },
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 relative">
      {/* Incoming call overlay — handled globally by CallProvider */}

      {/* Notepad */}
      {showNotepad && <SharedNotepad roomCode={`dm_${dmId}`} socket={socket} onClose={() => setShowNotepad(false)} />}

      {/* Drawing canvas */}
      {showDrawing && <DrawingCanvas onSend={handleImageSend} onClose={() => setShowDrawing(false)} dmId={dmId} />}

      {/* Timer input modal */}
      <AnimatePresence>
        {showTimerInput && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setShowTimerInput(false); }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-72 shadow-2xl">
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

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setContextMenu(null); setActivePickerMessageId(null); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 180) }}
              className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-44"
            >
              {[
                { icon: <Reply size={14}/>, label: 'Reply', fn: () => handleReply(contextMenu.message) },
                { icon: <Pin size={14}/>, label: 'Pin', fn: () => handlePin(contextMenu.message) },
                { icon: <Copy size={14}/>, label: 'Copy', fn: () => handleCopy(contextMenu.message) },
              ].map(({ icon, label, fn }) => (
                <button key={label} onClick={fn}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                  <span className="text-gray-400">{icon}</span> {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="frosted-bar px-4 py-3 flex items-center gap-3 z-10 flex-shrink-0">
        <button onClick={() => navigate('/')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-600">
          <ArrowLeft size={20} />
        </button>
        {partner && (
          <Link to={`/profile/${partner.username}`} className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="relative">
              <Avatar user={partner} size={9} />
              <OnlineDot userId={partner.id || partner._id} size="sm" className="absolute -bottom-0.5 -right-0.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{partner.displayName || partner.username}</p>
              <p className="text-xs text-gray-400">
                {partnerTyping ? '✍️ typing...' : <StatusText userId={partner.id || partner._id} />}
              </p>
            </div>
          </Link>
        )}
        <div className="flex items-center gap-1">
          <button onClick={() => setShowNotepad(true)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors" title="Shared Notepad">
            <FileText size={18} />
          </button>
          <button onClick={() => setShowTimerInput(true)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors" title="Shared Timer">
            <Timer size={18} />
          </button>
          {partner && (
            <>
              <button onClick={() => { navigate(`/call/video/${partner.id}?type=audio&username=${partner.username}`); }}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors" title="Audio Call">
                <Phone size={18} />
              </button>
              <button onClick={() => navigate(`/call/video/${partner.id}?type=video&username=${partner.username}`)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors" title="Video Call">
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
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.map((msg, idx) => {
          const mine = isMine(msg);
          const showDivider = firstUnreadId && msg._id === firstUnreadId;
          return (
            <React.Fragment key={msg._id}>
            {showDivider && <UnreadDivider count={unreadCount} />}
            <motion.div
              id={`msg-${msg._id}`}
              initial={initialScrollDone ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'} msg-in`}
              onContextMenu={(e) => { e.preventDefault(); handleLongPress(msg, e); }}
              onTouchStart={(e) => {
                longPressRef.current = setTimeout(() => handleLongPress(msg, e), 500);
              }}
              onTouchEnd={() => clearTimeout(longPressRef.current)}
            >
              {!mine && <Avatar user={msg.senderId} size={8} className="mt-auto mb-1" />}

              <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1 relative group`}>
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

                {/* Reply preview */}
                {msg.replyTo && (
                  <QuotedMessage
                    replyTo={msg.replyTo}
                    onScrollTo={(id) => {
                      document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  />
                )}

                {/* Message bubble + reaction picker button wrapper */}
                <div className="relative flex items-center gap-2">
                  <div className="relative">
                    {msg.type === 'image' ? (
                      <BlurredMedia src={msg.content} />
                    ) : msg.type === 'location' ? (
                      <LocationBubble
                        id={msg._id}
                        myCoords={location.myCoords}
                        partnerCoords={location.partnerCoords}
                        myUsername={user?.username}
                        partnerUsername={partner?.username}
                        distance={location.distance}
                        partnerStopped={location.partnerStopped}
                      />
                    ) : msg.type === 'timer' ? (
                      timerState && (
                        <TimerBubble
                          seconds={timerState.seconds}
                          totalSeconds={timerState.totalSeconds}
                          isRunning={timerState.isRunning}
                          onPause={() => socket?.emit('timer:pause', { dmId })}
                          onCancel={() => socket?.emit('timer:cancel', { dmId })}
                        />
                      )
                    ) : (
                      <div className={mine ? 'bubble-sent' : 'bubble-recv'}>
                        <p dangerouslySetInnerHTML={{ __html: parseFormatting(msg.content) }} className="break-words" />
                      </div>
                    )}
                  </div>

                  {/* Reaction picker hover button */}
                  <button
                    onClick={() => setActivePickerMessageId(activePickerMessageId === msg._id ? null : msg._id)}
                    className={`absolute top-1/2 -translate-y-1/2 ${
                      mine ? '-left-8' : '-right-8'
                    } w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center text-sm transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-gray-200 dark:hover:bg-gray-700 z-10`}
                  >
                    😊
                  </button>

                  {/* Reaction bar popup */}
                  {activePickerMessageId === msg._id && (
                    <ReactionBar
                      message={msg}
                      currentUser={user}
                      onReact={(emoji) => {
                        handleReact(msg._id, emoji);
                        setActivePickerMessageId(null);
                      }}
                      onClose={() => setActivePickerMessageId(null)}
                      position="top"
                      isMe={mine}
                    />
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1 px-1">
                  <span className="text-xs text-gray-300">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {mine && <MessageTicks status={msg.status} />}
                </div>

                {/* Reactions display */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
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
                          className={`border rounded-full px-2 py-0.5 text-xs flex items-center gap-1 shadow-sm hover:scale-110 active:scale-95 transition-all font-medium ${
                            hasReacted
                              ? 'bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-900/50 dark:border-violet-800 dark:text-violet-200'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
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

              {mine && <Avatar user={user} size={8} className="mt-auto mb-1" />}
            </motion.div>
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
      <div className="frosted-bar px-3 py-3 flex items-end gap-2 flex-shrink-0">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

        <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0">
          <Image size={20} />
        </button>
        <button onClick={() => setShowDrawing(true)} className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0">
          <Pencil size={20} />
        </button>
        <button
          onClick={() => location.isSharing ? location.stop() : location.start()}
          className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${location.isSharing ? 'bg-violet-100 text-violet-500' : 'hover:bg-gray-100 text-gray-400'}`}
        >
          <MapPin size={20} />
        </button>

        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); handleTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          className="flex-1 field-pill resize-none max-h-32 py-2.5 text-sm"
          style={{ minHeight: '44px' }}
        />

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white shadow-md hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
        >
          <Send size={18} />
        </motion.button>
      </div>
    </div>
  );
}
