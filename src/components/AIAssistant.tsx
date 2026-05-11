'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, Minimize2, Maximize2, Bot } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AIAssistant() {
  const { profile, session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        <button className="ai-trigger-btn" onClick={() => setIsOpen(true)}>
          <Sparkles size={24} />
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
              <button onClick={() => setIsMinimized(!isMinimized)}>
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
              <button onClick={() => setIsOpen(false)}><X size={16} /></button>
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
                  placeholder="Ask anything..." 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} disabled={!input.trim() || isLoading}>
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
