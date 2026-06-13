import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MicOff, Mic, VideoOff, Video, PhoneOff, FlipHorizontal, Volume2, VolumeX } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';

export default function VideoCall() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [callTypeLocal, setCallTypeLocal] = useState('video');
  const [remoteUserInfo, setRemoteUserInfo] = useState(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [facingMode, setFacingMode] = useState('user');

  const {
    callState, localStream, remoteStream,
    callDuration, isMuted, isCameraOff,
    localVideoRef, remoteVideoRef,
    initiateCall, endCall, toggleMute, toggleCamera, formatDuration,
  } = useCall();

  useEffect(() => {
    // Get call type from query params
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') || 'video';
    const targetUsername = params.get('username') || '';
    setCallTypeLocal(type);
    setRemoteUserInfo({ id: userId, username: targetUsername, displayName: targetUsername });
    initiateCall({ id: userId, username: targetUsername, displayName: targetUsername }, type);
  }, []);

  const handleEnd = () => {
    endCall(userId, callTypeLocal);
    navigate(-1);
  };

  const handleFlipCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    // In a real implementation, this would switch camera tracks
  };

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col">
      {/* Remote video / audio display */}
      {callTypeLocal === 'video' ? (
        <video
          ref={remoteVideoRef}
          autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-900 to-gray-900">
          {/* Audio call avatar with pulse rings */}
          <div className="relative">
            {[1, 2, 3].map((i) => (
              <div key={i} className="absolute rounded-full bg-emerald-400/10 border border-emerald-400/20"
                style={{ width: 120 + i * 50, height: 120 + i * 50, top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  animation: `pulseRing ${1.2 + i * 0.4}s ease-out infinite`, animationDelay: `${i * 0.2}s` }} />
            ))}
            <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white font-bold text-5xl z-10 shadow-2xl">
              {(remoteUserInfo?.displayName || remoteUserInfo?.username || '?')[0].toUpperCase()}
            </div>
          </div>
        </div>
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {/* Top info */}
      <div className="relative z-10 px-6 pt-safe pt-12 text-center">
        <p className="text-white font-semibold text-lg drop-shadow">
          {remoteUserInfo?.displayName || remoteUserInfo?.username || 'Connecting...'}
        </p>
        <p className="text-white/70 text-sm mt-1">
          {callState === 'ringing' ? '📞 Ringing...' : callState === 'active' ? formatDuration(callDuration) : callState}
        </p>
      </div>

      {/* Local video PiP */}
      {callTypeLocal === 'video' && localStream && (
        <motion.div
          drag dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          className="absolute bottom-36 right-4 w-24 h-36 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 z-20 cursor-move"
        >
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </motion.div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 inset-x-0 z-10 pb-10 px-8">
        <div className="flex items-center justify-center gap-5">
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
              isMuted ? 'bg-red-500 text-white' : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
            }`}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {callTypeLocal === 'video' && (
            <button
              onClick={handleFlipCamera}
              className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center shadow-lg hover:bg-white/30 active:scale-95 transition-all"
            >
              <FlipHorizontal size={22} />
            </button>
          )}

          {/* End call */}
          <button
            onClick={handleEnd}
            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-red-600 active:scale-95 transition-all"
          >
            <PhoneOff size={26} />
          </button>

          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
              !isSpeakerOn ? 'bg-red-500 text-white' : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
            }`}
          >
            {isSpeakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>

          {callTypeLocal === 'video' && (
            <button
              onClick={toggleCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
                isCameraOff ? 'bg-red-500 text-white' : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
              }`}
            >
              {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
