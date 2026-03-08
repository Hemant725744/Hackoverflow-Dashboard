'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

type MenuItem = {
  title: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
};

type MenuSection = {
  label?: string;
  items: MenuItem[];
};

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setIsOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const sections: MenuSection[] = [
    {
      items: [
        {
          title: 'Dashboard',
          href: '/dashboard',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          ),
        },
      ],
    },
    {
      label: 'PARTICIPANTS',
      items: [
        {
          title: 'Participants',
          href: '/dashboard/participants',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          ),
        },
        {
          title: 'Check-in',
          href: '/dashboard/checkin',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          ),
        },
        {
          title: 'Scanner',
          href: '/dashboard/scanner',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
              <rect x="7" y="7" width="3" height="3"/>
              <rect x="14" y="7" width="3" height="3"/>
              <rect x="7" y="14" width="3" height="3"/>
              <path d="M14 14h3v3h-3z"/>
            </svg>
          ),
        },
        {
          title: 'Food',
          href: '/dashboard/food',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
          ),
        },
        {
          title: 'ID Cards',
          href: '/dashboard/id-cards',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2"></rect>
              <circle cx="8" cy="10" r="2"></circle>
              <path d="M14 10h4"></path>
              <path d="M14 14h4"></path>
              <path d="M6 16h4"></path>
            </svg>
          ),
        },
      ],
    },
    {
      label: 'LIVE OPS',
      items: [
        {
          title: 'Lab Monitoring',
          href: '/dashboard/Lab-Monitoring',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
            </svg>
          ),
          badge: 'LIVE',
          badgeColor: 'green',
        },
        {
          title: 'Volunteer Stats',
          href: '/dashboard/Volunteer-Stats',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          ),
        },
      ],
    },
    {
      label: 'COMMS',
      items: [
        {
          title: 'Mailer',
          href: '/dashboard/mailer',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          ),
        },
        {
          title: 'Sponsors',
          href: '/dashboard/sponsors',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
          ),
        },
      ],
    },
    {
      label: 'SYSTEM',
      items: [
        {
          title: 'Portal Config',
          href: '/dashboard/portal-config',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"></path>
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2"></path>
            </svg>
          ),
        },
        {
          title: 'Bot Config',
          href: '/dashboard/bot',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              <circle cx="12" cy="16" r="1"></circle>
            </svg>
          ),
        },
        {
          title: 'Database',
          href: '/dashboard/database',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
          ),
          badge: 'DB',
          badgeColor: 'green',
        },
      ],
    },
  ];

  const renderNavItem = (item: MenuItem, i: number) => {
    const isActive = pathname === item.href;
    const isGreenBadge = item.badgeColor === 'green';

    return (
      <Link
        key={i}
        href={item.href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.6rem 0.875rem',
          textDecoration: 'none',
          color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
          backgroundColor: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
          border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
          transition: 'all 0.15s ease',
          fontFamily: 'monospace',
          fontSize: '0.775rem',
          fontWeight: isActive ? 700 : 400,
          letterSpacing: '0.03em',
          borderRadius: '2px',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
          }
        }}
      >
        <span style={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          opacity: isActive ? 1 : 0.7,
        }}>
          {item.icon}
        </span>
        <span style={{ flex: 1 }}>{item.title}</span>
        {item.badge && (
          <span style={{
            fontFamily: 'monospace',
            fontSize: '0.5rem',
            padding: '0.15rem 0.35rem',
            border: `1px solid ${isGreenBadge ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.15)'}`,
            color: isGreenBadge ? 'rgba(74,222,128,0.8)' : 'rgba(255,255,255,0.35)',
            letterSpacing: '0.1em',
            lineHeight: 1.5,
            flexShrink: 0,
          }}>
            {item.badge}
          </span>
        )}
        {/* Active indicator dot */}
        {isActive && (
          <span style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.6)',
            flexShrink: 0,
          }} />
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div style={{
      width: '255px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
    }}>
      {/* Logo */}
      <div style={{
        padding: '1.25rem 1.25rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
      }}>
        <img
          src="/Images/BW.png"
          alt="Hackoverflow"
          style={{
            width: '40px',
            height: '40px',
            objectFit: 'contain',
            flexShrink: 0,
          }}
        />
        <div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            fontWeight: 900,
            letterSpacing: '0.12em',
            lineHeight: 1.1,
            color: '#fff',
          }}>
            HACKOVERFLOW
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '0.55rem',
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.2em',
            marginTop: '3px',
          }}>
            ADMIN PANEL
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '0.75rem 0.625rem',
        overflowY: 'auto',
        gap: '0',
      }}>
        {sections.map((section, si) => (
          <div key={si} style={{ marginBottom: section.label ? '0.25rem' : '0' }}>
            {section.label && (
              <div style={{
                fontFamily: 'monospace',
                fontSize: '0.5rem',
                letterSpacing: '0.18em',
                color: 'rgba(255,255,255,0.18)',
                padding: '0.75rem 0.875rem 0.4rem',
                fontWeight: 700,
              }}>
                {section.label}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {section.items.map((item, i) => renderNavItem(item, i))}
            </div>
            {si < sections.length - 1 && (
              <div style={{
                height: '1px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                margin: '0.625rem 0.875rem',
              }} />
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '0.875rem 1.25rem',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'rgba(74,222,128,0.8)',
          boxShadow: '0 0 6px rgba(74,222,128,0.5)',
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'monospace',
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.08em',
        }}>
          SYSTEM ONLINE
        </span>
      </div>
    </div>
  );

  // ── MOBILE ───────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: '60px',
          backgroundColor: '#050505',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src="/Images/BW.png"
              alt="Hackoverflow"
              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            />
            <span style={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              fontWeight: 900,
              letterSpacing: '0.1em',
              color: '#fff',
            }}>
              HACKOVERFLOW
            </span>
          </div>
          <button
            onClick={() => setIsOpen(prev => !prev)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              borderRadius: '2px',
            }}
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            )}
          </button>
        </div>

        {isOpen && (
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 110,
              backgroundColor: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
            }}
          />
        )}

        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 120,
          backgroundColor: '#050505',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowY: 'auto',
        }}>
          {sidebarContent}
        </div>

        <div style={{ height: '60px' }} />
      </>
    );
  }

  // ── DESKTOP ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '255px',
      height: '100vh',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      backgroundColor: '#050505',
    }}>
      {sidebarContent}
    </div>
  );
}