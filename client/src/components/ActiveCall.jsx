import React, { useState } from 'react'
import {
  Mic, MicOff, Video as VideoIcon, VideoOff,
  PhoneOff,
} from 'lucide-react'

const ActiveCall = ({
  callState, remoteStreamReady,
  localVideoRef, remoteVideoRef,
  onEnd, onToggleMic, onToggleCamera, duration,
}) => {
  const [micOn,    setMicOn]    = useState(true)
  const [cameraOn, setCameraOn] = useState(true)

  React.useEffect(() => {
    console.log('🔍 localVideoRef.current:', localVideoRef.current)
    console.log('🔍 localVideoRef.current?.srcObject:', 
      localVideoRef.current?.srcObject)
    console.log('🔍 remoteVideoRef.current:', remoteVideoRef.current)
    console.log('🔍 remoteVideoRef.current?.srcObject:', 
      remoteVideoRef.current?.srcObject)
  }, [callState.status, remoteStreamReady, localVideoRef, remoteVideoRef])

  const isVideo = callState.callType === 'video'
  const displayName = callState.remoteUser?.displayName
    || callState.remoteUser?.username
    || 'Unknown User'

  return (
    <div className="fixed inset-0 bg-gray-900 z-[100] flex flex-col">

      <video ref={remoteVideoRef} autoPlay playsInline
             className="absolute inset-0 w-full h-full object-cover" />

      {!remoteStreamReady && (
        <div className="absolute inset-0 flex flex-col items-center
                        justify-center bg-gray-900 gap-3 z-10">
          {callState.remoteUser?.avatar ? (
            <img src={callState.remoteUser.avatar}
                 className="w-24 h-24 rounded-full object-cover
                            ring-4 ring-white/20" 
                 alt={displayName} />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br
                            from-violet-400 to-cyan-400 flex items-center
                            justify-center text-white text-3xl font-bold
                            ring-4 ring-white/20">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          <p className="text-white font-semibold text-lg">{displayName}</p>
          <p className="text-gray-400 text-sm">
            {callState.status === 'calling' ? 'Calling...' : 'Connecting...'}
          </p>
        </div>
      )}

      {isVideo && (
        <video ref={localVideoRef} autoPlay muted playsInline
               className="absolute right-3 sm:right-4 bottom-[calc(7rem+env(safe-area-inset-bottom))] sm:bottom-28 w-24 h-32 sm:w-28 sm:h-40 rounded-2xl object-cover shadow-lg border-2 border-white/20 z-20 bg-gray-800" />
      )}

      {callState.status === 'connected' && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2
                        text-white text-sm bg-black/30 backdrop-blur-sm
                        px-3 py-1 rounded-full z-30">
          {duration}
        </div>
      )}

      {/* Proper icon buttons — no emoji */}
      <div className="absolute bottom-0 left-0 right-0 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center gap-4 sm:gap-5 z-30">

        <button
          onClick={() => { onToggleMic(); setMicOn(p => !p) }}
          className={`w-[52px] h-[52px] rounded-full flex items-center
                      justify-center transition-all active:scale-95
                      ${micOn
                        ? 'bg-white/15 text-white hover:bg-white/25'
                        : 'bg-white text-gray-900'}`}
        >
          {micOn ? <Mic size={22} /> : <MicOff size={22} />}
        </button>

        {isVideo && (
          <button
            onClick={() => { onToggleCamera(); setCameraOn(p => !p) }}
            className={`w-[52px] h-[52px] rounded-full flex items-center
                        justify-center transition-all active:scale-95
                        ${cameraOn
                          ? 'bg-white/15 text-white hover:bg-white/25'
                          : 'bg-white text-gray-900'}`}
          >
            {cameraOn ? <VideoIcon size={22} /> : <VideoOff size={22} />}
          </button>
        )}

        <button
          onClick={onEnd}
          className="w-[60px] h-[60px] rounded-full bg-red-500
                     hover:bg-red-600 text-white flex items-center
                     justify-center shadow-lg shadow-red-500/30
                     transition-all active:scale-95"
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  )
}

export default ActiveCall
