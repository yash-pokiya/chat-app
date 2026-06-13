import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import { ArrowRight, Shuffle, Eye, EyeOff, LogIn, UserPlus, Lock, User, Sun, Moon } from 'lucide-react';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -20, transition: { duration: 0.2 } }
};

export default function Home() {
  const { user, register, login } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [tab, setTab]           = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [roomCode, setRoomCode] = useState(['', '', '', '']);
  const [error, setError]       = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [theme, setTheme]       = useState(localStorage.getItem('theme') || 'light');

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

  useEffect(() => {
    // Clear any old room state
    localStorage.removeItem('currentRoom');
    sessionStorage.removeItem('currentRoom');

    if (!socket) return;

    const onRoomWaiting = ({ roomCode }) => {
      setJoinLoading(false);
      navigate(`/waiting/${roomCode}`);
    };

    const onRoomJoined = ({ roomCode }) => {
      setJoinLoading(false);
      navigate(`/chat/${roomCode}`);
    };

    const onRoomFull = ({ message }) => {
      setJoinLoading(false);
      setError(message);
    };

    socket.on('room:waiting', onRoomWaiting);
    socket.on('room:joined', onRoomJoined);
    socket.on('room:full', onRoomFull);

    return () => {
      socket.off('room:waiting', onRoomWaiting);
      socket.off('room:joined', onRoomJoined);
      socket.off('room:full', onRoomFull);
    };
  }, [socket, navigate]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return toast.error('Fill in both fields.');
    setAuthLoading(true);
    try {
      const fn = tab === 'register' ? register : login;
      const data = await fn(username.trim().toLowerCase(), password);
      if (data.success) {
        toast.success(tab === 'register' ? 'Account created! 🎉' : `Welcome back, @${data.user.username}!`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleJoinRoom = () => {
    const codeStr = roomCode.join('').trim();
    if (codeStr.length !== 4) {
      setError('Please enter a 4-character room code');
      return;
    }
    if (!user) {
      setError('Sign in first to join a room');
      return;
    }
    if (!socket) {
      setError('Socket connection offline. Please reload.');
      return;
    }
    setError('');
    setJoinLoading(true);
    socket.emit('joinRoom', {
      roomCode: codeStr.toUpperCase(),
      username: user?.username || 'Anonymous'
    });
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    );
    setRoomCode(code);
    setError('');
    // Focus the last input box after generating
    setTimeout(() => {
      document.getElementById('code-3')?.focus();
    }, 50);
  };

  const handleInputChange = (i, val) => {
    const sanitized = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newCode = [...roomCode];
    if (!sanitized) {
      newCode[i] = '';
      setRoomCode(newCode);
      return;
    }

    newCode[i] = sanitized.slice(-1);
    setRoomCode(newCode);
    setError('');

    if (i < 3) {
      document.getElementById(`code-${i + 1}`)?.focus();
    }
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      if (!roomCode[i] && i > 0) {
        const newCode = [...roomCode];
        newCode[i - 1] = '';
        setRoomCode(newCode);
        document.getElementById(`code-${i - 1}`)?.focus();
      }
    }
  };

  const handlePaste = (e) => {
    const pastedData = e.clipboardData.getData('text')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4);

    if (pastedData) {
      const newCode = ['', '', '', ''];
      for (let j = 0; j < pastedData.length; j++) {
        newCode[j] = pastedData[j];
      }
      setRoomCode(newCode);
      setError('');
      const focusIndex = Math.min(pastedData.length, 3);
      document.getElementById(`code-${focusIndex}`)?.focus();
    }
    e.preventDefault();
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-white dark:bg-gray-950 overflow-hidden relative flex flex-col items-center justify-center p-4 transition-colors duration-300"
    >
      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 shadow-sm hover:scale-105 transition-transform"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {/* ── Animated background blobs ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-gradient opacity-[0.07] dark:opacity-[0.03] animate-blob" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-cyan-400 opacity-[0.07] dark:opacity-[0.03] animate-blob-delay" />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-brand-400 opacity-[0.06] dark:opacity-[0.02] animate-blob-delay2" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* ── Hero heading ── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-brand-900/30 text-brand-500 dark:text-brand-400 px-4 py-1.5 rounded-full text-xs font-semibold mb-5 border border-brand-100 dark:border-brand-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Private · Encrypted · 24h Auto-delete
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 leading-tight mb-3">
            Chat Privately.<br />
            <span className="text-brand-gradient">No Traces.</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base">
            Share a code. Connect instantly. No accounts needed if you don't want one.
          </p>
        </div>

        {/* ── Glass card ── */}
        <div className="glass-card dark:bg-gray-900/70 dark:border-gray-800 rounded-3xl p-7 shadow-lg border border-gray-100">
          {/* ── Auth section ── */}
          {!user ? (
            <div className="mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
              {/* Tab switcher */}
              <div className="flex bg-gray-50 dark:bg-gray-800 rounded-2xl p-1 mb-5">
                {['login', 'register'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize
                      ${tab === t
                        ? 'bg-white dark:bg-gray-900 text-violet-600 dark:text-violet-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                  >
                    {t === 'login' ? <LogIn size={14}/> : <UserPlus size={14}/>} {t}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAuth} className="flex flex-col gap-3">
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  <input
                    id="username" type="text" value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className="field pl-10 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 dark:border-gray-700" autoComplete="username" maxLength={20}
                  />
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  <input
                    id="password" type={showPw ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password" className="field pl-10 pr-10 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 dark:border-gray-700"
                    autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
                <motion.button
                  type="submit" disabled={authLoading}
                  whileTap={{ scale: 0.97 }}
                  className="btn-brand w-full mt-1"
                >
                  {authLoading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <>{tab === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={15}/></>
                  }
                </motion.button>
              </form>
            </div>
          ) : (
            <div className="mb-5 pb-5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center text-white font-bold text-sm uppercase shrink-0 shadow-md">
                {user.username[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">@{user.username}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="online-dot shrink-0" />
                <span className="text-xs text-emerald-500 font-medium">Online</span>
              </div>
            </div>
          )}

          {/* ── Room code join ── */}
          <div className="flex flex-col">
            <p className="label-caps mb-3 text-center dark:text-gray-400">Enter Room Code</p>

            {/* Code Input — 4 separate boxes */}
            <div className="flex gap-3 justify-center mb-4">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  type="text"
                  maxLength={1}
                  value={roomCode[i] || ''}
                  onChange={(e) => handleInputChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  id={`code-${i}`}
                  disabled={!user}
                  className="w-14 h-14 text-center text-2xl font-bold 
                             border-2 border-gray-200 dark:border-gray-700 rounded-xl
                             focus:border-violet-500 focus:outline-none
                             focus:bg-violet-50/50 dark:focus:bg-violet-900/30 transition-all text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 disabled:opacity-50"
                />
              ))}
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center mb-3 font-medium">{error}</p>
            )}

            <button
              onClick={generateCode}
              disabled={!user}
              className="text-violet-500 dark:text-violet-400 text-sm mx-auto flex items-center gap-1.5 mb-4 hover:underline disabled:opacity-50 font-medium"
            >
              <Shuffle size={14} /> Generate random code
            </button>

            <button
              onClick={handleJoinRoom}
              disabled={joinLoading || !user}
              className="w-full py-3 rounded-xl text-white font-semibold
                         bg-gradient-to-r from-violet-500 to-cyan-400
                         hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              {joinLoading ? 'Joining...' : 'Join Room →'}
            </button>

            {!user && (
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">Sign in above to join a room</p>
            )}
          </div>
        </div>

        {/* ── Feature pills ── */}
        <div className="flex gap-2 mt-5 justify-center flex-wrap">
          {['🔒 JWT Secured', '⚡ Real-time', '🗑️ 24h Auto-delete', '📸 Image Sharing'].map((f) => (
            <span key={f} className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-full text-xs text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-800 font-medium">
              {f}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
