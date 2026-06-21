import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  ArrowLeft, Camera, Edit2, Check, X, UserPlus, UserCheck, MessageCircle,
  Users, Heart, Clock, UserMinus
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import EditQuickEmojis from '../components/EditQuickEmojis';
import { OnlineDot, StatusText } from '../components/OnlineStatus';
import useFriendStore from '../store/friendStore';

export default function Profile() {
  const { username } = useParams();
  const { user: me, refreshUser } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const friends = useFriendStore((state) => state.friends);
  const pendingRequests = useFriendStore((state) => state.pendingRequests);
  const sentRequests = useFriendStore((state) => state.sentRequests);
  const { addFriend, removeFriend, removePendingRequest, addSentRequest } = useFriendStore();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showEditReactions, setShowEditReactions] = useState(false);
  const avatarInputRef = useRef(null);

  const isSelf = me?.username === username?.replace('@', '');

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/profile/${username.replace('@', '')}`);
      if (data.success) {
        setProfile(data.profile);
        setEditBio(data.profile.bio || '');
        setEditDisplayName(data.profile.displayName || '');
      }
    } catch (err) {
      toast.error('Profile not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, [username]);

  useEffect(() => {
    if (!profile) return;
    const profileId = (profile.id || profile._id)?.toString();
    if (!profileId) return;

    const isFriend = friends.some((f) => (f._id || f.id || f)?.toString() === profileId);
    if (isFriend) {
      if (profile.relationship !== 'FRIENDS') {
        setProfile((prev) => prev ? { ...prev, relationship: 'FRIENDS' } : null);
      }
      return;
    }

    const isPendingReceived = pendingRequests.some((r) => (r._id || r.id || r)?.toString() === profileId);
    if (isPendingReceived) {
      if (profile.relationship !== 'PENDING_RECEIVED') {
        setProfile((prev) => prev ? { ...prev, relationship: 'PENDING_RECEIVED' } : null);
      }
      return;
    }

    const isPendingSent = sentRequests.some((r) => (r._id || r.id || r)?.toString() === profileId);
    if (isPendingSent) {
      if (profile.relationship !== 'PENDING_SENT') {
        setProfile((prev) => prev ? { ...prev, relationship: 'PENDING_SENT' } : null);
      }
      return;
    }

    // Otherwise, stranger
    if (profile.relationship !== 'SELF' && profile.relationship !== 'STRANGER' && profile.relationship !== 'FOLLOWING' && profile.relationship !== 'FOLLOWER') {
      setProfile((prev) => prev ? { ...prev, relationship: 'STRANGER' } : null);
    }
  }, [friends, pendingRequests, sentRequests, profile?.id, profile?._id]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/profile', { displayName: editDisplayName, bio: editBio });
      if (data.success) {
        setProfile((prev) => ({ ...prev, displayName: data.user.displayName, bio: data.user.bio }));
        setIsEditing(false);
        toast.success('Profile updated!');
        refreshUser();
      }
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const { data } = await api.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.success) {
        setProfile((prev) => ({ ...prev, avatar: data.avatar }));
        toast.success('Avatar updated!');
        refreshUser();
      }
    } catch (err) { toast.error('Failed to update avatar.'); }
  };

  const handleFriendAction = async () => {
    setActionLoading(true);
    try {
      const targetUserId = profile.id || profile._id;
      if (profile.relationship === 'FRIENDS') {
        await api.delete(`/friends/remove/${targetUserId}`);
        socket?.emit('friend:unfriend', { userId: targetUserId });
        removeFriend(targetUserId);
        setProfile((prev) => ({
          ...prev,
          relationship: 'STRANGER',
          friendsCount: Math.max(0, (prev.friendsCount || 0) - 1),
        }));
        toast.success(`Removed @${profile.username} from friends`);
      } else if (profile.relationship === 'PENDING_SENT') {
        toast('Request already sent', { icon: '⏳' });
      } else if (profile.relationship === 'PENDING_RECEIVED') {
        await api.post(`/friends/accept/${targetUserId}`);
        const acceptingUser = {
          _id: me._id || me.id,
          username: me.username,
          displayName: me.displayName,
          avatar: me.avatar,
        };
        socket?.emit('friend:request:accept', {
          fromUserId: me._id || me.id,
          toUserId: targetUserId,
          acceptingUser,
        });
        addFriend(profile);
        removePendingRequest(targetUserId);
        setProfile((prev) => ({
          ...prev,
          relationship: 'FRIENDS',
          friendsCount: (prev.friendsCount || 0) + 1,
        }));
        toast.success('Friend request accepted!');
      } else {
        await api.post(`/friends/request/${profile.username}`);
        const fromUser = {
          _id: me._id || me.id,
          username: me.username,
          displayName: me.displayName,
          avatar: me.avatar,
        };
        socket?.emit('friend:request:send', {
          fromUserId: me._id || me.id,
          toUserId: targetUserId,
          fromUser,
        });
        addSentRequest(profile);
        setProfile((prev) => ({ ...prev, relationship: 'PENDING_SENT' }));
        toast.success('Friend request sent!');
      }
    } catch (err) { toast.error(err.message); }
    finally { setActionLoading(false); }
  };

  const handleFollowAction = async () => {
    setActionLoading(true);
    try {
      if (profile.isFollowingThem) {
        await api.delete(`/friends/unfollow/${profile.id}`);
        socket?.emit('follow:remove', { targetUserId: profile.id });
        setProfile((prev) => ({
          ...prev,
          isFollowingThem: false,
          followersCount: Math.max(0, (prev.followersCount || 0) - 1),
        }));
        toast.success(`Unfollowed @${profile.username}`);
      } else {
        await api.post(`/friends/follow/${profile.id}`);
        socket?.emit('follow:new', { targetUserId: profile.id });
        setProfile((prev) => ({
          ...prev,
          isFollowingThem: true,
          followersCount: (prev.followersCount || 0) + 1,
        }));
        toast.success(`Following @${profile.username}!`);
      }
    } catch (err) { toast.error(err.message); }
    finally { setActionLoading(false); }
  };

  const handleMessage = async () => {
    try {
      const { data } = await api.get(`/dm/${profile.id}`);
      if (data.success) navigate(`/dm/${data.dm._id}`);
    } catch (err) { toast.error(err.message); }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const friendBtnConfig = {
    SELF: null,
    FRIENDS: { label: 'Friends ✓', icon: <UserCheck size={14}/>, cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    PENDING_SENT: { label: 'Pending...', icon: <Clock size={14}/>, cls: 'bg-gray-50 text-gray-400 border-gray-200' },
    PENDING_RECEIVED: { label: 'Accept', icon: <Check size={14}/>, cls: 'bg-emerald-500 text-white border-emerald-500' },
    STRANGER: { label: 'Add Friend', icon: <UserPlus size={14}/>, cls: 'bg-violet-500 text-white border-violet-500' },
    FOLLOWING: { label: 'Add Friend', icon: <UserPlus size={14}/>, cls: 'bg-violet-500 text-white border-violet-500' },
    FOLLOWER: { label: 'Add Friend', icon: <UserPlus size={14}/>, cls: 'bg-violet-500 text-white border-violet-500' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="min-h-[100dvh] bg-gray-50"
    >
      {/* Header */}
      <div className="frosted-bar sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-gray-900 flex-1">@{profile.username}</h1>
        {isSelf && !isEditing && (
          <button onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-600 rounded-xl text-sm font-medium hover:bg-violet-100 transition-colors">
            <Edit2 size={13} /> Edit
          </button>
        )}
        {isSelf && isEditing && (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button onClick={handleSaveProfile} disabled={saving}
              className="px-3 py-1.5 bg-violet-500 text-white rounded-xl text-sm font-medium hover:bg-violet-600 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Profile card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          {/* Avatar */}
          <div className="flex items-start gap-5 mb-5">
            <div className="relative">
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.displayName}
                  className="w-20 h-20 rounded-2xl object-cover ring-4 ring-violet-100" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white font-bold text-3xl ring-4 ring-violet-100">
                  {(profile.displayName || profile.username)[0].toUpperCase()}
                </div>
              )}
              {isSelf && (
                <>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  <button onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 w-8 h-8 bg-violet-500 text-white rounded-xl flex items-center justify-center shadow-md hover:bg-violet-600 transition-colors">
                    <Camera size={14} />
                  </button>
                </>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full text-lg font-bold text-gray-900 border-b-2 border-violet-400 outline-none bg-transparent mb-1" maxLength={40} />
              ) : (
                <h2 className="text-xl font-bold text-gray-900">{profile.displayName || profile.username}</h2>
              )}
              <p className="text-gray-400 text-sm">@{profile.username}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <OnlineDot userId={profile.id || profile._id} size="sm" defaultOnline={profile.isOnline} className="border-0" />
                <StatusText userId={profile.id || profile._id} defaultOnline={profile.isOnline} defaultLastSeen={profile.lastSeen} />
              </div>
            </div>
          </div>

          {/* Bio */}
          {isEditing ? (
            <div className="mb-5">
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={120}
                placeholder="Write something about yourself..."
                className="w-full text-sm text-gray-700 bg-gray-50 rounded-xl p-3 outline-none resize-none border border-gray-200 focus:border-violet-300 h-20"
              />
              <p className="text-xs text-gray-400 text-right">{editBio.length}/120</p>
            </div>
          ) : profile.bio && (
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">{profile.bio}</p>
          )}

          {/* Stats row */}
          <div className="flex gap-4 mb-5 pb-5 border-b border-gray-100">
            {[
              { label: 'Friends', value: profile.friendsCount },
              { label: 'Following', value: profile.followingCount },
              { label: 'Followers', value: profile.followersCount },
            ].map((s) => (
              <div key={s.label} className="flex-1 text-center">
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Action buttons (only for other profiles) */}
          {!isSelf && (
            <div className="flex gap-2">
              {friendBtnConfig[profile.relationship] && (
                <button onClick={handleFriendAction} disabled={actionLoading}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 ${friendBtnConfig[profile.relationship].cls}`}>
                  {friendBtnConfig[profile.relationship].icon}
                  {friendBtnConfig[profile.relationship].label}
                </button>
              )}
              <button onClick={handleFollowAction} disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-all">
                <Heart size={14} className={profile.isFollowingThem ? 'text-red-500 fill-red-500' : ''} />
                {profile.isFollowingThem ? 'Following' : 'Follow'}
              </button>
              {profile.relationship === 'FRIENDS' && (
                <button onClick={handleMessage}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-500 text-white border border-violet-500 rounded-xl text-sm font-semibold hover:bg-violet-600 transition-all">
                  <MessageCircle size={14} /> Message
                </button>
              )}
            </div>
          )}

          {isSelf && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-gray-805 dark:text-gray-200">Quick Reactions</p>
                <p className="text-xs text-gray-400">Customize your 5 favorite emojis</p>
              </div>
              <button
                onClick={() => setShowEditReactions(true)}
                className="px-3 py-1.5 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-xl text-sm font-medium hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
              >
                Customize
              </button>
            </div>
          )}
        </div>

        {/* Friends grid */}
        {profile.friends?.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-violet-500" />
              <h3 className="font-bold text-gray-900 text-sm">Friends</h3>
              <span className="text-xs text-gray-400">({profile.friendsCount})</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {profile.friends.slice(0, 8).map((friend) => (
                <Link key={friend._id || friend.id} to={`/profile/${friend.username}`}
                  className="flex flex-col items-center gap-1.5 group">
                  <div className="relative">
                    {friend.avatar ? (
                      <img src={friend.avatar} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-transparent group-hover:ring-violet-300 transition-all" alt={friend.displayName} />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 to-cyan-400 flex items-center justify-center text-white font-bold ring-2 ring-transparent group-hover:ring-violet-300 transition-all">
                        {(friend.displayName || friend.username)[0].toUpperCase()}
                      </div>
                    )}
                    <OnlineDot userId={friend._id || friend.id} size="sm" defaultOnline={friend.isOnline} className="absolute -bottom-0.5 -right-0.5" />
                  </div>
                  <p className="text-xs text-gray-600 truncate w-full text-center">{friend.displayName || friend.username}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showEditReactions && (
          <EditQuickEmojis currentUser={me} onClose={() => setShowEditReactions(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
