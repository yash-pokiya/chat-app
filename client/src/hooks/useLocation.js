import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useLocation — manages live location sharing via Geolocation API + socket
 */
export const useLocation = ({ socket, roomCode, dmId }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [myCoords, setMyCoords] = useState(null);
  const [partnerCoords, setPartnerCoords] = useState(null);
  const [partnerStopped, setPartnerStopped] = useState(false);
  const watchIdRef = useRef(null);

  const getTarget = () => dmId ? null : roomCode;

  const start = useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((pos) => {
      const coords = [pos.coords.latitude, pos.coords.longitude];
      setMyCoords(coords);
      socket.emit('location:start', { roomCode, dmId, coords });
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setMyCoords(coords);
        socket.emit('location:update', { roomCode, dmId, coords });
      },
      (err) => console.error('[Location] watch error:', err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    setIsSharing(true);
    setPartnerStopped(false);
  }, [socket, roomCode, dmId]);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    socket.emit('location:stop', { roomCode, dmId });
    setIsSharing(false);
  }, [socket, roomCode, dmId]);

  // Calculate distance between two coords in km
  const calcDistance = useCallback((c1, c2) => {
    if (!c1 || !c2) return null;
    const R = 6371;
    const dLat = ((c2[0] - c1[0]) * Math.PI) / 180;
    const dLon = ((c2[1] - c1[1]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((c1[0] * Math.PI) / 180) * Math.cos((c2[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
  }, []);

  const distance = calcDistance(myCoords, partnerCoords);

  useEffect(() => {
    if (!socket) return;

    const onStarted = ({ coords }) => { setPartnerCoords(coords); setPartnerStopped(false); };
    const onUpdated = ({ coords }) => setPartnerCoords(coords);
    const onStopped = () => setPartnerStopped(true);

    socket.on('location:started', onStarted);
    socket.on('location:updated', onUpdated);
    socket.on('location:stopped', onStopped);

    return () => {
      socket.off('location:started', onStarted);
      socket.off('location:updated', onUpdated);
      socket.off('location:stopped', onStopped);
    };
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return { isSharing, myCoords, partnerCoords, partnerStopped, distance, start, stop };
};
