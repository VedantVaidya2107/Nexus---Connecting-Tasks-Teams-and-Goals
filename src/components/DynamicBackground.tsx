'use client';

import React, { useState, useEffect } from 'react';

const quotes = [
  "Success is not final; failure is not fatal: it is the courage to continue that counts.",
  "The only way to do great work is to love what you do.",
  "Innovation distinguishes between a leader and a follower.",
  "Your time is limited, don't waste it living someone else's life.",
  "Stay hungry, stay foolish.",
  "The future depends on what you do today.",
  "Focus on being productive instead of busy.",
  "Done is better than perfect.",
  "The secret of getting ahead is getting started.",
  "Believe you can and you're halfway there."
];

export default function DynamicBackground() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setQuoteIndex((prev) => (prev + 1) % quotes.length);
        setFade(true);
      }, 1000); // Time for fade out
    }, 10000); // Change quote every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dynamic-bg">
      {/* Animated Gradient Orbs */}
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>

      {/* Floating Quote */}
      <div className="quote-container">
        <p className={`quote-text ${fade ? 'fade-in' : 'fade-out'}`}>
          "{quotes[quoteIndex]}"
        </p>
      </div>

      {/* Subtle Noise Overlay */}
      <div className="noise-overlay"></div>

      <style jsx>{`
        .dynamic-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: -1;
          overflow: hidden;
        }

        .bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
        }

        .orb-1 {
          top: -10%;
          right: -10%;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
          animation: orbFloat1 25s ease-in-out infinite;
        }

        .orb-2 {
          bottom: -10%;
          left: -10%;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%);
          animation: orbFloat2 30s ease-in-out infinite;
          animation-delay: 2s;
        }

        .quote-container {
          position: absolute;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          width: 100%;
          max-width: 600px;
          padding: 0 24px;
        }

        .quote-text {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
          transition: opacity 1s ease-in-out, transform 1s ease-in-out;
          text-shadow: 0 0 20px rgba(255,255,255,0.1);
        }

        .fade-in {
          opacity: 0.4;
          transform: translateY(0);
        }

        .fade-out {
          opacity: 0;
          transform: translateY(-10px);
        }

        .noise-overlay {
          position: absolute;
          inset: 0;
          opacity: 0.03;
          mix-blend-mode: overlay;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(50px, -40px) scale(1.2); }
          66% { transform: translate(-30px, 60px) scale(0.9); }
        }

        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-60px, 50px) scale(1.1); }
          66% { transform: translate(40px, -30px) scale(1); }
        }
      `}</style>
    </div>
  );
}
