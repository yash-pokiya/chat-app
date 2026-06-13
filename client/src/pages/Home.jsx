import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotifications } from '../context/NotificationContext';
import { useConversations } from '../context/ConversationContext';
import toast from 'react-hot-toast';
import {
  ArrowRight, Shuffle, Eye, EyeOff, LogIn, UserPlus, Lock, User as UserIcon,
  Sun, Moon, Search, Bell, MessageSquare, Shield, Check, X, ChevronRight
} from 'lucide-react';
import api from '../utils/api';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -20, transition: { duration: 0.2 } }
};

function Avatar({ user, size = 10 }) {
  const cls = `w-${size} h-${size} rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0`;
  if (user.avatar) return <img src={user.avatar} className={`${cls} object-cover rounded-xl`} alt={user.displayName} />;
  return <div className={`${cls} bg-gradient-to-br from-violet-500 to-cyan-400 text-sm`}>{(user.displayName || user.username)[0].toUpperCase()}</div>;
}

export default function Home() {
  const { user, register, login } = useAuth();
  const { socket } = useSocket();
  const { pendingRequests, pendingCount, removeFromPending } = useNotifications();
  const { friends, markAsRead, refreshFriends } = useConversations();
  const navigate = useNavigate();

  const [tab, setTab] = useState('login');
  const [mainTab, setMainTab] = useState('messages');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [roomCode, setRoomCode] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const searchRef = useRef(null);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  // (friends list is now managed by ConversationContext)

  // Anonymous room socket events
  useEffect(() => {
    localStorage.removeItem('currentRoom');
    sessionStorage.removeItem('currentRoom');
    if (!socket) return;

    const onRoomWaiting = ({ roomCode }) => { setJoinLoading(false); navigate(`/waiting/${roomCode}`); };
    const onRoomJoined  = ({ roomCode }) => { setJoinLoading(false); navigate(`/chat/${roomCode}`); };
    const onRoomFull    = ({ message }) => { setJoinLoading(false); setError(message); };

    socket.on('room:waiting', onRoomWaiting);
    socket.on('room:joined',  onRoomJoined);
    socket.on('room:full',    onRoomFull);
    return () => {
      socket.off('room:waiting', onRoomWaiting);
      socket.off('room:joined',  onRoomJoined);
      socket.off('room:full',    onRoomFull);
    };
  }, [socket, navigate]);

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(searchQuery.replace('@',''))}`);
        if (data.success) setSearchResults(data.users);
      } catch {} finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return toast.error('Fill in both fields.');
    setAuthLoading(true);
    try {
      const fn = tab === 'register' ? register : login;
      const data = await fn(username.trim().toLowerCase(), password);
      if (data.success) toast.success(tab === 'register' ? 'Account created! 🎉' : `Welcome back, @${data.user.username}!`);
    } catch (err) { toast.error(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleJoinRoom = () => {
    const codeStr = roomCode.join('').trim();
    if (codeStr.length !== 4) { setError('Please enter a 4-character room code'); return; }
    if (!user) { setError('Sign in first to join a room'); return; }
    if (!socket) { setError('Socket connection offline. Please reload.'); return; }
    setError(''); setJoinLoading(true);
    socket.emit('joinRoom', { roomCode: codeStr.toUpperCase(), username: user?.username || 'Anonymous' });
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]);
    setRoomCode(code); setError('');
    setTimeout(() => document.getElementById('code-3')?.focus(), 50);
  };

  const handleInputChange = (i, val) => {
    const sanitized = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newCode = [...roomCode];
    if (!sanitized) { newCode[i] = ''; setRoomCode(newCode); return; }
    newCode[i] = sanitized.slice(-1);
    setRoomCode(newCode); setError('');
    if (i < 3) document.getElementById(`code-${i + 1}`)?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !roomCode[i] && i > 0) {
      const newCode = [...roomCode]; newCode[i - 1] = '';
      setRoomCode(newCode); document.getElementById(`code-${i - 1}`)?.focus();
    }
  };

  const handlePaste = (e) => {
    const pastedData = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (pastedData) {
      const newCode = ['', '', '', ''];
      for (let j = 0; j < pastedData.length; j++) newCode[j] = pastedData[j];
      setRoomCode(newCode); setError('');
      document.getElementById(`code-${Math.min(pastedData.length, 3)}`)?.focus();
    }
    e.preventDefault();
  };

  const handleAcceptRequest = async (fromUserId) => {
    try {
      const { data } = await api.post(`/friends/accept/${fromUserId}`);
      if (data.success) {
        socket?.emit('friend:accept', { fromUserId });
        removeFromPending(fromUserId);
        toast.success('Friend request accepted! 🎉');
        refreshFriends();
      }
    } catch (err) { toast.error(err.message); }
  };

  const handleDeclineRequest = async (fromUserId) => {
    try {
      await api.delete(`/friends/decline/${fromUserId}`);
      removeFromPending(fromUserId);
      toast.success('Request declined.');
    } catch (err) { toast.error(err.message); }
  };

  const openDM = async (friend) => {
    if (friend.dmId) {
      markAsRead(friend.dmId);
      navigate(`/dm/${friend.dmId}?partner=${friend.username}`);
      return;
    }
    try {
      const { data } = await api.get(`/dm/${friend.id}`);
      if (data.success) {
        markAsRead(data.dm._id);
        navigate(`/dm/${data.dm._id}?partner=${friend.username}`);
      }
    } catch (err) { toast.error(err.message); }
  };

  return (
    <motion.div
      variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="min-h-screen bg-white dark:bg-gray-950 overflow-hidden relative flex flex-col items-center justify-center p-4 transition-colors duration-300"
    >
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-gradient opacity-[0.07] dark:opacity-[0.03] animate-blob" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-cyan-400 opacity-[0.07] dark:opacity-[0.03] animate-blob-delay" />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-brand-400 opacity-[0.06] dark:opacity-[0.02] animate-blob-delay2" />
      </div>

      {/* Top bar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowNotif(!showNotif)}
              className="relative p-3 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 shadow-sm hover:scale-105 transition-transform"
            >
              <Bell size={18} />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            <AnimatePresence>
              {showNotif && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 top-14 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">Friend Requests</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {pendingRequests.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-sm">No pending requests</div>
                    ) : pendingRequests.map((req) => (
                      <div key={req._id || req.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-cyan-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(req.displayName || req.username)[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{req.displayName || req.username}</p>
                          <p className="text-xs text-gray-400">@{req.username}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleAcceptRequest(req._id || req.id)}
                            className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-100 transition-colors">
                            <Check size={14} />
                          </button>
                          <button onClick={() => handleDeclineRequest(req._id || req.id)}
                            className="w-8 h-8 bg-red-50 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        <button onClick={toggleTheme} className="p-3 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 shadow-sm hover:scale-105 transition-transform">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-brand-900/30 text-brand-500 dark:text-brand-400 px-4 py-1.5 rounded-full text-xs font-semibold mb-5 border border-brand-100 dark:border-brand-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Private · Real-time · Social
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 leading-tight mb-3">
            Chat Privately.<br />
            <span className="text-brand-gradient">No Traces.</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base">
            Message friends, share locations, and connect — securely.
          </p>
        </div>

        <div className="glass-card dark:bg-gray-900/70 dark:border-gray-800 rounded-3xl p-7 shadow-lg border border-gray-100">

          {/* Auth section */}
          {!user ? (
            <div className="mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex bg-gray-50 dark:bg-gray-800 rounded-2xl p-1 mb-5">
                {['login', 'register'].map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize ${
                      tab === t ? 'bg-white dark:bg-gray-900 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}>
                    {t === 'login' ? <LogIn size={14}/> : <UserPlus size={14}/>} {t}
                  </button>
                ))}
              </div>
              <form onSubmit={handleAuth} className="flex flex-col gap-3">
                <div className="relative">
                  <UserIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username" className="field pl-10 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 dark:border-gray-700" autoComplete="username" maxLength={20} />
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input id="password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password" className="field pl-10 pr-10 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 dark:border-gray-700"
                    autoComplete={tab === 'register' ? 'new-password' : 'current-password'} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
                <motion.button type="submit" disabled={authLoading} whileTap={{ scale: 0.97 }} className="btn-brand w-full mt-1">
                  {authLoading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <>{tab === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={15}/></>
                  }
                </motion.button>
              </form>
            </div>
          ) : (
            <>
              {/* User banner */}
              <div className="mb-5 pb-5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                <Link to={`/profile/${user.username}`} className="flex-shrink-0">
                  <Avatar user={user} size={10} />
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">@{user.username}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="online-dot shrink-0" />
                  <span className="text-xs text-emerald-500 font-medium">Online</span>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative mb-4">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text" value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search @username..."
                  className="field pl-10 w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 dark:border-gray-700"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Search results */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 space-y-2 overflow-hidden"
                  >
                    {searchResults.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-cyan-400 flex items-center justify-center text-white text-sm font-bold">
                            {(u.displayName || u.username)[0].toUpperCase()}
                          </div>
                          {u.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{u.displayName || u.username}</p>
                          <p className="text-xs text-gray-400">@{u.username}{u.mutualFriendsCount > 0 ? ` · ${u.mutualFriendsCount} mutual` : ''}</p>
                        </div>
                        <Link to={`/profile/${u.username}`}>
                          <ChevronRight size={14} className="text-gray-400" />
                        </Link>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main tabs — Messages vs Anonymous */}
              <div className="flex bg-gray-50 dark:bg-gray-800 rounded-2xl p-1 mb-5">
                {[
                  { id: 'messages', icon: <MessageSquare size={13}/>, label: '💬 Messages' },
                  { id: 'anonymous', icon: <Shield size={13}/>, label: '🔒 Anonymous' },
                ].map((t) => (
                  <button key={t.id} onClick={() => setMainTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      mainTab === t.id ? 'bg-white dark:bg-gray-900 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* MESSAGES TAB */}
          {user && mainTab === 'messages' && (
            <div className="space-y-2">
              {friends.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <MessageSquare size={22} className="text-violet-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">No messages yet</p>
                  <p className="text-gray-400 text-xs mt-1">Search for friends to start chatting!</p>
                </div>
              ) : friends.map((friend) => (
                <motion.button
                  key={friend.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openDM(friend)}
                  className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-100 dark:border-gray-700 text-left"
                >
                  <div className="relative flex-shrink-0">
                    <Avatar user={friend} size={10} />
                    {friend.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{friend.displayName || friend.username}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {friend.lastMessage ? friend.lastMessage.content : 'Start chatting!'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {friend.lastMessage?.createdAt && (
                      <span className="text-xs text-gray-300">
                        {new Date(friend.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {friend.unreadCount > 0 && (
                      <span className="w-5 h-5 bg-violet-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {friend.unreadCount > 9 ? '9+' : friend.unreadCount}
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {/* ANONYMOUS TAB (existing room code UI preserved) */}
          {(!user || mainTab === 'anonymous') && (
            <div className="flex flex-col">
              <p className="label-caps mb-3 text-center dark:text-gray-400">Enter Room Code</p>
              <div className="flex gap-3 justify-center mb-4">
                {[0, 1, 2, 3].map((i) => (
                  <input key={i} type="text" maxLength={1} value={roomCode[i] || ''}
                    onChange={(e) => handleInputChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    id={`code-${i}`} disabled={!user}
                    className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-violet-500 focus:outline-none focus:bg-violet-50/50 dark:focus:bg-violet-900/30 transition-all text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 disabled:opacity-50"
                  />
                ))}
              </div>
              {error && <p className="text-red-500 text-sm text-center mb-3 font-medium">{error}</p>}
              <button onClick={generateCode} disabled={!user}
                className="text-violet-500 dark:text-violet-400 text-sm mx-auto flex items-center gap-1.5 mb-4 hover:underline disabled:opacity-50 font-medium">
                <Shuffle size={14} /> Generate random code
              </button>
              <button onClick={handleJoinRoom} disabled={joinLoading || !user}
                className="w-full py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-violet-500 to-cyan-400 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 shadow-md hover:shadow-lg">
                {joinLoading ? 'Joining...' : 'Join Anonymous Room →'}
              </button>
              {!user && <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">Sign in above to join a room</p>}
            </div>
          )}
        </div>

        {/* Feature pills */}
        <div className="flex gap-2 mt-5 justify-center flex-wrap">
          {['🔒 E2E Secure', '⚡ Real-time', '📍 Live Location', '📹 Video Calls', '🗑️ 24h Auto-delete'].map((f) => (
            <span key={f} className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-full text-xs text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-800 font-medium">{f}</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
