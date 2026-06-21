import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { CallProvider } from './context/CallContext';
import { ConversationProvider } from './context/ConversationContext';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Waiting from './pages/Waiting';
import DMChat from './pages/DMChat';
import Profile from './pages/Profile';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import useOnlineStatus from './hooks/useOnlineStatus';
import useFriendStatus from './hooks/useFriendStatus';
import useFriendRequests from './hooks/useFriendRequests.jsx';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  return user ? children : <Navigate to="/" replace />;
};

const AdminProtectedRoute = ({ children }) => {
  const adminToken = localStorage.getItem('adminToken');
  return adminToken ? children : <Navigate to="/admin/login" replace />;
};

function AppRoutes() {
  const location = useLocation();
  const { socket } = useSocket();
  const { user } = useAuth();

  useOnlineStatus({ socket, user });
  useFriendStatus({ socket });
  useFriendRequests({ socket, currentUser: user });

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/chat/:roomCode" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/waiting/:roomCode" element={<ProtectedRoute><Waiting /></ProtectedRoute>} />
        <Route path="/dm/:dmId" element={<ProtectedRoute><DMChat /></ProtectedRoute>} />
        <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <ConversationProvider>
              <NotificationProvider>
                <AppRoutes />
              </NotificationProvider>
            </ConversationProvider>
          </CallProvider>
        </SocketProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: '#ffffff',
              color: '#1A1A2E',
              border: '1px solid #E5E7EB',
              borderRadius: '14px',
              boxShadow: '0 8px 32px rgba(108, 99, 255, 0.12)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              fontWeight: '500',
              padding: '12px 16px',
              maxWidth: '92vw',
            },
            success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
