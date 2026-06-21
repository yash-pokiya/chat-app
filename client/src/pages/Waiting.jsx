import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Copy, Check, Hash } from 'lucide-react';
import toast from 'react-hot-toast';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -20, transition: { duration: 0.2 } }
};

export default function Waiting() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Join room when entering waiting room to ensure connection registration
    socket.emit('joinRoom', {
      roomCode: roomCode.toUpperCase(),
      username: user?.username || 'Anonymous'
    });

    const handleRoomJoined = ({ roomCode: joinedCode }) => {
      if (joinedCode.toUpperCase() === roomCode.toUpperCase()) {
        navigate(`/chat/${joinedCode.toLowerCase()}`);
      }
    };

    socket.on('room:joined', handleRoomJoined);

    return () => {
      socket.off('room:joined', handleRoomJoined);
    };
  }, [socket, roomCode, navigate, user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode.toUpperCase());
    setCopied(true);
    toast.success('Room code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-[100dvh] bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-300"
    >
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-gradient opacity-[0.07] dark:opacity-[0.03] animate-blob" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-cyan-400 opacity-[0.07] dark:opacity-[0.03] animate-blob-delay" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center z-10 glass-card dark:bg-gray-900/70 dark:border-gray-800 rounded-3xl p-8"
      >
        {/* Pulsing rings */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full border-2 border-violet-400"
              style={{
                animation: `pulseRing 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) ${i * 0.6}s infinite`,
                opacity: 0.4 - i * 0.1,
              }}
            />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 flex items-center justify-center shadow-lg">
              <Hash size={24} className="text-white" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Waiting for partner…</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Share this code — they'll join instantly</p>

        {/* Code display */}
        <motion.button
          onClick={handleCopy}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-6 py-4 mx-auto hover:border-violet-300 hover:bg-violet-50/50 transition-all duration-200 group shadow-sm"
        >
          <span className="font-mono font-bold text-3xl text-gray-900 dark:text-gray-100 tracking-widest">
            {roomCode.toUpperCase()}
          </span>
          {copied ? (
            <Check size={20} className="text-green-500" />
          ) : (
            <Copy size={20} className="text-gray-400 group-hover:text-violet-500 transition-colors" />
          )}
        </motion.button>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Click to copy code</p>

        {/* Loading/Pulsing status */}
        <div className="flex gap-1.5 justify-center mt-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
