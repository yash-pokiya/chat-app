import { useEffect } from 'react'

const useScreenshotDetection = ({ socket, roomCode, username, onLocalAlert }) => {

  useEffect(() => {
    if (!socket || !roomCode || !username) return

    console.log('✅ Screenshot detection active:', {
      roomCode, username
    })

    let lastAlertTime = 0;

    const emitAlert = (method) => {
      const now = Date.now();
      // Throttle double-firing within 1.5 seconds (e.g. from keydown + keyup)
      if (now - lastAlertTime < 1500) {
        console.log('⏳ Throttled duplicate alert for:', method);
        return;
      }
      lastAlertTime = now;

      console.log('🔴 Screenshot detected via:', method)
      
      // Immediately run local alert callback to update UI with 0ms latency
      if (onLocalAlert) {
        try {
          onLocalAlert();
        } catch (err) {
          console.error('❌ Failed to run local alert callback:', err);
        }
      }

      socket.emit('screenshot:taken', {
        roomCode: roomCode.toUpperCase(),
        username,
        method,
        timestamp: now
      })
    }

    const isMobile = /iPhone|iPad|iPod|Android/i
      .test(navigator.userAgent)

    // Modifier keys state tracking for desktop screenshot hotkeys (Snipping tools)
    let lastWinShiftTime = 0;

    const checkPrintScreen = (e) => {
      return (
        e.key === 'PrintScreen'                                ||
        e.key === 'PrtScn'                                     ||
        e.key === 'PrtSc'                                      ||
        e.key === 'Print'                                      ||
        e.keyCode === 44                                       ||
        e.code === 'PrintScreen'                               ||
        (e.altKey  && e.key === 'PrintScreen')
      );
    };

    const handleKeyDown = (e) => {
      const hasMeta = e.metaKey || e.key === 'Meta' || e.key === 'OS';
      const hasShift = e.shiftKey || e.key === 'Shift';

      if (hasMeta && hasShift) {
        lastWinShiftTime = Date.now();
        console.log('⌨️ Modifier combo (Win/Cmd + Shift) detected');
      }

      if (checkPrintScreen(e)) {
        emitAlert('keyboard');
      }
    };

    const handleKeyUp = (e) => {
      if (checkPrintScreen(e)) {
        emitAlert('keyboard');
      }
    };

    const handleBlur = () => {
      // If the window blurs within 1 second of Win/Cmd + Shift keydown, Snipping Tool opened.
      const now = Date.now();
      if (now - lastWinShiftTime < 1000) {
        console.log('🔔 Window blurred immediately after modifier combo');
        emitAlert('keyboard');
        lastWinShiftTime = 0; // reset
      }
    };

    // ─────────────────────────────────────────
    // DESKTOP + MOBILE: Clipboard image paste
    // ─────────────────────────────────────────
    const handlePaste = (e) => {
      const items = e.clipboardData?.items || []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          emitAlert('clipboard')
          break
        }
      }
    }

    // ─────────────────────────────────────────
    // MOBILE: Short visibility flash detection
    // ─────────────────────────────────────────
    let hiddenAt  = null
    let cooldown  = false

    const handleVisibility = () => {
      if (!isMobile) return

      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (hiddenAt) {
        const ms = Date.now() - hiddenAt
        // < 600ms = screenshot flash, not tab switch
        if (ms < 600 && !cooldown) {
          cooldown = true
          emitAlert('mobile')
          setTimeout(() => { cooldown = false }, 3000)
        }
        hiddenAt = null
      }
    }

    // ─────────────────────────────────────────
    // ATTACH LISTENERS
    // ─────────────────────────────────────────
    if (!isMobile) {
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('keyup', handleKeyUp)
      window.addEventListener('blur', handleBlur)
    }
    document.addEventListener('paste', handlePaste)
    document.addEventListener('visibilitychange', handleVisibility)

    // ─────────────────────────────────────────
    // CLEANUP on unmount
    // ─────────────────────────────────────────
    return () => {
      if (!isMobile) {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('keyup', handleKeyUp)
        window.removeEventListener('blur', handleBlur)
      }
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('visibilitychange', handleVisibility)
      console.log('🧹 Screenshot detection cleaned up')
    }

  }, [socket, roomCode, username, onLocalAlert]) // ✅ all as deps
}

export default useScreenshotDetection
