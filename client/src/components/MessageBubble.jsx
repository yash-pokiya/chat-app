import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { Smile, CornerUpLeft, Volume2, Play, Pause, Copy, Check, Shield, Pin } from 'lucide-react';

import { QuotedMessage } from './ReplyPreview';
import ReactionBar from './ReactionBar';
import SwipeableMessage from './SwipeableMessage';

const fmt = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
  if (status === 'read' || status === 'seen') return <DoubleColoredTick />;
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

export default function MessageBubble({ message, isSent, showAvatar, partnerName, onReact, onReply, onPin, socket, roomCode, user }) {
  const [open, setOpen] = useState(false);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isDestructed, setIsDestructed] = useState(false);
  const longPressTimer = useRef(null);

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

  // Touch handlers for mobile long press
  const onTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) {
        try {
          navigator.vibrate(15);
        } catch (_) {}
      }
      const messageEl = document.getElementById(`msg-${message._id}`);
      if (messageEl) {
        setAnchorRect(messageEl.getBoundingClientRect());
      }
      setShowReactionBar(true);
    }, 450);
  };

  const onTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const getGroupedReactions = () => {
    if (!message.reactions) return [];
    const groups = {};
    message.reactions.forEach((r) => {
      if (!groups[r.emoji]) {
        groups[r.emoji] = { emoji: r.emoji, count: 0, userIds: [] };
      }
      groups[r.emoji].count += 1;
      groups[r.emoji].userIds.push(r.userId);
    });
    return Object.values(groups);
  };

  return (
    <SwipeableMessage mine={isSent} onReply={() => onReply(message)}>
      <motion.div
        id={`msg-${message._id}`}
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className={`group relative flex items-end gap-2 mb-2 p-1 rounded-2xl transition-all ${
          isSent ? 'flex-row-reverse' : 'flex-row'
        } ${isDestructed ? 'animate-self-destruct' : ''}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={() => clearTimeout(longPressTimer.current)}
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
            {/* Main content body */}
            {isImage ? (
              <div className={`flex flex-col gap-1.5 p-1.5 rounded-2xl ${isSent ? 'bg-violet-600/10 dark:bg-violet-900/20' : 'bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700'}`}>
                {message.replyTo && (
                  <QuotedMessage
                    replyTo={message.replyTo}
                    isSent={false}
                    onScrollTo={(id) => {
                      const el = document.getElementById(`msg-${id}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  />
                )}
                <img
                  src={message.content}
                  onClick={() => setOpen(true)}
                  className="rounded-2xl w-full max-w-[200px] sm:max-w-[240px] h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                  alt="Sent image"
                />
                <Lightbox
                  open={open}
                  close={() => setOpen(false)}
                  slides={[{ src: message.content }]}
                />
              </div>
            ) : isAudio ? (
              <div className={isSent ? 'bubble-sent dark:bg-violet-900/50' : 'bubble-recv dark:bg-gray-800'}>
                {message.replyTo && (
                  <QuotedMessage
                    replyTo={message.replyTo}
                    isSent={isSent}
                    onScrollTo={(id) => {
                      const el = document.getElementById(`msg-${id}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  />
                )}
                <AudioPlayer src={message.content} duration={message.duration} isSent={isSent} />
              </div>
            ) : (
              <div className={isSent ? 'bubble-sent dark:bg-violet-900/50' : 'bubble-recv dark:bg-gray-800'}>
                {message.replyTo && (
                  <QuotedMessage
                    replyTo={message.replyTo}
                    isSent={isSent}
                    onScrollTo={(id) => {
                      const el = document.getElementById(`msg-${id}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  />
                )}
                <p dangerouslySetInnerHTML={{ __html: parseFormatting(message.content) }} className="break-words whitespace-pre-wrap leading-relaxed text-sm dark:text-white" />
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
            {getGroupedReactions().map((r, i) => {
              const myId = user?.id || user?._id;
              const hasReacted = r.userIds.includes(myId?.toString());
              return (
                <button
                  key={i}
                  onClick={() => onReact(r.emoji)}
                  className={`border rounded-full px-2.5 py-0.5 text-xs flex items-center gap-1 shadow-sm hover:scale-110 active:scale-95 transition-all font-medium ${
                    hasReacted
                      ? 'bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-900/50 dark:border-violet-800 dark:text-violet-200'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className={hasReacted ? 'text-[10px] text-violet-600 dark:text-violet-300' : 'text-[10px] text-gray-500 dark:text-gray-400'}>
                    {r.count}
                  </span>
                </button>
              );
            })}
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
        {onPin && (
          <button
            onClick={() => onPin(message)}
            className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-violet-500 shadow-sm transition-transform active:scale-90"
            title="Pin Message"
          >
            <Pin size={13} />
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => {
              if (showReactionBar) {
                setShowReactionBar(false);
                setAnchorRect(null);
              } else {
                const messageEl = document.getElementById(`msg-${message._id}`);
                if (messageEl) {
                  setAnchorRect(messageEl.getBoundingClientRect());
                }
                setShowReactionBar(true);
              }
            }}
            className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-violet-500 shadow-sm transition-transform active:scale-90"
            title="React"
          >
            <Smile size={13} />
          </button>
          
          {showReactionBar && anchorRect && (
            <ReactionBar
              message={message}
              currentUser={user}
              anchorRect={anchorRect}
              onReact={(emoji) => {
                onReact(emoji);
                setShowReactionBar(false);
                setAnchorRect(null);
              }}
              onClose={() => {
                setShowReactionBar(false);
                setAnchorRect(null);
              }}
              onReply={() => onReply(message)}
              onPin={onPin ? () => onPin(message) : undefined}
              isMe={isSent}
            />
          )}
        </div>
      </div>
    </motion.div>
    </SwipeableMessage>
  );
}
