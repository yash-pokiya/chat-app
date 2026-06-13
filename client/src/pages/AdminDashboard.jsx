import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import StatsCard from '../components/admin/StatsCard';
import AdminTable from '../components/admin/AdminTable';
import { MessagesLineChart, MessagesDayChart } from '../components/admin/Charts';
import {
  Shield, LogOut, RefreshCw, Trash2, Ban, CheckCircle,
  LayoutDashboard, Hash, Image, Users, Activity, Loader2,
  TrendingUp, MessageSquare, Menu, X
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview',  icon: LayoutDashboard },
  { id: 'rooms',    label: 'Rooms',     icon: Hash },
  { id: 'media',    label: 'Media',     icon: Image },
  { id: 'users',    label: 'Users',     icon: Users },
];

const fmtDate  = (d) => d ? new Date(d).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const fmtBytes = (b) => !b ? '0B' : b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(2)}MB`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab]         = useState('overview');
  const [stats, setStats]     = useState(null);
  const [rooms, setRooms]     = useState([]);
  const [media, setMedia]     = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('adminToken')}` });

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) { navigate('/admin/login'); return; }
      const h = { headers: { Authorization: `Bearer ${token}` } };
      const [s, r, m, u] = await Promise.all([
        api.get('/admin/stats', h),
        api.get('/admin/rooms', h),
        api.get('/admin/media', h),
        api.get('/admin/users', h),
      ]);
      setStats(s.data);
      setRooms(r.data.rooms || []);
      setMedia(m.data.media || []);
      setUsers(u.data.users || []);
    } catch (err) {
      if (err.message?.includes('401') || err.message?.includes('Invalid')) {
        toast.error('Session expired.');
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
      } else toast.error('Failed to load dashboard.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleLogout = async () => {
    try { await api.post('/admin/logout', {}, { headers: authHeader() }); } catch {}
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const deleteRoom = async (id) => {
    if (!confirm('Delete this room and all its messages?')) return;
    try {
      await api.delete(`/admin/rooms/${id}`, { headers: authHeader() });
      setRooms((r) => r.filter((x) => x.id !== id));
      toast.success('Room deleted.');
    } catch (err) { toast.error(err.message); }
  };

  const deleteMedia = async (id) => {
    if (!confirm('Delete this media file?')) return;
    try {
      await api.delete(`/admin/media/${id}`, { headers: authHeader() });
      setMedia((m) => m.filter((x) => x._id !== id));
      toast.success('Media deleted.');
    } catch (err) { toast.error(err.message); }
  };

  const banUser = async (id, ban) => {
    if (!confirm(`${ban ? 'Ban' : 'Unban'} this user?`)) return;
    try {
      await api.post(`/admin/users/${id}/${ban ? 'ban' : 'unban'}`, {}, { headers: authHeader() });
      setUsers((u) => u.map((x) => x._id === id ? { ...x, isBanned: ban } : x));
      toast.success(`User ${ban ? 'banned' : 'unbanned'}.`);
    } catch (err) { toast.error(err.message); }
  };

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-surface border-r border-border">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-brand">
            <Shield size={17} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-ink text-sm">SecureChat</p>
            <p className="label-caps">Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setSidebarOpen(false); }}
            className={`nav-item w-full ${tab === id ? 'active' : ''}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1.5">
        <button onClick={() => fetchAll(true)} disabled={refreshing} className="btn-ghost w-full text-xs py-2">
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh Data
        </button>
        <button onClick={handleLogout} className="btn-danger w-full justify-center">
          <LogOut size={13} /> Sign Out
        </button>
      </div>
    </aside>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-soft flex items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-ink-muted text-sm">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface-soft overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-56 shrink-0">
        <div className="w-full"><Sidebar /></div>
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink/20 z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-56 z-50 md:hidden shadow-xl"
            >
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="frosted-bar px-5 py-3.5 flex items-center gap-3 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-ink-muted hover:bg-surface-soft transition-colors">
            <Menu size={18} />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-ink text-base capitalize">
              {TABS.find((t) => t.id === tab)?.label}
            </h1>
            <p className="text-xs text-ink-muted">
              {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button onClick={() => fetchAll(true)} disabled={refreshing} className="btn-ghost text-xs py-2 hidden sm:flex">
            {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh
          </button>
          <button onClick={handleLogout} className="btn-danger hidden sm:flex">
            <LogOut size={13} /> Logout
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >

              {/* ── OVERVIEW ── */}
              {tab === 'overview' && (
                <div className="space-y-5">
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard icon="🏠" label="Active Rooms" value={stats?.stats?.activeRooms}
                      sub="Currently open" gradient="from-brand-500 to-cyan-400" />
                    <StatsCard icon="💬" label="Messages Today" value={stats?.stats?.messagesToday}
                      sub={`${stats?.stats?.totalMessages} total`} gradient="from-blue-500 to-indigo-400" />
                    <StatsCard icon="🖼️" label="Media Today" value={stats?.stats?.mediaToday}
                      sub={`${stats?.stats?.totalMedia} total`} gradient="from-amber-500 to-orange-400" />
                    <StatsCard icon="👤" label="Total Users" value={stats?.stats?.totalUsers}
                      sub="Registered" gradient="from-emerald-500 to-teal-400" />
                  </div>

                  {/* Charts */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="card p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
                          <Activity size={14} className="text-brand-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-ink text-sm">Messages / Hour</h3>
                          <p className="text-xs text-ink-faint">Last 24 hours</p>
                        </div>
                      </div>
                      <MessagesLineChart data={stats?.charts?.messagesPerHour} />
                    </div>
                    <div className="card p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                          <TrendingUp size={14} className="text-indigo-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-ink text-sm">Messages / Day</h3>
                          <p className="text-xs text-ink-faint">Last 7 days</p>
                        </div>
                      </div>
                      <MessagesDayChart data={stats?.charts?.messagesPerDay} />
                    </div>
                  </div>

                  {/* Secondary stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <StatsCard icon="📊" label="Total Rooms"    value={stats?.stats?.totalRooms}    gradient="from-pink-500 to-rose-400" />
                    <StatsCard icon="✉️" label="Total Messages" value={stats?.stats?.totalMessages} gradient="from-violet-500 to-brand-400" />
                    <StatsCard icon="📁" label="Total Media"    value={stats?.stats?.totalMedia}    gradient="from-cyan-500 to-blue-400" />
                  </div>
                </div>
              )}

              {/* ── ROOMS ── */}
              {tab === 'rooms' && (
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                      <Hash size={15} className="text-brand-500" />
                    </div>
                    <div>
                      <h2 className="font-bold text-ink">Chat Rooms</h2>
                      <p className="text-xs text-ink-faint">{rooms.length} total rooms</p>
                    </div>
                  </div>
                  <AdminTable
                    columns={[
                      { key: 'code', label: 'Code', render: (v) =>
                        <span className="font-mono font-bold text-brand-500 bg-brand-50 px-2 py-0.5 rounded-lg text-xs">#{v}</span> },
                      { key: 'users', label: 'Members', render: (v) =>
                        <div className="flex gap-1">{(v || []).map((u) => (
                          <span key={u.id} className="bg-surface-muted text-ink-muted text-xs px-2 py-0.5 rounded-full">@{u.username}</span>
                        ))}</div> },
                      { key: 'messageCount', label: 'Messages' },
                      { key: 'isActive', label: 'Status', render: (v) =>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v ? 'bg-success/10 text-success' : 'bg-surface-muted text-ink-faint'}`}>
                          {v ? '● Active' : '○ Closed'}
                        </span> },
                      { key: 'createdAt', label: 'Created', render: (v) => fmtDate(v) },
                      { key: 'expiresAt', label: 'Expires', render: (v) => fmtDate(v) },
                    ]}
                    data={rooms}
                    actions={(row) => (
                      <button onClick={() => deleteRoom(row.id)} className="btn-danger">
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  />
                </div>
              )}

              {/* ── MEDIA ── */}
              {tab === 'media' && (
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Image size={15} className="text-amber-500" />
                    </div>
                    <div>
                      <h2 className="font-bold text-ink">Media Uploads</h2>
                      <p className="text-xs text-ink-faint">{media.length} files</p>
                    </div>
                  </div>
                  <AdminTable
                    columns={[
                      { key: 'filename', label: 'Filename' },
                      { key: 'uploaderName', label: 'Uploader', render: (v) =>
                        <span className="text-ink font-medium">@{v}</span> },
                      { key: 'roomCode', label: 'Room', render: (v) =>
                        <span className="font-mono font-bold text-brand-500 text-xs">#{v}</span> },
                      { key: 'fileSize', label: 'Size', render: (v) => fmtBytes(v) },
                      { key: 'cloudinaryUrl', label: 'Preview', render: (v) =>
                        <a href={v} target="_blank" rel="noreferrer"
                          className="text-brand-500 hover:underline text-xs font-medium">
                          View ↗
                        </a> },
                      { key: 'uploadedAt', label: 'Uploaded', render: (v) => fmtDate(v) },
                    ]}
                    data={media}
                    actions={(row) => (
                      <button onClick={() => deleteMedia(row._id)} className="btn-danger">
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  />
                </div>
              )}

              {/* ── USERS ── */}
              {tab === 'users' && (
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <Users size={15} className="text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-ink">Users</h2>
                      <p className="text-xs text-ink-faint">{users.length} registered</p>
                    </div>
                  </div>
                  <AdminTable
                    columns={[
                      { key: 'username', label: 'Username', render: (v) =>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-bold uppercase">
                            {v[0]}
                          </div>
                          <span className="font-medium text-ink">@{v}</span>
                        </div> },
                      { key: 'isBanned', label: 'Status', render: (v) =>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${v ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                          {v ? '🚫 Banned' : '✓ Active'}
                        </span> },
                      { key: 'lastIP', label: 'Last IP', render: (v) =>
                        <span className="font-mono text-xs text-ink-muted">{v || '—'}</span> },
                      { key: 'createdAt', label: 'Joined', render: (v) => fmtDate(v) },
                    ]}
                    data={users}
                    actions={(row) => (
                      row.isBanned ? (
                        <button onClick={() => banUser(row._id, false)} className="btn-ghost text-xs py-1.5 px-3">
                          <CheckCircle size={12} className="text-success" /> Unban
                        </button>
                      ) : (
                        <button onClick={() => banUser(row._id, true)} className="btn-warn">
                          <Ban size={12} /> Ban
                        </button>
                      )
                    )}
                  />
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
