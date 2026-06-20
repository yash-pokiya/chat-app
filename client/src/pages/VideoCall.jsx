import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCall } from '../context/CallContext';

export default function VideoCall() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { callState, initiateCall } = useCall();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') || 'video';
    const targetUsername = params.get('username') || '';
    const targetDisplayName = params.get('displayName') || '';
    const targetAvatar = params.get('avatar') || '';
    
    initiateCall({ 
      _id: userId, 
      id: userId, 
      username: targetUsername, 
      displayName: targetDisplayName || targetUsername || 'Unknown User', 
      avatar: targetAvatar 
    }, type);
  }, []);

  useEffect(() => {
    if (callState.status === 'idle') {
      navigate('/', { replace: true });
    }
  }, [callState.status, navigate]);

  return <div className="fixed inset-0 bg-gray-900" />;
}
