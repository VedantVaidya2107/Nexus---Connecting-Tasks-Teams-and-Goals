'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, Minimize2, Maximize2, Bot, Mic, MicOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function AIAssistant() {
  const { profile, session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput(prev => prev + (prev ? ' ' : '') + transcript);
          }
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            toast.error('Microphone permission blocked. Please enable it in browser settings!');
          } else {
            toast.error('Voice typing error. Please try again!');
          }
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Voice typing is not supported in this browser. Please try Chrome or Safari!');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `👋 Hi ${profile?.full_name?.split(' ')[0] || 'there'}! I'm your Nexus AI. I can help you track tasks, analyze your workload, or find project info. What's on your mind?`,
        timestamp: new Date()
      }]);
    }
  }, [profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ message: userText, conversationId })
      });

      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.data.message, 
          timestamp: new Date(),
          action: data.data.action,
          data: data.data.data
        }]);
        setConversationId(data.data.conversationId);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Server Error: ${data.details || data.error || 'Please try again later.'}`, timestamp: new Date() }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Sorry, I hit a snag. Please check your internet connection.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="ai-assistant-wrapper">
      {/* Trigger Button */}
      {!isOpen && (
        <button type="button" aria-label="Open AI Assistant" className="ai-trigger-btn" onClick={() => setIsOpen(true)}>
          <div className="ripple" />
          <div className="ai-trigger-icon-wrapper">
            <Sparkles size={24} />
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`ai-chat-window ${isMinimized ? 'minimized' : ''}`}>
          <div className="ai-header">
            <div className="ai-brand">
              <div className="ai-icon-box"><Sparkles size={16} /></div>
              <div>
                <div className="ai-name">Nexus AI</div>
                <div className="ai-status"><span className="dot" /> Online</div>
              </div>
            </div>
            <div className="ai-controls">
              <button type="button" aria-label={isMinimized ? "Maximize" : "Minimize"} title={isMinimized ? "Maximize" : "Minimize"} onClick={() => setIsMinimized(!isMinimized)}>
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
              <button type="button" aria-label="Close" title="Close" onClick={() => setIsOpen(false)}><X size={16} /></button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="ai-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`ai-msg-row ${m.role}`}>
                    {m.role === 'assistant' && <div className="ai-avatar"><Bot size={14} /></div>}
                    <div className="ai-msg-bubble">
                      <div className="content">{m.content}</div>
                      <div className="time">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="ai-msg-row assistant">
                    <div className="ai-avatar"><Bot size={14} /></div>
                    <div className="ai-msg-bubble loading">
                      <div className="dot-flashing" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="ai-input-area">
                <input 
                  type="text" 
                  placeholder={isListening ? "Listening..." : "Ask anything..."} 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={isLoading}
                  style={isListening ? { borderColor: '#ef4444', boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)' } : {}}
                />
                
                {/* Voice Typing Button */}
                <button 
                  type="button" 
                  aria-label={isListening ? "Stop listening" : "Start voice typing"} 
                  title={isListening ? "Stop listening" : "Start voice typing"} 
                  onClick={toggleListening}
                  className={`ai-voice-btn ${isListening ? 'listening' : ''}`}
                  disabled={isLoading}
                >
                  {isListening ? (
                    <MicOff size={18} />
                  ) : (
                    <Mic size={18} />
                  )}
                </button>

                <button type="button" aria-label="Send message" title="Send message" onClick={sendMessage} disabled={!input.trim() || isLoading || isListening}>
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
