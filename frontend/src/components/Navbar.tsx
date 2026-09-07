'use client';

import Link from 'next/link';

interface NavbarProps {
  onSchedule: () => void;
  onJoinMeeting: () => void;
  onNewMeeting: () => void;
}

export default function Navbar({ onSchedule, onJoinMeeting, onNewMeeting }: NavbarProps) {
  return (
    <header className="navbar">
      <div className="navbar-left">
        <Link href="/" className="navbar-logo">
          <img src="/zoom-logo-new.png" alt="Zoom Logo" className="navbar-logo-img" />
        </Link>
      </div>

      <div className="navbar-right">
        <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); }}>Support</a>
        <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); onSchedule(); }}>Schedule</a>
        <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); onJoinMeeting(); }}>Join</a>
        <button className="nav-link-dropdown" onClick={onNewMeeting}>
          Host
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <button className="nav-link-dropdown">
          Web App
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <div className="navbar-avatar" title="Kartik (Host)">
          <div className="avatar-inner">K</div>
          <span className="user-online-dot"></span>
        </div>
      </div>
    </header>
  );
}



