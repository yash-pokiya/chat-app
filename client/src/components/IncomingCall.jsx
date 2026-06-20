import React from 'react'
import { Phone, PhoneOff, Video as VideoIcon } from 'lucide-react'

const IncomingCall = ({ callState, onAccept, onReject }) => {
  const displayName = callState.remoteUser?.displayName
    || callState.remoteUser?.username
    || 'Unknown User'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm
                    z-[100] flex items-center justify-center">
      <div className="bg-white rounded-3xl p-8 text-center
                      shadow-2xl w-72">

        <div className="relative w-24 h-24 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full
                          bg-green-400/30 animate-ping" />
          {callState.remoteUser?.avatar ? (
            <img src={callState.remoteUser.avatar}
                 className="w-24 h-24 rounded-full object-cover
                            relative z-10 ring-4 ring-green-400" 
                 alt={displayName} />
          ) : (
            <div className="w-24 h-24 rounded-full relative z-10
                            bg-gradient-to-br from-violet-400 to-cyan-400
                            flex items-center justify-center text-white
                            text-2xl font-bold ring-4 ring-green-400">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
        </div>

        <p className="font-bold text-xl text-gray-800">{displayName}</p>
        <p className="text-gray-400 text-sm mt-1 mb-8">
          Incoming {callState.callType === 'video' ? 'video' : 'voice'} call...
        </p>

        <div className="flex justify-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <button onClick={onReject}
                    className="w-16 h-16 bg-red-500 rounded-full
                               flex items-center justify-center text-white
                               shadow-lg shadow-red-200 hover:bg-red-600
                               active:scale-95 transition-all"
                    aria-label="Decline call">
              <PhoneOff size={26} />
            </button>
            <span className="text-xs text-gray-400">Decline</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button onClick={onAccept}
                    className="w-16 h-16 bg-green-500 rounded-full
                               flex items-center justify-center text-white
                               shadow-lg shadow-green-200 hover:bg-green-600
                               active:scale-95 transition-all"
                    aria-label="Accept call">
              {callState.callType === 'video'
                ? <VideoIcon size={26} />
                : <Phone size={26} />}
            </button>
            <span className="text-xs text-gray-400">Accept</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IncomingCall
