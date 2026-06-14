import { useEffect, useRef, useCallback } from 'react';

const useOnlineStatus = ({ socket, user }) => {
  const idleTimer = useRef(null);
  const isIdle = useRef(false);
  const IDLE_TIMEOUT = 12000; // 12 seconds (between 10-15s)

  const getUserId = useCallback(() => user?._id || user?.id, [user]);

  //────────────────────────────────────────
  // GO ONLINE
  //────────────────────────────────────────
  const goOnline = useCallback(() => {
    const userId = getUserId();
    if (!socket || !userId) return;
    if (isIdle.current) {
      isIdle.current = false;
      socket.emit('user:active', { userId });
      console.log('🟢 Emitted user:active');
    }
  }, [socket, getUserId]);

  //────────────────────────────────────────
  // GO IDLE (after 12 seconds of no focus)
  //────────────────────────────────────────
  const goIdle = useCallback(() => {
    const userId = getUserId();
    if (!socket || !userId) return;
    if (!isIdle.current) {
      isIdle.current = true;
      socket.emit('user:idle', { userId });
      console.log('💤 Emitted user:idle');
    }
  }, [socket, getUserId]);

  //────────────────────────────────────────
  // RESET IDLE TIMER
  //────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    clearTimeout(idleTimer.current);
    // If was idle → come back online first:
    if (isIdle.current) goOnline();
    // Start fresh timer:
    idleTimer.current = setTimeout(goIdle, IDLE_TIMEOUT);
  }, [goOnline, goIdle]);

  useEffect(() => {
    const userId = getUserId();
    if (!socket || !userId) return;
    socket.emit('user:online', { userId });
  }, [socket, socket?.connected, user, getUserId]);

  useEffect(() => {
    const userId = getUserId();
    if (!socket || !userId) return;

    // 1. Register as online immediately:
    socket.emit('user:online', { userId });
    console.log('🟢 Registered online');

    // 2. Start idle timer:
    resetIdleTimer();

    // 3. Tab visibility change:
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Tab is focused → come online, reset timer:
        goOnline();
        resetIdleTimer();
      } else {
        // Tab hidden → start countdown to idle:
        clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(goIdle, IDLE_TIMEOUT);
      }
    };

    // 4. User activity events → reset idle timer:
    const activityEvents = [
      'mousemove', 'mousedown', 'keydown',
      'touchstart', 'scroll', 'click'
    ];
    const handleActivity = () => resetIdleTimer();

    // 5. Before tab/browser closes:
    const handleBeforeUnload = () => {
      // Synchronous emit before page unloads:
      socket.emit('user:idle', { userId });
    };

    // Attach all listeners:
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    activityEvents.forEach(e =>
      document.addEventListener(e, handleActivity, { passive: true })
    );

    return () => {
      clearTimeout(idleTimer.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      activityEvents.forEach(e =>
        document.removeEventListener(e, handleActivity)
      );
    };
  }, [socket, user, getUserId, resetIdleTimer, goOnline, goIdle]);
};

export default useOnlineStatus;
