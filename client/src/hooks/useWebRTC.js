import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useWebRTC — manages a WebRTC peer connection via simple-peer + socket signaling
 * Supports both video and audio-only calls.
 */
export const useWebRTC = ({ socket, currentUser }) => {
  const [callState, setCallState] = useState('idle'); // idle | ringing | incoming | active | ended
  const [callType, setCallType] = useState(null); // 'video' | 'audio'
  const [remoteUser, setRemoteUser] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const timerRef = useRef(null);
  const incomingSignalRef = useRef(null);

  const cleanup = useCallback(() => {
    if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
    if (localStream) { localStream.getTracks().forEach((t) => t.stop()); }
    if (timerRef.current) clearInterval(timerRef.current);
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setCallType(null);
    setRemoteUser(null);
    setCallDuration(0);
    incomingSignalRef.current = null;
  }, [localStream]);

  const startTimer = useCallback(() => {
    setCallDuration(0);
    timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
  }, []);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Initiate a call
  const initiateCall = useCallback(async (toUser, type = 'video') => {
    try {
      const constraints = type === 'video'
        ? { audio: true, video: { facingMode: 'user' } }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const SimplePeer = (await import('simple-peer')).default;
      const peer = new SimplePeer({ initiator: true, trickle: false, stream });

      peer.on('signal', (signal) => {
        socket.emit(`call:${type}:initiate`, { toUserId: toUser.id, signal });
      });

      peer.on('stream', (remote) => {
        setRemoteStream(remote);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
      });

      peer.on('error', (err) => {
        console.error('[WebRTC] Peer error:', err);
        endCall(toUser.id, type);
      });

      peer.on('close', () => cleanup());

      peerRef.current = peer;
      setCallType(type);
      setRemoteUser(toUser);
      setCallState('ringing');
    } catch (err) {
      console.error('[WebRTC] getUserMedia error:', err);
      cleanup();
    }
  }, [socket]);

  // Accept an incoming call
  const acceptCall = useCallback(async (fromUser, type, incomingSignal) => {
    try {
      const constraints = type === 'video'
        ? { audio: true, video: { facingMode: 'user' } }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const SimplePeer = (await import('simple-peer')).default;
      const peer = new SimplePeer({ initiator: false, trickle: false, stream });

      peer.signal(incomingSignal || incomingSignalRef.current);

      peer.on('signal', (signal) => {
        socket.emit(`call:${type}:accept`, { toUserId: fromUser.id, signal });
      });

      peer.on('stream', (remote) => {
        setRemoteStream(remote);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
      });

      peer.on('error', (err) => {
        console.error('[WebRTC] Peer error:', err);
        cleanup();
      });

      peer.on('close', () => cleanup());

      peerRef.current = peer;
      setCallType(type);
      setRemoteUser(fromUser);
      setCallState('active');
      startTimer();
    } catch (err) {
      console.error('[WebRTC] Accept call error:', err);
      cleanup();
    }
  }, [socket, startTimer]);

  // Reject an incoming call
  const rejectCall = useCallback((fromUserId, type) => {
    socket.emit(`call:${type}:reject`, { toUserId: fromUserId });
    cleanup();
  }, [socket, cleanup]);

  // End active call
  const endCall = useCallback((toUserId, type) => {
    const finalType = type || callType;
    const duration = callDuration;
    socket.emit(`call:${finalType}:end`, { toUserId: toUserId || remoteUser?.id, duration });
    cleanup();
    return duration;
  }, [socket, callType, callDuration, remoteUser, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
      setIsMuted((m) => !m);
    }
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
      setIsCameraOff((c) => !c);
    }
  }, [localStream]);

  // Listen for socket call events
  useEffect(() => {
    if (!socket) return;

    const onVideoIncoming = ({ fromUserId, fromUsername, signal }) => {
      incomingSignalRef.current = signal;
      setRemoteUser({ id: fromUserId, username: fromUsername, displayName: fromUsername });
      setCallType('video');
      setCallState('incoming');
    };

    const onAudioIncoming = ({ fromUserId, fromUsername, signal }) => {
      incomingSignalRef.current = signal;
      setRemoteUser({ id: fromUserId, username: fromUsername, displayName: fromUsername });
      setCallType('audio');
      setCallState('incoming');
    };

    const onVideoAccepted = ({ fromUserId, signal }) => {
      peerRef.current?.signal(signal);
      setCallState('active');
      startTimer();
    };

    const onAudioAccepted = ({ fromUserId, signal }) => {
      peerRef.current?.signal(signal);
      setCallState('active');
      startTimer();
    };

    const onCallRejected = () => { cleanup(); };
    const onCallEnded = ({ duration }) => { cleanup(); };

    const onIceCandidate = ({ candidate }) => {
      try { peerRef.current?.signal({ candidate }); } catch {}
    };

    socket.on('call:video:incoming', onVideoIncoming);
    socket.on('call:audio:incoming', onAudioIncoming);
    socket.on('call:video:accepted', onVideoAccepted);
    socket.on('call:audio:accepted', onAudioAccepted);
    socket.on('call:video:rejected', onCallRejected);
    socket.on('call:audio:rejected', onCallRejected);
    socket.on('call:video:ended', onCallEnded);
    socket.on('call:audio:ended', onCallEnded);
    socket.on('call:ice:candidate', onIceCandidate);

    return () => {
      socket.off('call:video:incoming', onVideoIncoming);
      socket.off('call:audio:incoming', onAudioIncoming);
      socket.off('call:video:accepted', onVideoAccepted);
      socket.off('call:audio:accepted', onAudioAccepted);
      socket.off('call:video:rejected', onCallRejected);
      socket.off('call:audio:rejected', onCallRejected);
      socket.off('call:video:ended', onCallEnded);
      socket.off('call:audio:ended', onCallEnded);
      socket.off('call:ice:candidate', onIceCandidate);
    };
  }, [socket, startTimer, cleanup]);

  return {
    callState, callType, remoteUser, localStream, remoteStream,
    callDuration, isMuted, isCameraOff,
    localVideoRef, remoteVideoRef,
    initiateCall, acceptCall, rejectCall, endCall,
    toggleMute, toggleCamera, formatDuration,
    incomingSignalRef,
  };
};
