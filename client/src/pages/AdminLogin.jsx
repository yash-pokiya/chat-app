import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { Shield, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) return toast.error('Fill in all fields.');
    setLoading(true);
    try {
      const { data } = await api.post('/admin/login', { username, password });
      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        toast.success('Welcome, Admin!');
        navigate('/admin');
      }
    } catch (err) {
      toast.error(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-soft flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full opacity-[0.06] animate-blob"
        style={{ background: 'linear-gradient(135deg, #6C63FF, #48CAE4)' }} />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-brand-200 opacity-[0.07] animate-blob-delay" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="card p-8">
          {/* Header */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-gradient mb-4 shadow-brand">
              <Shield size={24} className="text-white" />
            </div>
            <p className="label-caps mb-1">Admin Portal</p>
            <h1 className="text-2xl font-bold text-ink">Sign in</h1>
            <p className="text-ink-muted text-sm mt-1">Restricted access — administrators only</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                id="admin-username" type="text" value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin username"
                className="field pl-10" autoComplete="username"
              />
            </div>

            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                id="admin-password" type={showPw ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password" className="field pl-10 pr-10"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <motion.button
              type="submit" disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="btn-brand w-full mt-1"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <>Sign In to Admin <ArrowRight size={15} /></>
              }
            </motion.button>
          </form>

          <p className="text-center text-xs text-ink-faint mt-6">
            All admin actions are logged and monitored.
          </p>
        </div>

        <p className="text-center text-xs text-ink-faint mt-4">
          <a href="/" className="hover:text-brand-500 transition-colors">← Back to app</a>
        </p>
      </motion.div>
    </div>
  );
}
