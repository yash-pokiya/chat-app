import { createContext, useContext } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import useWebRTC from '../hooks/useWebRTC';
import IncomingCall from '../components/IncomingCall';
import ActiveCall from '../components/ActiveCall';

const CallContext = createContext(null);

/**
 * CallProvider — wraps the entire app so incoming call events
 * are heard on ANY page, not just DMChat or VideoCall.
 */
export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const webrtc = useWebRTC({ socket, currentUser: user });

  return (
    <CallContext.Provider value={webrtc}>
      {children}

      {webrtc.callState.status === 'incoming' && (
        <IncomingCall
          callState={webrtc.callState}
          onAccept={webrtc.acceptCall}
          onReject={webrtc.rejectCall}
        />
      )}

      {/* Global active call overlay — shows on any page for calling / connected states */}
      {(webrtc.callState.status === 'calling' || webrtc.callState.status === 'connected') && (
        <ActiveCall
          callState={webrtc.callState}
          remoteStreamReady={webrtc.remoteStreamReady}
          localVideoRef={webrtc.localVideoRef}
          remoteVideoRef={webrtc.remoteVideoRef}
          onEnd={webrtc.endCall}
          onToggleMic={webrtc.toggleMic}
          onToggleCamera={webrtc.toggleCamera}
          duration={webrtc.formatDuration(webrtc.callState.callDuration)}
        />
      )}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};
