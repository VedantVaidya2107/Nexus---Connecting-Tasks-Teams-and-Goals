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

export default function QuoteFooter() {
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
    <div className="quote-footer">
      <p className={`quote-text ${fade ? 'fade-in' : 'fade-out'}`}>
        "{quotes[quoteIndex]}"
      </p>
      <style jsx>{`
        .quote-footer {
          margin-top: 64px;
          margin-bottom: 32px;
          text-align: center;
          width: 100%;
          padding: 0 32px;
          z-index: 10;
        }
        .quote-text {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--text-muted);
          transition: all 1.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .fade-in { opacity: 0.7; transform: translateY(0); }
        .fade-out { opacity: 0; transform: translateY(-10px); }
      `}</style>
    </div>
  );
}
