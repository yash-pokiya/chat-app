import { createContext, useContext } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useWebRTC } from '../hooks/useWebRTC';
import IncomingCall from '../components/IncomingCall';

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

      {/* Global incoming call overlay — shows on any page */}
      {webrtc.callState === 'incoming' && (
        <IncomingCall
          caller={webrtc.remoteUser}
          callType={webrtc.callType}
          onAccept={() =>
            webrtc.acceptCall(
              webrtc.remoteUser,
              webrtc.callType,
              webrtc.incomingSignalRef.current
            )
          }
          onReject={() =>
            webrtc.rejectCall(webrtc.remoteUser?.id, webrtc.callType)
          }
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
