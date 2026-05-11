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
      }, 1200);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dynamic-bg">
      {/* Layer 1: Base Gradient is handled in CSS */}
      
      {/* Layer 2: Floating Orbs */}
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>

      {/* Layer 3: Mesh Grid */}
      <div className="mesh-grid"></div>

      {/* Layer 4: Particle Field (50 particles) */}
      <div className="particle-field">
        {[...Array(50)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 15}s`,
            animationDuration: `${10 + Math.random() * 10}s`,
            opacity: 0.05 + Math.random() * 0.1
          }}></div>
        ))}
      </div>

      {/* Floating Quote */}
      <div className="quote-container">
        <p className={`quote-text ${fade ? 'fade-in' : 'fade-out'}`}>
          "{quotes[quoteIndex]}"
        </p>
      </div>

      {/* Noise & Vignette */}
      <div className="noise"></div>
      <div className="vignette"></div>

      <style jsx>{`
        .dynamic-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
          /* Layer 1: Base Gradient */
          background: var(--bg-dynamic-base);
          transition: background 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Layer 2: Floating Orbs */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          transition: background 0.8s ease;
        }
        .orb-1 {
          width: 600px;
          height: 600px;
          background: var(--bg-orb-1);
          top: -10%;
          left: -10%;
          animation: drift1 60s linear infinite;
        }
        .orb-2 {
          width: 800px;
          height: 800px;
          background: var(--bg-orb-2);
          bottom: -20%;
          right: -10%;
          animation: drift2 60s linear infinite;
        }
        .orb-3 {
          width: 500px;
          height: 500px;
          background: var(--bg-orb-3);
          top: 30%;
          right: 20%;
          animation: drift3 60s linear infinite;
        }

        /* Layer 3: Mesh Grid */
        .mesh-grid {
          position: absolute;
          inset: -10%;
          opacity: var(--bg-mesh-opacity);
          background-image: radial-gradient(circle, var(--bg-mesh-color) 1px, transparent 1px);
          background-size: 40px 40px;
          animation: gridShift 100s linear infinite;
          transition: opacity 0.8s, background-image 0.8s;
        }

        /* Layer 4: Particle Field */
        .particle-field {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .particle {
          position: absolute;
          width: 2px;
          height: 2px;
          background: var(--bg-particle-color);
          border-radius: 50%;
          animation: floatUp linear infinite;
          transition: background 0.8s ease;
        }

        /* Quote Styling */
        .quote-container {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          width: 100%;
          max-width: 800px;
          padding: 0 32px;
          z-index: 10;
        }
        .quote-text {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--bg-quote-color);
          transition: all 1.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .fade-in { opacity: 1; transform: translateY(0); }
        .fade-out { opacity: 0; transform: translateY(-10px); }

        .noise {
          position: absolute;
          inset: 0;
          opacity: 0.03;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
        .vignette {
          position: absolute;
          inset: 0;
          background: var(--bg-vignette);
          transition: background 0.8s ease;
        }

        /* Animations */
        @keyframes drift1 {
          0% { transform: translate(0, 0); }
          25% { transform: translate(20vw, 30vh); }
          50% { transform: translate(40vw, 10vh); }
          75% { transform: translate(10vw, -20vh); }
          100% { transform: translate(0, 0); }
        }
        @keyframes drift2 {
          0% { transform: translate(0, 0); }
          33% { transform: translate(-30vw, -40vh); }
          66% { transform: translate(-10vw, -10vh); }
          100% { transform: translate(0, 0); }
        }
        @keyframes drift3 {
          0% { transform: translate(0, 0); }
          50% { transform: translate(-40vw, 20vh); }
          100% { transform: translate(0, 0); }
        }
        @keyframes gridShift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(40px, 40px); }
        }
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-100vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
