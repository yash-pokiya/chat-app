import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { Smile, CornerUpLeft, Volume2, Play, Pause, Copy, Check, Shield } from 'lucide-react';

const fmt = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const SingleGrayTick = () => (
  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const DoubleGrayTick = () => (
  <div className="flex">
    <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
    <svg className="w-3 h-3 text-gray-400 -ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </div>
);

const DoubleColoredTick = () => (
  <div className="flex">
    <svg className="w-3 h-3 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
    <svg className="w-3 h-3 text-violet-500 dark:text-violet-400 -ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </div>
);

const MessageTicks = ({ status }) => {
  if (status === 'delivered') return <DoubleGrayTick />;
  if (status === 'read') return <DoubleColoredTick />;
  return <SingleGrayTick />;
};

function AudioPlayer({ src, duration, isSent }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 text-gray-900 dark:text-white">
      <audio ref={audioRef} src={src} className="hidden" />
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shadow transition-transform hover:scale-105 active:scale-95 shrink-0 ${
          isSent ? 'bg-white text-violet-600' : 'bg-violet-600 text-white'
        }`}
      >
        {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Equalizer lines */}
      <div className="flex items-end gap-0.5 h-6 w-16">
        {[...Array(6)].map((_, i) => (
          <span
            key={i}
            className={`w-1 rounded-full ${isSent ? 'bg-white' : 'bg-violet-500'} ${
              isPlaying ? 'voice-wave-bar' : 'h-[20%]'
            }`}
            style={{
              height: isPlaying ? '100%' : '20%',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      <span className="text-xs font-semibold select-none">
        {isPlaying ? formatTime(currentTime) : formatTime(duration || 0)}
      </span>
    </div>
  );
}

export default function MessageBubble({ message, isSent, showAvatar, partnerName, onReact, onReply, socket, roomCode, user }) {
  const [open, setOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isDestructed, setIsDestructed] = useState(false);
  const pickerRef = useRef(null);

  const isImage = message.type === 'image';
  const isAudio = message.type === 'audio';
  const name = message.senderId?.username || (isSent ? 'You' : partnerName || 'Partner');

  // Trigger floating emojis on reaction change
  useEffect(() => {
    if (!message.reactions || message.reactions.length === 0) return;
    const latest = message.reactions[message.reactions.length - 1];
    const newId = Date.now();
    const newItems = [
      { id: `${newId}-1`, emoji: latest.emoji, offset: -15 },
      { id: `${newId}-2`, emoji: latest.emoji, offset: 0 },
      { id: `${newId}-3`, emoji: latest.emoji, offset: 15 },
    ];
    setFloatingEmojis((prev) => [...prev, ...newItems]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => !newItems.map(n => n.id).includes(item.id)));
    }, 800);
  }, [message.reactions]);

  // Handle self destruct timer
  useEffect(() => {
    if (!message.isSelfDestruct || !message.destructsAt) return;

    const timer = setInterval(() => {
      const diff = new Date(message.destructsAt) - Date.now();
      const secondsLeft = Math.max(0, diff / 1000);
      setTimeLeft(secondsLeft);

      if (diff <= 0) {
        setIsDestructed(true);
        clearInterval(timer);
        socket?.emit('message:destruct', { messageId: message._id, roomCode });
      }
    }, 100);

    return () => clearInterval(timer);
  }, [message.isSelfDestruct, message.destructsAt, socket, roomCode, message._id]);

  // Handle outside click to close picker
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const aggregateReactions = () => {
    if (!message.reactions) return [];
    const counts = {};
    message.reactions.forEach((r) => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    });
    return Object.entries(counts).map(([emoji, count]) => ({ emoji, count }));
  };

  return (
    <motion.div
      id={`msg-${message._id}`}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`group relative flex items-end gap-2 mb-2 p-1 rounded-2xl transition-all ${
        isSent ? 'flex-row-reverse' : 'flex-row'
      } ${isDestructed ? 'animate-self-destruct' : ''}`}
    >
      {/* Floating Emojis */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-visible">
        {floatingEmojis.map((item) => (
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

      {/* Avatar */}
      <div className={`w-7 h-7 shrink-0 ${showAvatar ? 'visible' : 'invisible'}`}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold uppercase select-none
          ${isSent
            ? 'bg-brand-gradient text-white shadow-sm'
            : 'bg-surface-muted dark:bg-gray-800 text-ink-muted border border-border dark:border-gray-700'
          }`}>
          {name[0]}
        </div>
      </div>

      {/* Content */}
      <div className={`flex flex-col max-w-[72%] ${isSent ? 'items-end' : 'items-start'} relative`}>
        {showAvatar && (
          <span className="text-[10px] text-ink-faint mb-1 px-1 font-medium">
            {isSent ? 'You' : name}
          </span>
        )}

        <div className="relative flex items-center gap-2 group-hover:opacity-100">
          {/* Bubble container */}
          <div className="relative">
            {/* Quote Reply display inside message bubble */}
            {message.replyTo && (
              <div
                onClick={() => {
                  const el = document.getElementById(`msg-${message.replyTo._id}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="bg-black/5 dark:bg-white/10 rounded-t-2xl rounded-b-md px-3 py-1.5 mb-1 border-l-4 border-violet-500 cursor-pointer text-left select-none text-xs w-full max-w-[280px]"
              >
                <p className="font-bold text-violet-600 dark:text-violet-400">
                  @{message.replyTo.senderId?.username || 'Partner'}
                </p>
                <p className="text-gray-500 dark:text-gray-400 truncate">
                  {message.replyTo.type === 'audio' ? '🎵 Voice message'
                   : message.replyTo.type === 'image' ? '🖼 Photo'
                   : message.replyTo.content}
                </p>
              </div>
            )}

            {/* Main content body */}
            {isImage ? (
              <>
                <motion.img
                  src={message.content}
                  alt="Shared image"
                  className="rounded-2xl max-w-[220px] cursor-pointer object-cover border border-border/50 dark:border-gray-800"
                  style={{ maxHeight: '200px' }}
                  onClick={() => setOpen(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  loading="lazy"
                />
                <Lightbox
                  open={open}
                  close={() => setOpen(false)}
                  slides={[{ src: message.content }]}
                />
              </>
            ) : isAudio ? (
              <div className={isSent ? 'bubble-sent dark:bg-violet-900/50' : 'bubble-recv dark:bg-gray-800'}>
                <AudioPlayer src={message.content} duration={message.duration} isSent={isSent} />
              </div>
            ) : (
              <div className={isSent ? 'bubble-sent dark:bg-violet-900/50' : 'bubble-recv dark:bg-gray-800'}>
                <p className="break-words whitespace-pre-wrap leading-relaxed text-sm dark:text-white">{message.content}</p>
              </div>
            )}

            {/* Self-destruct SVG Countdown overlay */}
            {message.isSelfDestruct && (
              <div className="absolute -top-2.5 -right-2.5 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center shadow">
                <span className="text-[10px] font-bold text-white leading-none">{Math.max(0, Math.ceil(timeLeft))}</span>
                <svg className="absolute inset-0 w-5 h-5 -rotate-90">
                  <circle
                    cx="10"
                    cy="10"
                    r="8.5"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    fill="none"
                    strokeDasharray="54"
                    strokeDashoffset={54 - (timeLeft / 10) * 54}
                    className="transition-all duration-100"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Reactions HUD below bubble */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {aggregateReactions().map((r, i) => (
              <button
                key={i}
                onClick={() => onReact(r.emoji)}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2.5 py-0.5 text-xs flex items-center gap-1 shadow-sm hover:scale-110 active:scale-95 transition-all text-gray-800 dark:text-gray-200 font-medium"
              >
                <span>{r.emoji}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Time + Seen status footer */}
        <div className="flex items-center gap-1 mt-1 px-1">
          <span className="text-[10px] text-ink-faint">{fmt(message.createdAt)}</span>
          {isSent && <MessageTicks status={message.status} />}
        </div>
      </div>

      {/* Hover Panel controls */}
      <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 ${
        isSent ? 'right-[100%] mr-2 flex-row-reverse' : 'left-[100%] ml-2 flex-row'
      }`}>
        <button
          onClick={() => onReply(message)}
          className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-violet-500 shadow-sm transition-transform active:scale-90"
          title="Reply"
        >
          <CornerUpLeft size={13} />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-violet-500 shadow-sm transition-transform active:scale-90"
            title="React"
          >
            <Smile size={13} />
          </button>
          
          {showPicker && (
            <div ref={pickerRef} className={`absolute z-50 bottom-8 shadow-2xl border border-gray-200 dark:border-gray-700 rounded-3xl overflow-hidden ${
              isSent ? 'right-0' : 'left-0'
            }`}>
              <Picker
                data={data}
                onEmojiSelect={(emoji) => {
                  onReact(emoji.native);
                  setShowPicker(false);
                }}
                theme={localStorage.getItem('theme') || 'light'}
                perLine={8}
                maxFrequentRows={1}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
