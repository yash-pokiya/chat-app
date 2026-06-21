import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
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
import AdminDashboard from './pages/AdminDashboard';
import useOnlineStatus from './hooks/useOnlineStatus';
import useFriendStatus from './hooks/useFriendStatus';
import useFriendRequests from './hooks/useFriendRequests.jsx';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return children;
};

const AdminProtectedRoute = ({ children }) => {
  const adminToken = localStorage.getItem('adminToken');
  return adminToken ? children : <Navigate to="/" replace />;
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
            className: 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-xl font-medium text-sm px-4 py-3 max-w-[92vw] !font-sans',
            success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
          }}
        >
          {(t) => (
            <ToastBar toast={t}>
              {({ icon, message }) => (
                <>
                  {icon}
                  {message}
                  {t.type !== 'loading' && (
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      className="ml-2 p-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors flex items-center justify-center flex-shrink-0"
                      style={{ fontSize: '11px', width: '20px', height: '20px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  )}
                </>
              )}
            </ToastBar>
          )}
        </Toaster>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
