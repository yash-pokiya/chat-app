import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, MessageCircle, Check, UserCheck, Clock } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';

export default function FriendCard({ user, onRelationshipChange }) {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [relationship, setRelationship] = useState(user.relationship || 'STRANGER');
  const [loading, setLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(user.isFollowingThem || false);

  const handleAddFriend = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/friends/request/${user.username}`);
      if (data.success) {
        setRelationship('PENDING_SENT');
        socket?.emit('friend:request', { toUsername: user.username });
        toast.success(`Friend request sent to @${user.username}!`);
        onRelationshipChange?.('PENDING_SENT');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        await api.delete(`/friends/unfollow/${user.id}`);
        setIsFollowing(false);
        toast.success(`Unfollowed @${user.username}`);
      } else {
        await api.post(`/friends/follow/${user.id}`);
        setIsFollowing(true);
        toast.success(`Following @${user.username}!`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = async () => {
    try {
      const { data } = await api.get(`/dm/${user.id}`);
      if (data.success) navigate(`/dm/${data.dm._id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const avatar = user.avatar
    ? <img src={user.avatar} className="w-12 h-12 rounded-2xl object-cover" alt={user.displayName} />
    : (
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white font-bold text-lg">
        {(user.displayName || user.username)[0].toUpperCase()}
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all"
    >
      <div className="relative flex-shrink-0">
        {avatar}
        {user.isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">
          {user.displayName || user.username}
        </p>
        <p className="text-xs text-gray-400 truncate">@{user.username}</p>
        {user.mutualFriendsCount > 0 && (
          <p className="text-xs text-violet-500 mt-0.5">{user.mutualFriendsCount} mutual friend{user.mutualFriendsCount > 1 ? 's' : ''}</p>
        )}
      </div>

      <div className="flex gap-1.5 flex-shrink-0">
        {relationship === 'FRIENDS' ? (
          <button onClick={handleMessage}
            className="flex items-center gap-1 px-3 py-1.5 bg-violet-50 text-violet-600 rounded-xl text-xs font-medium hover:bg-violet-100 transition-colors">
            <MessageCircle size={12} /> Message
          </button>
        ) : relationship === 'PENDING_SENT' ? (
          <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-400 rounded-xl text-xs font-medium">
            <Clock size={12} /> Pending
          </div>
        ) : relationship === 'PENDING_RECEIVED' ? (
          <button onClick={handleAddFriend} disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-medium hover:bg-emerald-100 transition-colors">
            <Check size={12} /> Accept
          </button>
        ) : (
          <button onClick={handleAddFriend} disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-violet-500 text-white rounded-xl text-xs font-medium hover:bg-violet-600 transition-colors disabled:opacity-50">
            <UserPlus size={12} /> Add
          </button>
        )}
        <button onClick={handleFollow} disabled={loading}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
            isFollowing
              ? 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          {isFollowing ? <UserCheck size={12} /> : null}
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>
    </motion.div>
  );
}
