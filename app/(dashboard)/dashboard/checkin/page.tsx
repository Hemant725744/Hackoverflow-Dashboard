'use client';

import { useState, useEffect } from 'react';
import { DBParticipant } from '@/types';
import { getParticipants, updateCheckInStatus } from '@/actions/participants';

interface Participant extends DBParticipant {
  checkInStatus: {
    collegeCheckedIn: boolean;
    collegeCheckInTime?: string;
    labCheckedIn: boolean;
    labCheckInTime?: string;
    labCheckedOut: boolean;
    labCheckOutTime?: string;
    tempLabCheckOut?: boolean;
    tempLabCheckOutTime?: string;
  };
}

// Legacy dummy data - will be replaced by DB data
const DUMMY_PARTICIPANTS: Participant[] = [
  {
    _id: 'participant-1',
    participantId: 'PART-001',
    name: 'Aditya',
    email: 'aditya@hackoverflow.com',
    phone: '+91 98765 43210',
    teamName: 'Team Alpha',
    role: 'Developer',
    checkInStatus: {
      collegeCheckedIn: true,
      collegeCheckInTime: '2026-02-07T09:30:00',
      labCheckedIn: true,
      labCheckInTime: '2026-02-07T10:15:00',
      labCheckedOut: false,
      tempLabCheckOut: true,
      tempLabCheckOutTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago - ALERT
    },
  },
  {
    _id: 'participant-2',
    participantId: 'PART-002',
    name: 'Parth',
    email: 'parth@hackoverflow.com',
    phone: '+91 98765 43211',
    teamName: 'Team Beta',
    role: 'Designer',
    checkInStatus: {
      collegeCheckedIn: true,
      collegeCheckInTime: '2026-02-07T09:45:00',
      labCheckedIn: false,
      labCheckedOut: false,
      tempLabCheckOut: false,
    },
  },
  {
    _id: 'participant-3',
    participantId: 'PART-003',
    name: 'Nirav',
    email: 'nirav@hackoverflow.com',
    phone: '+91 98765 43212',
    teamName: 'Team Gamma',
    role: 'Developer',
    checkInStatus: {
      collegeCheckedIn: true,
      collegeCheckInTime: '2026-02-07T09:20:00',
      labCheckedIn: true,
      labCheckInTime: '2026-02-07T10:00:00',
      labCheckedOut: false,
      tempLabCheckOut: true,
      tempLabCheckOutTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago - OK
    },
  },
  {
    _id: 'participant-4',
    participantId: 'PART-004',
    name: 'Kiran',
    email: 'kiran@hackoverflow.com',
    phone: '+91 98765 43213',
    teamName: 'Team Delta',
    role: 'Product Manager',
    checkInStatus: {
      collegeCheckedIn: false,
      labCheckedIn: false,
      labCheckedOut: false,
      tempLabCheckOut: false,
    },
  },
];

