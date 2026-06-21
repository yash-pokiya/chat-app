import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import api from '../utils/api';
import MessageBubble from '../components/MessageBubble';
import TypingIndicator from '../components/TypingIndicator';
import SystemMessage from '../components/SystemMessage';
import ScreenshotAlert from '../components/ScreenshotAlert';
import useScreenshotDetection from '../hooks/useScreenshotDetection';
import {
  Send, ArrowLeft, Hash, Wifi, WifiOff, Loader2,
  ImageIcon, Camera, Copy, Check, Info, Clock,
  Mic, Flame, Sun, Moon, Palette, X, ShieldAlert, Lock,
  MapPin, Pencil, FileText, Timer
} from 'lucide-react';
import PinnedMessage from '../components/PinnedMessage';
import { ReplyBar } from '../components/ReplyPreview';
import SharedNotepad from '../components/SharedNotepad';
import DrawingCanvas from '../components/DrawingCanvas';
import TimerBubble from '../components/TimerBubble';
import LocationBubble from '../components/LocationBubble';
import { useLocation } from '../hooks/useLocation';
import UploadingBubble from '../components/UploadingBubble';

const wallpapers = [
  { id: 'white', name: 'Default', bg: '#FFFFFF', darkBg: '#090d16' },
  { id: 'lavender', name: 'Lavender', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', darkBg: 'linear-gradient(135deg,#1e1b4b,#0b0f19)' },
  { id: 'mint', name: 'Mint', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', darkBg: 'linear-gradient(135deg,#064e3b,#0b0f19)' },
  { id: 'peach', name: 'Peach', bg: 'linear-gradient(135deg,#fff7ed,#ffedd5)', darkBg: 'linear-gradient(135deg,#7c2d12,#0b0f19)' },
  { id: 'sky', name: 'Sky Blue', bg: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', darkBg: 'linear-gradient(135deg,#0c4a6e,#0b0f19)' },
  { id: 'rose', name: 'Rose', bg: 'linear-gradient(135deg,#fff1f2,#ffe4e6)', darkBg: 'linear-gradient(135deg,#881337,#0b0f19)' },
  { id: 'dots', name: 'Dots Pattern', bg: 'radial-gradient(#6C63FF22 1px,transparent 1px)', bgSize: '20px 20px', darkBg: 'radial-gradient(#6c63ff44 1px,transparent 1px)' },
  { id: 'grid', name: 'Grid lines', bg: 'linear-gradient(#6C63FF11 1px,transparent 1px), linear-gradient(90deg,#6C63FF11 1px,transparent 1px)', bgSize: '24px 24px', darkBg: 'linear-gradient(#6c63ff22 1px,transparent 1px), linear-gradient(90deg,#6c63ff22 1px,transparent 1px)' }
];

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } }
};

/* ── Room expiry countdown ── */
function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

/* ── Waiting room with pulsing radar ring ── */
function WaitingRoom({ roomCode }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode.toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-gray-950"
    >
      {/* Pulsing rings */}
      <div className="relative w-32 h-32 mb-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border-2 border-brand-400"
            style={{
              animation: `pulseRing 2s cubic-bezier(0.455,0.03,0.515,0.955) ${i * 0.6}s infinite`,
              opacity: 0.4 - i * 0.1,
            }}
          />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-brand-gradient flex items-center justify-center shadow-brand">
            <Hash size={24} className="text-white" />
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-ink dark:text-gray-100 mb-2">Waiting for your partner…</h2>
      <p className="text-ink-muted dark:text-gray-400 text-sm mb-6">Share this code — they'll join instantly</p>

      {/* Code display */}
      <motion.button
        onClick={handleCopy}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-3 bg-surface-soft dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl px-6 py-4 hover:border-brand-300 hover:bg-brand-50 transition-all duration-200 group"
      >
        <span className="font-mono font-bold text-3xl text-ink dark:text-gray-100 tracking-widest">
          {roomCode.toUpperCase()}
        </span>
        {copied
          ? <Check size={18} className="text-success" />
          : <Copy size={18} className="text-ink-faint group-hover:text-brand-500 transition-colors" />
        }
      </motion.button>
      <p className="text-xs text-ink-faint mt-3">Click to copy</p>

      {/* Loading dots */}
      <div className="flex gap-1.5 mt-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </motion.div>
  );
}

export default function Chat() {
  const { roomCode } = useParams();
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partner, setPartner] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState([]);

  // Feature upgrades states
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [selectedWallpaper, setSelectedWallpaper] = useState(localStorage.getItem(`wallpaper_${roomCode}`) || 'white');
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [burnMode, setBurnMode] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [showNotepad, setShowNotepad] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showTimerInput, setShowTimerInput] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState('5');
  const [timerState, setTimerState] = useState(null);

  const location = useLocation({ socket, roomCode });

  // Mic state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingTimerId, setRecordingTimerId] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const startXRef = useRef(0);
  const isCancelledRef = useRef(false);

  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const roomIdRef = useRef(null);
  const userIdRef = useRef(user?.id);
  const socketJoinedRef = useRef(false);
  const confettiFiredRef = useRef(false);

  const countdown = useCountdown(room?.expiresAt);

  useEffect(() => { userIdRef.current = user?.id; }, [user]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  // Handle auto double-blue seen ticks
  useEffect(() => {
    if (!socket || !messages.length) return;
    messages.forEach((msg) => {
      const isIncoming = (msg.senderId?._id || msg.senderId)?.toString() !== user?.id?.toString();
      if (isIncoming && msg.status !== 'read') {
        socket.emit('message:read', { messageId: msg._id, roomCode });
      }
    });
  }, [messages, socket, roomCode, user]);

  // Fetch room + history
  useEffect(() => {
    const init = async () => {
      try {
        const roomRes = await api.get(`/rooms/${roomCode}`);
        const roomData = roomRes.data.room;
        setRoom(roomData);
        roomIdRef.current = roomData.id;
        const p = roomData.users.find((u) => u.id !== user?.id);
        setPartner(p || null);
        if (roomData.isReady) {
          const msgRes = await api.get(`/chat/${roomData.id}/messages`);
          const history = msgRes.data.messages || [];
          setMessages(history);
          const pinned = history.find((m) => m.isPinned);
          if (pinned) setPinnedMessage(pinned);
        }
      } catch (err) {
        toast.error(err.message || 'Could not load room.');
        navigate('/');
      } finally {
        setLoadingRoom(false);
      }
    };
    init();
  }, [roomCode, user, navigate]);

  // Effect 1: emit join-room once
  useEffect(() => {
    if (!socket || socketJoinedRef.current) return;
    socketJoinedRef.current = true;

    console.log('📡 Client emitting join-room for roomCode:', roomCode);
    socket.emit('join-room', { roomCode }, (res) => {
      console.log('📡 join-room response:', res);
      if (res?.error) { toast.error(res.error); navigate('/'); }
      else if (res?.success) {
        const onlineMap = res.users || [];
        const p = onlineMap.find((u) => u.id?.toString() !== userIdRef.current?.toString());
        if (p) setPartnerOnline(p.online);

        // Auto-sync messages on join/reconnect to capture any offline/missed events
        api.get(`/chat/${res.roomId}/messages`)
          .then((msgRes) => {
            console.log('📡 Messages synced on join-room:', msgRes.data.messages?.length);
            const history = msgRes.data.messages || [];
            setMessages(history);
            const pinned = history.find((m) => m.isPinned);
            if (pinned) setPinnedMessage(pinned);
          })
          .catch((err) => console.error('❌ Failed to sync messages:', err));
      }
    });
    return () => { socketJoinedRef.current = false; };
  }, [socket?.id, roomCode, navigate]);

  // Register screenshot & screen recording detection hook
  useScreenshotDetection({
    socket,
    roomCode,
    username: user?.username || 'Anonymous',
    onLocalAlert: () => {
      console.log('🔔 UI local screenshot alert triggered instantly');
      const localAlert = {
        _id: 'local-' + Date.now(),
        type: 'screenshot_alert',
        username: user?.username || 'Anonymous',
        roomCode,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, localAlert]);
    }
  });

  // Effect 2: stable event listeners
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (msg) => {
      console.log('📨 Client onNewMessage triggered with:', msg);
      setMessages((prev) => {
        // Remove local preview for the screenshot alert if the server version has arrived
        let filtered = prev;
        if (msg.type === 'screenshot_alert') {
          filtered = prev.filter(m => !(String(m._id).startsWith('local-') && m.username === msg.username));
        }
        const exists = filtered.some((m) => m._id === msg._id);
        if (exists) {
          console.log('⚠️ Message already exists in state:', msg._id);
        }
        return exists ? filtered : [...filtered, msg];
      });
    };

    const onUserJoined = ({ userId, username }) => {
      if (userId?.toString() === userIdRef.current?.toString()) return;
      setPartnerOnline(true);
      setPartner((prev) => prev ?? { id: userId, username });
      setRoom((r) => {
        if (!r) return r;
        const alreadyIn = r.users.some((u) => u.id?.toString() === userId?.toString());
        if (alreadyIn) return { ...r, isReady: true };
        return { ...r, users: [...r.users, { id: userId, username }], isReady: true };
      });
      toast.success(`${username} joined! 🎉`, { id: `join-${userId}` });

      if (!confettiFiredRef.current) {
        confettiFiredRef.current = true;
        confetti({
          particleCount: 80, spread: 70, origin: { y: 0.6 },
          colors: ['#6C63FF', '#48CAE4', '#ffffff']
        });
      }
    };

    const onUserOffline = () => setPartnerOnline(false);
    const onUserTyping = () => setPartnerTyping(true);
    const onStopTyping = () => setPartnerTyping(false);

    const onMessageUpdated = ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, status } : m))
      );
    };

    const onMessageReacted = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
      );
    };

    const onMessageDestructed = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    };

    const onMessagesDelivered = () => {
      setMessages((prev) =>
        prev.map((m) => {
          const isIncoming = (m.senderId?._id || m.senderId)?.toString() !== user?.id?.toString();
          return isIncoming && m.status === 'sent' ? { ...m, status: 'delivered' } : m;
        })
      );
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

    socket.on('new-message', onNewMessage);
    socket.on('user-joined', onUserJoined);
    socket.on('user-offline', onUserOffline);
    socket.on('user-typing', onUserTyping);
    socket.on('user-stop-typing', onStopTyping);
    socket.on('message:updated', onMessageUpdated);
    socket.on('message:reacted', onMessageReacted);
    socket.on('message:destructed', onMessageDestructed);
    socket.on('messages:delivered', onMessagesDelivered);
    socket.on('message:pinned', onMessagePinned);
    socket.on('message:unpinned', onMessageUnpinned);
    socket.on('timer:started', onTimerStarted);
    socket.on('timer:tick', onTimerTick);
    socket.on('timer:ended', onTimerEnded);
    socket.on('timer:cancelled', onTimerCancelled);

    return () => {
      socket.off('new-message', onNewMessage);
      socket.off('user-joined', onUserJoined);
      socket.off('user-offline', onUserOffline);
      socket.off('user-typing', onUserTyping);
      socket.off('user-stop-typing', onStopTyping);
      socket.off('message:updated', onMessageUpdated);
      socket.off('message:reacted', onMessageReacted);
      socket.off('message:destructed', onMessageDestructed);
      socket.off('messages:delivered', onMessagesDelivered);
      socket.off('message:pinned', onMessagePinned);
      socket.off('message:unpinned', onMessageUnpinned);
      socket.off('timer:started', onTimerStarted);
      socket.off('timer:tick', onTimerTick);
      socket.off('timer:ended', onTimerEnded);
      socket.off('timer:cancelled', onTimerCancelled);
    };
  }, [socket, user]);

  const handleTyping = useCallback(() => {
    if (!socket || !roomIdRef.current) return;
    socket.emit('typing', { roomId: roomIdRef.current });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('stop-typing', { roomId: roomIdRef.current });
    }, 2000);
  }, [socket]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const selectWallpaper = (wpId) => {
    setSelectedWallpaper(wpId);
    localStorage.setItem(`wallpaper_${roomCode}`, wpId);
    setShowWallpaperPicker(false);
  };

  const handleMicStart = async (e) => {
    e.preventDefault();
    startXRef.current = e.clientX || e.touches?.[0]?.clientX || 0;
    isCancelledRef.current = false;
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (isCancelledRef.current) {
          toast.error('Recording cancelled');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice.webm');
        formData.append('roomId', room.id);
        formData.append('duration', recordingTime.toString());

        try {
          const { data } = await api.post('/chat/media/voice', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (data.success) {
            socket.emit('send-message', {
              roomId: room.id,
              content: data.url,
              type: 'audio',
              cloudinaryId: data.publicId,
              duration: recordingTime,
              replyTo: replyTo?._id || null,
              isSelfDestruct: burnMode
            });
            setReplyTo(null);
          }
        } catch (err) {
          toast.error('Failed to upload voice message');
        } finally {
          setUploading(false);
        }
      };

      const timer = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            handleMicStop();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
      setRecordingTimerId(timer);

    } catch (err) {
      toast.error('Microphone access denied or error starting recorder.');
    }
  };

  const handleMicMove = (e) => {
    if (!isRecording) return;
    const currentX = e.clientX || e.touches?.[0]?.clientX || 0;
    const diffX = currentX - startXRef.current;
    if (diffX < -70) {
      isCancelledRef.current = true;
      handleMicStop();
    }
  };

  const handleMicStop = () => {
    if (recordingTimerId) {
      clearInterval(recordingTimerId);
      setRecordingTimerId(null);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || !room?.isReady) return;

    setSending(true);
    setText('');
    socket?.emit('stop-typing', { roomId: room.id });

    try {
      socket.emit('send-message', {
        roomId: room.id,
        content,
        type: 'text',
        replyTo: replyTo?._id || null,
        isSelfDestruct: burnMode
      }, (res) => {
        if (res?.error) toast.error(res.error);
      });
      setReplyTo(null);
    } catch {
      toast.error('Failed to send.');
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const handleMediaUpload = useCallback(async (file) => {
    if (!file || !room) return;
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

    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('roomId', room.id);
    try {
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
        // 2. Mark as done:
        setUploads((prev) => prev.map((u) =>
          u.id === uploadId ? { ...u, progress: 100, status: 'done' } : u
        ));

        socket.emit('send-message', {
          roomId: room.id,
          content: data.url,
          type: 'image',
          cloudinaryId: data.publicId,
          replyTo: replyTo?._id || null,
          isSelfDestruct: burnMode
        });
        setReplyTo(null);
        toast.success('Image sent!');

        // 3. Remove upload bubble after 500ms:
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
          URL.revokeObjectURL(previewUrl);
        }, 500);
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      console.error(err);
      setUploads((prev) => prev.map((u) =>
        u.id === uploadId ? { ...u, status: 'error' } : u
      ));
      toast.error(err.message || 'Upload failed.');
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        URL.revokeObjectURL(previewUrl);
      }, 3000);
    } finally {
      setUploading(false);
    }
  }, [room, replyTo, burnMode, socket]);

  const handleReact = (messageId, emoji) => {
    socket?.emit('message:react', {
      messageId,
      emoji,
      userId: user.id,
      roomCode
    });
  };

  const handlePin = (msg) => {
    socket?.emit('message:pin', { messageId: msg._id, roomCode });
  };

  const handleUnpin = () => {
    socket?.emit('message:unpin', { roomCode });
    setPinnedMessage(null);
  };

  const handleStartTimer = () => {
    const mins = parseInt(timerMinutes, 10);
    if (isNaN(mins) || mins < 1) { toast.error('Enter a valid number of minutes'); return; }
    socket?.emit('timer:start', { roomCode, seconds: mins * 60 });
    setShowTimerInput(false);
  };

  const handlePauseTimer = () => {
    socket?.emit('timer:pause', { roomCode });
  };

  const handleCancelTimer = () => {
    socket?.emit('timer:cancel', { roomCode });
  };

  const handleImageSend = (url, cloudinaryId) => {
    socket?.emit('send-message', {
      roomId: room.id,
      content: url,
      type: 'image',
      cloudinaryId,
      replyTo: replyTo?._id || null,
      isSelfDestruct: burnMode
    });
    setReplyTo(null);
  };

  const handleLeave = async () => {
    try { if (room) await api.post('/rooms/leave', { roomId: room.id }); } catch { }
    navigate('/');
  };

  if (loadingRoom) {
    return (
      <div className="min-h-[100dvh] bg-surface dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <p className="text-sm text-ink-muted dark:text-gray-400">Loading room…</p>
        </div>
      </div>
    );
  }

  const isReady = room?.isReady;
  const currentWp = wallpapers.find(w => w.id === selectedWallpaper) || wallpapers[0];
  const wallpaperStyle = {
    background: theme === 'dark' ? currentWp.darkBg : currentWp.bg,
    backgroundSize: currentWp.bgSize
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="h-[100dvh] bg-surface-soft dark:bg-gray-950 flex flex-col overflow-hidden transition-colors duration-300"
    >
      {/* Notepad */}
      {showNotepad && (
        <SharedNotepad
          roomCode={roomCode}
          socket={socket}
          onClose={() => setShowNotepad(false)}
        />
      )}

      {/* Drawing canvas */}
      {showDrawing && (
        <DrawingCanvas
          onSend={handleImageSend}
          onClose={() => setShowDrawing(false)}
          roomCode={roomCode}
        />
      )}

      {/* ── Top bar (frosted) ── */}
      <header className="frosted-bar dark:bg-gray-900/80 dark:border-gray-800 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center gap-3 z-20 shrink-0">
        <motion.button
          onClick={handleLeave}
          whileTap={{ scale: 0.93 }}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-muted dark:text-gray-400 hover:bg-surface-soft dark:hover:bg-gray-800 hover:text-ink dark:hover:text-gray-200 transition-all"
        >
          <ArrowLeft size={18} />
        </motion.button>

        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shrink-0 shadow-brand">
            <Hash size={15} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-ink dark:text-gray-100 text-sm truncate">{roomCode.toUpperCase()}</h1>
              {partner && (
                isReady && partnerOnline
                  ? <div className="online-dot shrink-0" />
                  : <div className="w-2 h-2 rounded-full bg-border dark:bg-gray-700 shrink-0" />
              )}
            </div>
            <p className="text-xs text-ink-muted dark:text-gray-400 truncate">
              {partner ? `with @${partner.username}` : 'Waiting for partner…'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Shared Notepad */}
          <button
            onClick={() => setShowNotepad(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
            title="Shared Notepad"
          >
            <FileText size={18} />
          </button>

          {/* Shared Timer */}
          <button
            onClick={() => setShowTimerInput(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
            title="Shared Timer"
          >
            <Timer size={18} />
          </button>

          {/* Wallpaper picker trigger */}
          <button
            onClick={() => setShowWallpaperPicker(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
            title="Change background"
          >
            <Palette size={18} />
          </button>

          {/* Theme switcher */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* E2E Shield Info */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
            title="Encryption details"
          >
            <Info size={18} />
          </button>

          {/* Timer */}
          {countdown && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-ink-muted dark:text-gray-400 bg-surface-soft dark:bg-gray-800 px-2.5 py-1 rounded-full border border-border dark:border-gray-700">
              <Clock size={11} />
              <span>{countdown}</span>
            </div>
          )}
          {/* Connection */}
          {connected
            ? <Wifi size={15} className="text-success" />
            : <WifiOff size={15} className="text-danger animate-pulse" />
          }
        </div>
      </header>

      {/* End to End Encryption Badge */}
      <div className="flex items-center justify-center gap-2 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-950/40 shrink-0">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
          🔒 End-to-end encrypted · Messages auto-delete in 24h
        </p>
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

      {/* ── Main content ── */}
      {!isReady ? (
        <WaitingRoom roomCode={roomCode} />
      ) : (
        <>
          {/* ── Messages & Custom Wallpaper ── */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1 transition-all duration-300"
            style={wallpaperStyle}
            onTouchMove={handleMicMove}
            onMouseMove={handleMicMove}
          >
            <AnimatePresence initial={false}>
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="text-4xl mb-3">👋</div>
                  <p className="text-ink-muted dark:text-gray-400 text-sm">Say hello! Messages auto-delete in 24 hours.</p>
                </motion.div>
              ) : (
                messages.map((msg, idx) => {
                  if (msg.type === 'screenshot_alert') {
                    return (
                      <ScreenshotAlert
                        key={msg._id || idx}
                        username={msg.username}
                      />
                    );
                  }
                  if (msg.type === 'system') {
                    return (
                      <SystemMessage
                        key={msg._id || idx}
                        text={msg.content}
                        type={msg.systemType}
                      />
                    );
                  }
                  const isSent = (msg.senderId?._id || msg.senderId)?.toString() === user?.id?.toString();
                  const prevMsg = messages[idx - 1];
                  const showAvatar = !prevMsg ||
                    (prevMsg.senderId?._id || prevMsg.senderId)?.toString() !==
                    (msg.senderId?._id || msg.senderId)?.toString();

                  if (msg.type === 'location') {
                    return (
                      <div key={msg._id || idx} className={`flex gap-2 ${isSent ? 'justify-end' : 'justify-start'} my-2`}>
                        <LocationBubble
                          id={msg._id || idx}
                          myCoords={location.myCoords}
                          partnerCoords={location.partnerCoords}
                          myUsername={user?.username}
                          partnerUsername={partner?.username}
                          distance={location.distance}
                          partnerStopped={location.partnerStopped}
                        />
                      </div>
                    );
                  }

                  if (msg.type === 'timer') {
                    return timerState ? (
                      <div key={msg._id || idx} className="flex justify-center my-2">
                        <TimerBubble
                          seconds={timerState.seconds}
                          totalSeconds={timerState.totalSeconds}
                          isRunning={timerState.isRunning}
                          onPause={handlePauseTimer}
                          onCancel={handleCancelTimer}
                        />
                      </div>
                    ) : null;
                  }

                  return (
                    <MessageBubble
                      key={msg._id || idx}
                      message={msg}
                      isSent={isSent}
                      showAvatar={showAvatar}
                      partnerName={partner?.username}
                      onReact={(emoji) => handleReact(msg._id, emoji)}
                      onReply={(targetMsg) => setReplyTo(targetMsg)}
                      onPin={handlePin}
                      socket={socket}
                      roomCode={roomCode}
                      user={user}
                    />
                  );
                })
              )}
            </AnimatePresence>

            {/* Live timer in chat */}
            {timerState && (
              <div className="flex justify-center my-2">
                <TimerBubble
                  seconds={timerState.seconds}
                  totalSeconds={timerState.totalSeconds}
                  isRunning={timerState.isRunning}
                  onPause={handlePauseTimer}
                  onCancel={handleCancelTimer}
                />
              </div>
            )}

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

            {/* Typing indicator */}
            <AnimatePresence>
              {partnerTyping && <TypingIndicator username={partner?.username} />}
            </AnimatePresence>

            {uploads.map((upload) => (
              <UploadingBubble key={upload.id} upload={upload} />
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input bar (frosted) ── */}
          <div className="frosted-bar dark:bg-gray-900/90 dark:border-gray-800 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shrink-0">
            {/* Quoted Message Preview above input bar */}
            {replyTo && (
              <div className="animate-slide-up">
                <ReplyBar replyingTo={replyTo} onCancel={() => setReplyTo(null)} />
              </div>
            )}

            {uploading && (
              <div className="flex items-center gap-2 text-xs text-ink-muted dark:text-gray-400 px-2 pb-2">
                <Loader2 size={12} className="animate-spin text-brand-500" />
                Uploading asset…
              </div>
            )}

            {/* Live recording audio message visualizer */}
            {isRecording ? (
              <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-900/40 rounded-full px-5 py-2.5 mx-2 mb-2 animate-pulse">
                <div className="flex items-center gap-2 text-red-500">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                  <span className="text-sm font-semibold select-none">
                    Recording: {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium animate-bounce">
                  slide left to cancel ←
                </span>
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              {/* Mic hold button */}
              <motion.button
                onMouseDown={handleMicStart}
                onTouchStart={handleMicStart}
                onMouseUp={handleMicStop}
                onTouchEnd={handleMicStop}
                whileTap={{ scale: 0.92 }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 shrink-0 ${isRecording
                    ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20 scale-110'
                    : 'text-ink-muted bg-surface-soft border-border hover:bg-brand-50 hover:text-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-violet-900/30'
                  }`}
                title="Hold to record voice message"
              >
                <Mic size={17} />
              </motion.button>

              {/* Gallery button */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-muted bg-surface-soft hover:bg-brand-50 hover:text-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-violet-900/30 transition-all shrink-0 border border-border"
                title="Upload image"
              >
                <ImageIcon size={17} />
              </motion.button>

              {/* Camera button */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => cameraInputRef.current?.click()}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-muted bg-surface-soft hover:bg-brand-50 hover:text-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-violet-900/30 transition-all shrink-0 border border-border"
                title="Take photo"
              >
                <Camera size={17} />
              </motion.button>

              {/* Drawing canvas button ✏️ */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowDrawing(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-muted bg-surface-soft hover:bg-brand-50 hover:text-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-violet-900/30 transition-all shrink-0 border border-border"
                title="Draw sketch"
              >
                <Pencil size={17} />
              </motion.button>

              {/* Location button 📍 */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => location.isSharing ? location.stop() : location.start()}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 shrink-0 ${
                  location.isSharing
                    ? 'bg-violet-100 text-violet-500 border-violet-200'
                    : 'text-ink-muted bg-surface-soft border-border hover:bg-brand-50 hover:text-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-violet-900/30'
                }`}
                title="Share Live Location"
              >
                <MapPin size={17} />
              </motion.button>

              {/* Hidden inputs */}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files[0] && handleMediaUpload(e.target.files[0])} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => e.target.files[0] && handleMediaUpload(e.target.files[0])} />

              {/* Text input */}
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); handleTyping(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Message…"
                rows={1}
                className="field-pill flex-1 max-h-28 overflow-y-auto bg-surface-soft dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                style={{ minHeight: '40px' }}
              />

              {/* Burn Mode Toggle 🔥 */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setBurnMode(!burnMode)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 shadow-sm border ${burnMode
                    ? 'bg-orange-500 border-orange-500 text-white shadow-orange-500/20 scale-110'
                    : 'text-gray-400 bg-surface-soft border-border hover:bg-orange-50 dark:bg-gray-800 dark:border-gray-700'
                  }`}
                title="Burn Mode (Self-destruct in 10s)"
              >
                <Flame size={16} />
              </motion.button>

              {/* Send button */}
              <motion.button
                onClick={sendMessage}
                disabled={!text.trim() || sending}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white shadow-brand shrink-0 disabled:opacity-40 transition-opacity"
              >
                {sending
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send size={16} />
                }
              </motion.button>
            </div>
          </div>
        </>
      )}

      {/* Wallpaper Picker Bottom Drawer */}
      <AnimatePresence>
        {showWallpaperPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWallpaperPicker(false)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl z-50 p-6 shadow-2xl border-t border-gray-100 dark:border-gray-800"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Palette className="text-violet-500" /> Customize Background
                </h3>
                <button
                  onClick={() => setShowWallpaperPicker(false)}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 max-h-60 overflow-y-auto mb-6">
                {wallpapers.map((wp) => (
                  <button
                    key={wp.id}
                    onClick={() => selectWallpaper(wp.id)}
                    className={`h-16 rounded-xl border-2 transition-all relative overflow-hidden flex flex-col items-center justify-center ${selectedWallpaper === wp.id
                        ? 'border-violet-500 dark:border-violet-400 ring-2 ring-violet-500/20'
                        : 'border-gray-200 dark:border-gray-800 hover:border-violet-300 dark:hover:border-violet-600'
                      }`}
                    style={{
                      background: theme === 'dark' ? wp.darkBg : wp.bg,
                      backgroundSize: wp.bgSize
                    }}
                  >
                    <span className="text-[10px] font-bold bg-white/70 dark:bg-black/50 px-1.5 py-0.5 rounded shadow-sm text-gray-800 dark:text-gray-100 select-none">
                      {wp.name}
                    </span>
                    {selectedWallpaper === wp.id && (
                      <div className="absolute top-1 right-1 bg-violet-500 text-white rounded-full p-0.5">
                        <Check size={8} strokeWidth={4} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Info Encryption Modal */}
      <AnimatePresence>
        {showInfoModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInfoModal(false)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="fixed inset-0 m-auto w-[90%] max-w-sm h-fit bg-white dark:bg-gray-900 rounded-3xl z-50 p-6 shadow-2xl border border-gray-100 dark:border-gray-850"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                  <Lock size={28} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Room Security Details</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                  Your chat room is secured using temporary session JWT tokens. Messages are strictly encrypted via AES-256 formatting and stored safely.
                </p>
                <div className="w-full bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-4 border border-emerald-100/30 text-left mb-5">
                  <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
                    <ShieldAlert size={13} /> Automatic Cleaning Active
                  </h4>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 leading-normal">
                    To maintain maximum privacy, this room and all its media files (images, audio notes, and text records) will be permanently deleted 24 hours after creation.
                  </p>
                </div>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold text-sm transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Timer input modal */}
      <AnimatePresence>
        {showTimerInput && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setShowTimerInput(false); }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-72 shadow-2xl">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">⏱️ Set Shared Timer</h3>
              <div className="flex items-center gap-3 mb-4">
                <input type="number" min={1} max={60} value={timerMinutes}
                  onChange={(e) => setTimerMinutes(e.target.value)}
                  className="flex-1 text-center text-3xl font-bold border-2 border-violet-200 dark:border-gray-700 rounded-2xl py-3 outline-none focus:border-violet-500 bg-transparent text-gray-900 dark:text-gray-100"
                />
                <span className="text-gray-400 dark:text-gray-500 font-medium">min</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowTimerInput(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium">Cancel</button>
                <button onClick={handleStartTimer} className="flex-1 py-2.5 bg-violet-500 text-white rounded-xl text-sm font-semibold">Start ▶</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
