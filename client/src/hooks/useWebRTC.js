import { useEffect, useRef, useState, useCallback } from 'react'
import SimplePeer from 'simple-peer'
import toast from 'react-hot-toast'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]

const useWebRTC = ({ socket, currentUser }) => {
  const [callState, setCallState] = useState({
    status: 'idle', callType: null,
    remoteUser: null, callDuration: 0,
  })
  // ✅ Explicit flag — UI uses this to know when to 
  // actually render the remote <video>, decoupled from 
  // callState.status timing issues:
  const [remoteStreamReady, setRemoteStreamReady] = useState(false)

  const localStreamRef  = useRef(null)
  const remoteStreamRef = useRef(null)
  const peerRef          = useRef(null)
  const localVideoRef    = useRef(null)
  const remoteVideoRef   = useRef(null)
  const durationTimer    = useRef(null)
  const incomingSignal   = useRef(null)
  const isCleanedUp      = useRef(true) // starts true — nothing to clean
  const callTypeRef      = useRef(null)
  const remoteUserRef    = useRef(null) // ✅ avoids stale closure in signal handler

  //══════════════════════════════════════
  // GET MEDIA — separate from peer creation entirely
  //══════════════════════════════════════
  const getStream = async (callType) => {
    const constraints = {
      audio: { echoCancellation: true, noiseSuppression: true },
      video: callType === 'video'
        ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    localStreamRef.current = stream

    // Verify video tracks actually exist if this is a video call:
    const videoTracks = stream.getVideoTracks()
    const audioTracks = stream.getAudioTracks()
    console.log('🎥 Stream tracks:', {
      video: videoTracks.length,
      audio: audioTracks.length,
      videoEnabled: videoTracks[0]?.enabled,
      videoReadyState: videoTracks[0]?.readyState,
    })

    if (callType === 'video' && videoTracks.length === 0) {
      console.error('❌ Video call requested but NO video track in stream!')
    }

    return stream
  }

  // Attach local stream to local video element with retries
  const attachLocalVideo = useCallback(() => {
    const tryAttach = (attempts = 0) => {
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
        localVideoRef.current.muted = true
        localVideoRef.current.playsInline = true
        localVideoRef.current.play()
          .then(() => console.log('✅ Local video playing'))
          .catch(err => console.warn('⚠️ Local play blocked:', err.message))
      } else if (attempts < 15) {
        setTimeout(() => tryAttach(attempts + 1), 100)
      } else {
        console.error('❌ Failed to attach local video after retries',
          { refExists: !!localVideoRef.current,
            streamExists: !!localStreamRef.current })
      }
    }
    tryAttach()
  }, [])

  // Attach remote stream with retries
  const attachRemoteVideo = useCallback((stream) => {
    remoteStreamRef.current = stream
    setRemoteStreamReady(true)

    console.log('🔍 Remote stream track states:',
      stream.getTracks().map(t => 
        `${t.kind}: enabled=${t.enabled}, readyState=${t.readyState}`
      ))

    const tryAttach = (attempts = 0) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream
        remoteVideoRef.current.playsInline = true
        remoteVideoRef.current.play()
          .then(() => console.log('✅ Remote video playing'))
          .catch(err => console.warn('⚠️ Remote play blocked:', err.message))
      } else if (attempts < 15) {
        setTimeout(() => tryAttach(attempts + 1), 100)
      } else {
        console.error('❌ remoteVideoRef never became available')
      }
    }
    tryAttach()
  }, [])

  //══════════════════════════════════════
  // CREATE PEER — single source of truth
  //══════════════════════════════════════
  const createPeer = ({ initiator, stream, callType }) => {
    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream,
      config: { iceServers: ICE_SERVERS },
    })

    peer.on('signal', (signal) => {
      const toUserId = remoteUserRef.current?._id || remoteUserRef.current?.id
      if (!toUserId) {
        console.error('❌ No remoteUser set when trying to signal')
        return
      }
      if (initiator) {
        socket.emit('call:initiate', {
          toUserId,
          fromUser: {
            _id: currentUser?._id || currentUser?.id, username: currentUser?.username,
            displayName: currentUser?.displayName, avatar: currentUser?.avatar,
          },
          signal, callType,
        })
      } else {
        socket.emit('call:accept', { toUserId, signal })
      }
    })

    // ✅ Handle BOTH 'stream' and 'track' events — different
    // simple-peer/browser combos fire one or the other:
    peer.on('stream', (remoteStream) => {
      console.log(`🎥 [${initiator ? 'CALLER' : 'CALLEE'}] 'stream' event fired`)
      attachRemoteVideo(remoteStream)
      setCallState(prev => ({ ...prev, status: 'connected' }))
      startDurationTimer()
    })

    peer.on('track', (track, stream) => {
      console.log(`🎥 [${initiator ? 'CALLER' : 'CALLEE'}] 'track' event fired:`, track.kind)
      // Only attach if 'stream' event hasn't already done it:
      if (!remoteStreamRef.current) {
        attachRemoteVideo(stream)
        setCallState(prev => ({ ...prev, status: 'connected' }))
        startDurationTimer()
      }
    })

    peer.on('connect', () => console.log('✅ Peer connected (data channel)'))

    peer.on('error', (err) => {
      console.error('❌ Peer error:', err.message)
    })

    peer.on('close', () => {
      console.log('🔌 Peer closed')
    })

    return peer
  }

  //══════════════════════════════════════
  // INITIATE CALL
  //══════════════════════════════════════
  const initiateCall = async (toUser, callType = 'video') => {
    // Fail loudly if user details are missing
    if (!toUser?._id || !toUser?.username) {
      console.error('❌ initiateCall called with incomplete user:', toUser)
      toast.error('Could not start call — user data missing')
      return
    }

    if (!isCleanedUp.current) {
      console.warn('⚠️ Previous call not cleaned up, forcing cleanup')
      cleanup()
    }
    isCleanedUp.current = false
    remoteUserRef.current = toUser
    callTypeRef.current = callType

    // Set callState synchronously before requesting device media
    setCallState({ status: 'calling', callType, remoteUser: toUser, callDuration: 0 })

    try {
      const stream = await getStream(callType)

      // Give React one tick to render the calling UI 
      // (with local <video>) before attaching:
      requestAnimationFrame(() => attachLocalVideo())

      const peer = createPeer({ initiator: true, stream, callType })
      peerRef.current = peer

      socket.once('call:user:unavailable', () => {
        cleanup()
        setCallState({ status: 'idle', callType: null, remoteUser: null, callDuration: 0 })
        alert(`${toUser.username} is not available right now`)
      })
    } catch (err) {
      console.error('❌ initiateCall failed:', err)
      cleanup()
      handleMediaError(err)
    }
  }

  //══════════════════════════════════════
  // SIGNAL RELAY LISTENERS (mounted once, always active)
  //══════════════════════════════════════
  useEffect(() => {
    if (!socket) return

    const handleIncoming = ({ fromUser, signal, callType }) => {
      console.log('🔔 Incoming call from:', fromUser.username)
      incomingSignal.current = signal
      remoteUserRef.current  = fromUser
      callTypeRef.current    = callType
      isCleanedUp.current    = false
      setCallState({ status: 'incoming', callType, remoteUser: fromUser, callDuration: 0 })
    }

    const handleSignal = ({ signal }) => {
      console.log('📡 Relayed signal received, type:', signal.type || 'ice-candidate')
      if (peerRef.current && !peerRef.current.destroyed) {
        peerRef.current.signal(signal)
      } else {
        console.warn('⚠️ Got signal but peer not ready yet')
      }
    }

    const handleRejected = () => {
      cleanup()
      setCallState({ status: 'idle', callType: null, remoteUser: null, callDuration: 0 })
    }

    const handleEnded = () => {
      cleanup()
      setCallState(prev => ({ ...prev, status: 'ended' }))
      setTimeout(() => setCallState({ status: 'idle', callType: null, remoteUser: null, callDuration: 0 }), 1200)
    }

    socket.on('call:incoming', handleIncoming)
    socket.on('call:signal',   handleSignal)
    socket.on('call:rejected', handleRejected)
    socket.on('call:ended',    handleEnded)

    return () => {
      socket.off('call:incoming', handleIncoming)
      socket.off('call:signal',   handleSignal)
      socket.off('call:rejected', handleRejected)
      socket.off('call:ended',    handleEnded)
    }
  }, [socket])

  //══════════════════════════════════════
  // ACCEPT CALL
  //══════════════════════════════════════
  const acceptCall = async () => {
    try {
      const stream = await getStream(callTypeRef.current)
      setCallState(prev => ({ ...prev, status: 'connected' }))

      requestAnimationFrame(() => attachLocalVideo())

      const peer = createPeer({
        initiator: false, stream, callType: callTypeRef.current,
      })

      if (incomingSignal.current) {
        peer.signal(incomingSignal.current)
        incomingSignal.current = null
      }

      peerRef.current = peer
    } catch (err) {
      console.error('❌ acceptCall failed:', err)
      handleMediaError(err)
      rejectCall()
    }
  }

  const rejectCall = () => {
    socket.emit('call:reject', { toUserId: remoteUserRef.current?._id || remoteUserRef.current?.id })
    cleanup()
    setCallState({ status: 'idle', callType: null, remoteUser: null, callDuration: 0 })
  }

  const endCall = () => {
    socket.emit('call:end', { toUserId: remoteUserRef.current?._id || remoteUserRef.current?.id })
    cleanup()
    setCallState(prev => ({ ...prev, status: 'ended' }))
    setTimeout(() => setCallState({ status: 'idle', callType: null, remoteUser: null, callDuration: 0 }), 1200)
  }

  //══════════════════════════════════════
  // CLEANUP — guaranteed camera/mic OFF
  //══════════════════════════════════════
  const cleanup = useCallback(() => {
    if (isCleanedUp.current) return
    isCleanedUp.current = true
    console.log('🧹 Cleanup started')

    if (peerRef.current) {
      try { peerRef.current.removeAllListeners(); peerRef.current.destroy() }
      catch (e) {}
      peerRef.current = null
    }

    ;[localStreamRef, remoteStreamRef].forEach(ref => {
      ref.current?.getTracks().forEach(track => {
        track.stop()
        console.log(`🛑 Stopped ${track.kind} track (${track.label})`)
      })
      ref.current = null
    })

    if (localVideoRef.current)  localVideoRef.current.srcObject  = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null

    clearInterval(durationTimer.current)
    durationTimer.current = null
    incomingSignal.current = null
    remoteUserRef.current  = null
    setRemoteStreamReady(false)

    console.log('✅ Cleanup done — camera/mic released')
  }, [])

  //══════════════════════════════════════
  // SAFETY NET — runs on tab close, nav away, unmount
  //══════════════════════════════════════
  useEffect(() => {
    const handleUnload = () => {
      if (!isCleanedUp.current) {
        socket?.emit('call:end', { toUserId: remoteUserRef.current?._id || remoteUserRef.current?.id })
        cleanup()
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      cleanup() // ✅ ALWAYS cleanup on unmount, no conditions
    }
  }, [cleanup])

  const handleMediaError = (err) => {
    const msgs = {
      NotAllowedError: 'Camera/mic permission denied.',
      NotFoundError: 'No camera/mic found.',
      NotReadableError: 'Camera/mic already in use by another app.',
    }
    alert(msgs[err.name] || 'Could not access camera/microphone.')
  }

  const toggleMic = () => localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !t.enabled)
  const toggleCamera = () => localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = !t.enabled)

  const startDurationTimer = () => {
    clearInterval(durationTimer.current)
    durationTimer.current = setInterval(() => {
      setCallState(prev => ({ ...prev, callDuration: prev.callDuration + 1 }))
    }, 1000)
  }

  const formatDuration = (s) =>
    `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  return {
    callState, remoteStreamReady,
    localVideoRef, remoteVideoRef,
    initiateCall, acceptCall, rejectCall, endCall,
    toggleMic, toggleCamera, formatDuration,
  }
}

export default useWebRTC