export default function CheckInPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'college' | 'lab' | 'checked-out' | 'not-arrived'>('all');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Auto-refresh every 30 seconds to check for alerts
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadParticipants();
  }, []);

  const loadParticipants = async () => {
    try {
      const dbParticipants = await getParticipants();
      // Transform DB participants to include check-in status
      const transformed: Participant[] = dbParticipants.map(p => ({
        ...p,
        checkInStatus: {
          collegeCheckedIn: p.collegeCheckIn?.status || false,
          collegeCheckInTime: p.collegeCheckIn?.time ? new Date(p.collegeCheckIn.time).toISOString() : undefined,
          labCheckedIn: p.labCheckIn?.status || false,
          labCheckInTime: p.labCheckIn?.time ? new Date(p.labCheckIn.time).toISOString() : undefined,
          labCheckedOut: p.labCheckOut?.status || false,
          labCheckOutTime: p.labCheckOut?.time ? new Date(p.labCheckOut.time).toISOString() : undefined,
          tempLabCheckOut: p.tempLabCheckOut?.status || false,
          tempLabCheckOutTime: p.tempLabCheckOut?.time ? new Date(p.tempLabCheckOut.time).toISOString() : undefined,
        }
      }));
      setParticipants(transformed);
      setFilteredParticipants(transformed);
    } catch (error) {
      console.error('Error loading participants:', error);
      // Fallback to dummy data on error
      setParticipants(DUMMY_PARTICIPANTS);
      setFilteredParticipants(DUMMY_PARTICIPANTS);
    }
  };

  useEffect(() => {
    let filtered = participants;

    // Apply search filter
    if (searchQuery.trim()) {
      const lowercaseQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(lowercaseQuery) ||
        p.email.toLowerCase().includes(lowercaseQuery) ||
        (p.phone && p.phone.toLowerCase().includes(lowercaseQuery)) ||
        (p.teamName && p.teamName.toLowerCase().includes(lowercaseQuery))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        switch (statusFilter) {
          case 'college':
            return p.checkInStatus.collegeCheckedIn && !p.checkInStatus.labCheckedIn;
          case 'lab':
            return p.checkInStatus.labCheckedIn && !p.checkInStatus.labCheckedOut;
          case 'checked-out':
            return p.checkInStatus.labCheckedOut;
          case 'not-arrived':
            return !p.checkInStatus.collegeCheckedIn;
          default:
            return true;
        }
      });
    }

    setFilteredParticipants(filtered);
  }, [searchQuery, statusFilter, participants]);

  const handleCheckIn = async (participantId: string, location: 'college' | 'lab') => {
    const now = new Date().toISOString();

    // Update UI optimistically
    setParticipants(prev => prev.map(p => {
      if (p._id !== participantId) return p;

      if (location === 'college') {
        return {
          ...p,
          checkInStatus: {
            ...p.checkInStatus!,
            collegeCheckedIn: true,
            collegeCheckInTime: now,
          }
        };
      } else {
        return {
          ...p,
          checkInStatus: {
            ...p.checkInStatus!,
            labCheckedIn: true,
            labCheckInTime: now,
          }
        };
      }
    }));

    // Update in MongoDB
    try {
      await updateCheckInStatus(participantId, location, true);
    } catch (error) {
      console.error('Error updating check-in:', error);
      // Reload on error
      await loadParticipants();
    }
  };

  const handleCheckOut = async (participantId: string) => {
    const now = new Date().toISOString();

    setParticipants(prev => prev.map(p => {
      if (p._id !== participantId) return p;

      return {
        ...p,
        checkInStatus: {
          ...p.checkInStatus,
          labCheckedOut: true,
          labCheckOutTime: now,
        }
      };
    }));

    // TODO: API call to update in MongoDB
    // await fetch('/api/participants/checkout', {
    //   method: 'POST',
    //   body: JSON.stringify({ participantId, timestamp: now })
    // });
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const getMinutesOutsideLab = (tempCheckOutTime?: string) => {
    if (!tempCheckOutTime) return 0;
    const now = currentTime.getTime();
    const checkOutTime = new Date(tempCheckOutTime).getTime();
    return Math.floor((now - checkOutTime) / (1000 * 60));
  };

  const isAlert = (participant: Participant) => {
    if (!participant.checkInStatus.tempLabCheckOut) return false;
    const minutesOut = getMinutesOutsideLab(participant.checkInStatus.tempLabCheckOutTime);
    return minutesOut > 10;
  };

  const getAlertParticipants = () => {
    return participants.filter(p => isAlert(p));
  };

  const getStatusBadge = (participant: Participant) => {
    const { checkInStatus } = participant;

    if (checkInStatus.labCheckedOut) {
      return { text: 'CHECKED OUT', color: 'rgba(255, 255, 255, 0.3)' };
    }
    if (checkInStatus.tempLabCheckOut) {
      const minutesOut = getMinutesOutsideLab(checkInStatus.tempLabCheckOutTime);
      if (minutesOut > 10) {
        return { text: `OUT ${minutesOut}m ⚠️`, color: 'rgba(255, 255, 255, 0.9)' };
      }
      return { text: `TEMP OUT ${minutesOut}m`, color: 'rgba(255, 255, 255, 0.7)' };
    }
    if (checkInStatus.labCheckedIn) {
      return { text: 'IN LAB', color: 'rgba(255, 255, 255, 0.9)' };
    }
    if (checkInStatus.collegeCheckedIn) {
      return { text: 'IN COLLEGE', color: 'rgba(255, 255, 255, 0.6)' };
    }
    return { text: 'NOT ARRIVED', color: 'rgba(255, 255, 255, 0.2)' };
  };

  const stats = {
    total: participants.length,
    collegeOnly: participants.filter(p => p.checkInStatus.collegeCheckedIn && !p.checkInStatus.labCheckedIn).length,
    inLab: participants.filter(p => p.checkInStatus.labCheckedIn && !p.checkInStatus.labCheckedOut && !p.checkInStatus.tempLabCheckOut).length,
    tempOut: participants.filter(p => p.checkInStatus.tempLabCheckOut && !p.checkInStatus.labCheckedOut).length,
    alerts: getAlertParticipants().length,
    checkedOut: participants.filter(p => p.checkInStatus.labCheckedOut).length,
    notArrived: participants.filter(p => !p.checkInStatus.collegeCheckedIn).length,
  };

  return (
    <>
      {/* ── Mobile-responsive overrides ── */}
      <style>{`
        .ci-page { padding: 3rem; }
        .ci-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
        .ci-filter { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
        .ci-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; }
        .ci-timeline { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
        .ci-alert-row { display: flex; justify-content: space-between; align-items: center; }
        .ci-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        @media (max-width: 640px) {
          .ci-page { padding: 1.25rem; padding-top: calc(60px + 1.25rem); }
          .ci-stats { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
          .ci-filter { grid-template-columns: 1fr; gap: 1rem; }
          .ci-meta { grid-template-columns: 1fr; }
          .ci-timeline { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
          .ci-alert-row { flex-wrap: wrap; gap: 0.75rem; }
          .ci-actions { flex-direction: column; }
          .ci-actions button { width: 100%; }
        }
      `}</style>

      <div className="ci-page">
        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            marginBottom: '0.5rem'
          }}>
            CHECK-IN STATUS
          </h1>
          <p style={{
            fontFamily: 'monospace',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '1rem'
          }}>
            Track participant arrival and movement
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '2rem'
        }}>
          {/* Alert Section */}
          {stats.alerts > 0 && (
            <div style={{
              border: '2px solid rgba(255, 255, 255, 0.6)',
              padding: '1.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              animation: 'pulse 2s ease-in-out infinite'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div>
                  <div style={{
                    fontSize: '1rem',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    letterSpacing: '0.05em'
                  }}>
                    ALERT: {stats.alerts} PARTICIPANT{stats.alerts > 1 ? 'S' : ''} OUT FOR MORE THAN 10 MINUTES
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: 'rgba(255, 255, 255, 0.6)',
                    marginTop: '0.25rem'
                  }}>
                    These participants may need attention. Check property safety.
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {getAlertParticipants().map(participant => {
                  const minutesOut = getMinutesOutsideLab(participant.checkInStatus.tempLabCheckOutTime);
                  return (
                    <div
                      key={participant._id}
                      className="ci-alert-row"
                      style={{
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        padding: '1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)'
                      }}
                    >
                      <div>
                        <div style={{
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          fontWeight: 'bold'
                        }}>
                          {participant.name}
                        </div>
                        <div style={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: 'rgba(255, 255, 255, 0.6)',
                          marginTop: '0.25rem'
                        }}>
                          {participant.email} • {participant.teamName || 'No team'}
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                      }}>
                        <div style={{
                          textAlign: 'right'
                        }}>
                          <div style={{
                            fontFamily: 'monospace',
                            fontSize: '1.5rem',
                            fontWeight: 'bold'
                          }}>
                            {minutesOut}m
                          </div>
                          <div style={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            color: 'rgba(255, 255, 255, 0.5)'
                          }}>
                            Outside
                          </div>
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          padding: '0.5rem 1rem',
                          border: '1px solid rgba(255, 255, 255, 0.4)',
                          color: 'rgba(255, 255, 255, 0.9)',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap'
                        }}>
                          ⚠️ ALERT
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="ci-stats">
            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem',
              transition: 'border-color 0.3s'
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}>
              <div style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em'
              }}>
                TOTAL
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{stats.total}</div>
            </div>

            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem',
              transition: 'border-color 0.3s'
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}>
              <div style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em'
              }}>
                IN COLLEGE
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{stats.collegeOnly}</div>
            </div>

            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem',
              transition: 'border-color 0.3s'
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}>
              <div style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em'
              }}>
                IN LAB
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{stats.inLab}</div>
            </div>

            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem',
              transition: 'border-color 0.3s'
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}>
              <div style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em'
              }}>
                TEMP OUT
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{stats.tempOut}</div>
            </div>

            <div style={{
              border: stats.alerts > 0 ? '2px solid rgba(255, 255, 255, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem',
              transition: 'border-color 0.3s',
              backgroundColor: stats.alerts > 0 ? 'rgba(255, 255, 255, 0.05)' : 'transparent'
            }}
              onMouseEnter={(e) => {
                if (stats.alerts === 0) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (stats.alerts === 0) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }
              }}>
              <div style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em'
              }}>
                {stats.alerts > 0 ? '⚠️ ALERTS' : 'ALERTS'}
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{stats.alerts}</div>
            </div>

            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem',
              transition: 'border-color 0.3s'
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}>
              <div style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em'
              }}>
                CHECKED OUT
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{stats.checkedOut}</div>
            </div>

            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem',
              transition: 'border-color 0.3s'
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}>
              <div style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em'
              }}>
                NOT ARRIVED
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{stats.notArrived}</div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="ci-filter">
            {/* Search */}
            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem',
              transition: 'border-color 0.3s'
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '0.75rem',
                letterSpacing: '0.05em'
              }}>
                SEARCH PARTICIPANTS
              </label>
              <div style={{ position: 'relative' }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    opacity: 0.4
                  }}
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, phone, team..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    padding: '0.75rem 1rem 0.75rem 3rem',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem',
              transition: 'border-color 0.3s'
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '0.75rem',
                letterSpacing: '0.05em'
              }}>
                FILTER BY STATUS
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '0.75rem 1rem',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
              >
                <option value="all" style={{ backgroundColor: '#000' }}>All Participants</option>
                <option value="not-arrived" style={{ backgroundColor: '#000' }}>Not Arrived</option>
                <option value="college" style={{ backgroundColor: '#000' }}>In College Only</option>
                <option value="lab" style={{ backgroundColor: '#000' }}>In Lab</option>
                <option value="checked-out" style={{ backgroundColor: '#000' }}>Checked Out</option>
              </select>
            </div>
          </div>

          {/* Participants List */}
          <div style={{
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '1.5rem'
          }}>
            <div style={{
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '1.5rem',
              letterSpacing: '0.05em'
            }}>
              PARTICIPANTS ({filteredParticipants.length})
            </div>

            {filteredParticipants.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '4rem 0',
                color: 'rgba(255, 255, 255, 0.3)',
                fontFamily: 'monospace',
                fontSize: '0.875rem'
              }}>
                No participants match your search
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                {filteredParticipants.map((participant) => {
                  const badge = getStatusBadge(participant);

                  return (
                    <div
                      key={participant._id}
                      style={{
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '1.25rem',
                        transition: 'all 0.3s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: 'monospace',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            marginBottom: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            flexWrap: 'wrap'
                          }}>
                            {participant.name}
                            <div style={{
                              fontSize: '0.75rem',
                              fontWeight: 'normal',
                              padding: '0.25rem 0.75rem',
                              border: `1px solid ${badge.color}`,
                              color: badge.color,
                              letterSpacing: '0.05em',
                              whiteSpace: 'nowrap'
                            }}>
                              {badge.text}
                            </div>
                          </div>
                          <div className="ci-meta" style={{
                            fontSize: '0.875rem',
                            fontFamily: 'monospace',
                            color: 'rgba(255, 255, 255, 0.6)'
                          }}>
                            <div>
                              <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Email:</span> {participant.email}
                            </div>
                            {participant.phone && (
                              <div>
                                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Phone:</span> {participant.phone}
                              </div>
                            )}
                            {participant.teamName && (
                              <div>
                                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Team:</span> {participant.teamName}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Check-in Timeline */}
                      <div className="ci-timeline" style={{
                        marginBottom: '1rem',
                        padding: '1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                      }}>
                        <div>
                          <div style={{
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            color: 'rgba(255, 255, 255, 0.5)',
                            marginBottom: '0.25rem',
                            letterSpacing: '0.05em'
                          }}>
                            COLLEGE CHECK-IN
                          </div>
                          <div style={{
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            color: participant.checkInStatus.collegeCheckedIn ? '#fff' : 'rgba(255, 255, 255, 0.3)'
                          }}>
                            {formatTime(participant.checkInStatus.collegeCheckInTime)}
                          </div>
                        </div>

                        <div>
                          <div style={{
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            color: 'rgba(255, 255, 255, 0.5)',
                            marginBottom: '0.25rem',
                            letterSpacing: '0.05em'
                          }}>
                            LAB CHECK-IN
                          </div>
                          <div style={{
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            color: participant.checkInStatus.labCheckedIn ? '#fff' : 'rgba(255, 255, 255, 0.3)'
                          }}>
                            {formatTime(participant.checkInStatus.labCheckInTime)}
                          </div>
                        </div>

                        {participant.checkInStatus.tempLabCheckOut && (
                          <div>
                            <div style={{
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              color: isAlert(participant) ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                              marginBottom: '0.25rem',
                              letterSpacing: '0.05em'
                            }}>
                              {isAlert(participant) ? '⚠️ TEMP OUT' : 'TEMP OUT'}
                            </div>
                            <div style={{
                              fontFamily: 'monospace',
                              fontSize: '0.875rem',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              {formatTime(participant.checkInStatus.tempLabCheckOutTime)}
                              <span style={{
                                fontSize: '0.75rem',
                                color: isAlert(participant) ? '#fff' : 'rgba(255, 255, 255, 0.6)'
                              }}>
                                ({getMinutesOutsideLab(participant.checkInStatus.tempLabCheckOutTime)}m)
                              </span>
                            </div>
                          </div>
                        )}

                        <div>
                          <div style={{
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            color: 'rgba(255, 255, 255, 0.5)',
                            marginBottom: '0.25rem',
                            letterSpacing: '0.05em'
                          }}>
                            COLLEGE CHECK-OUT
                          </div>
                          <div style={{
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            color: participant.checkInStatus.labCheckedOut ? '#fff' : 'rgba(255, 255, 255, 0.3)'
                          }}>
                            {formatTime(participant.checkInStatus.labCheckOutTime)}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="ci-actions">
                        {!participant.checkInStatus.collegeCheckedIn && (
                          <button
                            onClick={() => handleCheckIn(participant._id!, 'college')}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#fff',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.3s',
                              letterSpacing: '0.05em'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            }}
                          >
                            CHECK IN AT COLLEGE
                          </button>
                        )}

                        {participant.checkInStatus.collegeCheckedIn && !participant.checkInStatus.labCheckedIn && (
                          <button
                            onClick={() => handleCheckIn(participant._id!, 'lab')}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#fff',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.3s',
                              letterSpacing: '0.05em'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            }}
                          >
                            CHECK IN AT LAB
                          </button>
                        )}

                        {participant.checkInStatus.labCheckedIn && !participant.checkInStatus.labCheckedOut && (
                          <button
                            onClick={() => handleCheckOut(participant._id!)}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#fff',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.3s',
                              letterSpacing: '0.05em'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            }}
                          >
                            CHECK OUT FROM LAB
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

