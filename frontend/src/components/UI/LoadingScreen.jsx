import { useEffect, useRef, useState } from 'react';

const MESSAGES = [
  'Initializing orbital mechanics engine…',
  'Connecting to CelesTrak satellite network…',
  'Loading 15,000+ TLE orbital elements…',
  'Propagating satellite positions via SGP4…',
  'Fetching near-Earth asteroid catalogue…',
  'Rendering photorealistic Earth…',
  'Calibrating local space bubble…',
  'Cosmic awareness online.',
];

export function LoadingScreen({ done }) {
  const [progress,  setProgress]  = useState(0);
  const [msgIndex,  setMsgIndex]  = useState(0);
  const [fading,    setFading]    = useState(false);
  const [unmounted, setUnmounted] = useState(false);

  // Advance progress bar while loading
  useEffect(() => {
    const tick = setInterval(() => {
      setProgress(p => {
        if (p >= 95) { clearInterval(tick); return p; }
        return p + Math.random() * 4 + 1;
      });
      setMsgIndex(i => Math.min(i + 1, MESSAGES.length - 1));
    }, 400);
    return () => clearInterval(tick);
  }, []);

  // When done, jump to 100% and start fade-out animation
  useEffect(() => {
    if (done) {
      setProgress(100);
      // Small delay so the bar visually fills to 100% before fade
      setTimeout(() => setFading(true), 300);
    }
  }, [done]);

  // Removed from DOM after CSS animation ends — prevents invisible overlay blocking the globe
  if (unmounted) return null;

  return (
    <div
      className={`loading-screen${fading ? ' fade-out' : ''}`}
      onAnimationEnd={() => {
        if (fading) setUnmounted(true);
      }}
    >
      <div className="loading-content">
        <div className="loading-earth">🌍</div>

        <div>
          <h1 className="loading-title">VAANTHULI</h1>
          <p className="loading-subtitle">Real-Time Cosmic Awareness System</p>
        </div>

        <div className="loading-bar-wrap">
          <div
            className="loading-bar-fill"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        <p className="loading-status">{MESSAGES[msgIndex]}</p>

        <div className="loading-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}
