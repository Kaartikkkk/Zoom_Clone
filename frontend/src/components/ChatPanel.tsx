'use client';

import { useState, useRef, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isMe?: boolean;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export default function ChatPanel({
  isOpen,
  onClose,
  messages,
  onSendMessage,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <h3>In-Meeting Chat</h3>
        <button className="chat-panel-close" onClick={onClose} title="Close Chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="chat-messages-list">
        <div className="chat-notice">
          🔒 Messages are end-to-end encrypted and visible to everyone in the meeting room.
        </div>
        {messages.map((m) => (
          <div key={m.id} className={`chat-message-item ${m.isMe ? 'is-me' : ''}`}>
            <div className="chat-message-meta">
              <span className="sender">{m.sender}</span>
              <span className="time">{m.time}</span>
            </div>
            <div className="chat-message-bubble">{m.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type message here..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={!inputText.trim()} title="Send message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}
