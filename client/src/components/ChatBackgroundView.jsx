import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BACKGROUND_PRESETS } from '../constants/chatBackgrounds';

export default function ChatBackgroundView({ background }) {
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });

  const type = background?.type || 'preset';
  const presetId = background?.presetId || 'default';
  const customUrl = background?.customUrl;
  const effects = background?.effects || {
    blur: 0,
    dimming: 0,
    brightness: 100,
    contrast: 100,
    zoom: 1,
    positionX: 50,
    positionY: 50,
    cropMode: 'free',
  };

  const isDarkMode = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
  const preset = BACKGROUND_PRESETS.find((p) => p.id === presetId) || BACKGROUND_PRESETS[0];
  const presetStyle = isDarkMode ? preset.darkStyle : preset.style;

  // Real-time Parallax & Motion Offset
  useEffect(() => {
    const hasParallax = effects.parallax ?? false;
    const hasMotion = effects.motion ?? false;

    if (!hasParallax && !hasMotion) {
      setParallaxOffset({ x: 0, y: 0 });
      return;
    }

    const handleMouseMove = (e) => {
      if (!hasParallax) return;
      const { clientX, clientY } = e;
      const moveX = (clientX - window.innerWidth / 2) * 0.03; // max 3% translation offset
      const moveY = (clientY - window.innerHeight / 2) * 0.03;
      setParallaxOffset({ x: -moveX, y: -moveY });
    };

    const handleOrientation = (e) => {
      if (!hasMotion) return;
      const { beta, gamma } = e; // tilt angles in degrees
      if (beta !== null && gamma !== null) {
        // Clamp tilts to safe ranges, adjust translation scale
        const moveX = Math.min(Math.max(gamma, -20), 20) * 0.6;
        const moveY = Math.min(Math.max(beta - 45, -20), 20) * 0.6;
        setParallaxOffset({ x: -moveX, y: -moveY });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [effects.parallax, effects.motion]);

  // CSS filters
  const filterStyle = `blur(${effects.blur || 0}px) brightness(${effects.brightness ?? 100}%) contrast(${effects.contrast ?? 100}%)`;
  
  // CSS transforms
  const transformStyle = `scale(${(effects.zoom || 1) * 1.05}) translate3d(${parallaxOffset.x}px, ${parallaxOffset.y}px, 0)`;

  // Inner background style mapping
  const activeStyle = type === 'custom' && customUrl
    ? {
        backgroundImage: `url("${customUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: `${effects.positionX ?? 50}% ${effects.positionY ?? 50}%`,
        filter: filterStyle,
        transform: transformStyle,
        width: '100%',
        height: '100%',
        transition: 'filter 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      }
    : {
        ...presetStyle,
        backgroundPosition: `${effects.positionX ?? 50}% ${effects.positionY ?? 50}%`,
        backgroundSize: effects.zoom > 1 ? `${effects.zoom * 100}%` : (presetStyle.backgroundSize || 'cover'),
        filter: filterStyle,
        transform: transformStyle,
        width: '100%',
        height: '100%',
        transition: 'filter 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      };

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-black select-none">
      <div
        style={activeStyle}
        className="absolute inset-0 transition-all duration-300 ease-out"
      />

      {/* Dimming Layer Overlay */}
      <div 
        className="absolute inset-0 transition-all duration-300 pointer-events-none"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${(effects.dimming || 0) / 100})`,
        }}
      />
    </div>
  );
}
