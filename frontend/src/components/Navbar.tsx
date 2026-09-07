'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { User } from '@/lib/api';

interface NavbarProps {
  onSchedule: () => void;
  onJoinMeeting: () => void;
  onNewMeeting: () => void;
  currentUser?: User | null;
  onOpenAuth?: (tab?: 'login' | 'signup') => void;
  onLogout?: () => void;
}

export default function Navbar({
  onSchedule,
  onJoinMeeting,
  onNewMeeting,
  currentUser,
  onOpenAuth,
  onLogout,
}: NavbarProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = currentUser?.name || 'Kartik';
  const userEmail = currentUser?.email || 'kartik@zoom.us';
  const initial = userName.charAt(0).toUpperCase() || 'K';
  const pmi = currentUser?.personal_meeting_id || '248-679-1350';

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

        {/* Profile Avatar & Menu */}
        <div className="profile-menu-wrapper" ref={menuRef} style={{ position: 'relative' }}>
          <div
            className="navbar-avatar"
            title={`${userName} (${userEmail})`}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{ cursor: 'pointer' }}
          >
            <div className="avatar-inner">{initial}</div>
            <span className="user-online-dot"></span>
          </div>

          {showProfileMenu && (
            <div
              className="zoom-profile-popover"
              style={{
                position: 'absolute',
                top: '44px',
                right: 0,
                width: '280px',
                background: '#FFFFFF',
                borderRadius: '12px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
                border: '1px solid var(--border-color)',
                padding: '16px',
                zIndex: 1000,
                animation: 'popoverIn 0.15s ease-out',
              }}
            >
              {/* User Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'var(--zoom-blue)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 600,
                }}>
                  {initial}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {userName}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {userEmail}
                  </div>
                  <div style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', padding: '1px 6px', background: '#DCFCE7', color: '#166534', borderRadius: '4px' }}>
                    Licensed
                  </div>
                </div>
              </div>

              {/* PMI Details */}
              <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Personal Meeting ID (PMI)</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B', marginTop: '2px', fontFamily: 'monospace' }}>
                  {pmi}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenAuth?.('login');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  Switch Account / Sign In
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenAuth?.('signup');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--zoom-blue)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  Sign Up New Account
                </button>

                <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout?.();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#DC2626',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FEE2E2')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
