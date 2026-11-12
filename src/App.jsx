import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import { CalendarDays, FileText, History, ChevronRight, FileDown, CalendarRange, ClipboardList, Clock, Trash2, LogOut, LogIn, ShieldCheck, Pencil, Phone, Mail, CheckCircle, XCircle, AlertCircle, Settings, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';

import { C, FONT_DISPLAY, FONT_BODY, DEFAULT_OTHER_COLOR } from './shared/theme';
import { todayISO, firstOfMonth } from './shared/helpers';
import FormPage from './form/FormPage';
import CalendarPage from './calendar/CalendarPage';
import ReportPage from './report/ReportPage';
import ExportPage from './export/ExportPage';
import PastJobsPage from './past-jobs/PastJobsPage';
import SettingsPage from './settings/SettingsPage';
import LoginPage from './auth/LoginPage';

const ALL_NAV = [
  { id: 'form',     label: 'Form',      icon: ClipboardList },
  { id: 'calendar', label: 'Calendar',  icon: CalendarDays },
  { id: 'report',   label: 'Pending Jobs',    icon: Clock },
  { id: 'pastjobs', label: 'Past Jobs', icon: History },
  { id: 'export',   label: 'Export',    icon: FileDown },
  { id: 'settings', label: 'Settings',  icon: Settings },
];

const DRIVER_NAV = [
  { id: 'calendar', label: 'Calendar',  icon: CalendarDays },
];

const PUBLIC_NAV = [
  { id: 'form',     label: 'Form',      icon: ClipboardList },
];

export default function App() {
  const [view, setView] = useState('login');
  const [exportStart, setExportStart] = useState(firstOfMonth(todayISO()));
  const [exportEnd, setExportEnd] = useState(todayISO());
  const [exporting, setExporting] = useState(false);
  const [pastJobs, setPastJobs] = useState([]);
  const [cancelledJobs, setCancelledJobs] = useState([]);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [driversConfig, setDriversConfig] = useState({ drivers: [], otherColor: DEFAULT_OTHER_COLOR });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'Settings', 'drivers'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDriversConfig({
          drivers: data.drivers || [],
          otherColor: data.otherColor || DEFAULT_OTHER_COLOR,
        });
      }
    }, (err) => {
      console.warn('Settings snapshot error (offline):', err.code);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem('driversSeeded')) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'Settings', 'drivers'));
        if (!snap.exists()) {
          await setDoc(doc(db, 'Settings', 'drivers'), {
            drivers: [
              { name: 'Brent Roberts', color: '#3B82F6' },
              { name: 'Vincent Hernandez', color: '#8B5CF6' },
              { name: 'Taurean Joseph', color: '#F59E0B' },
              { name: 'Jeremy Lennard', color: '#EF4444' },
              { name: 'Steven Larocque', color: '#EC4899' },
            ],
            otherColor: '#94A3B8',
          });
        }
        sessionStorage.setItem('driversSeeded', '1');
      } catch (err) {
        console.warn('Driver seed error:', err.code);
      }
    })();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      if (view !== 'login' && view !== 'form') setView('login');
    } else if (view === 'login') {
      setView(user.email === 'drivers@transport.org' ? 'calendar' : 'form');
    }
  }, [user]);

  const NAV_ITEMS = (!user ? PUBLIC_NAV : user.email === 'drivers@transport.org' ? DRIVER_NAV : ALL_NAV)
    .filter(t => !(Capacitor.isNativePlatform() && t.id === 'export'));

  const handleSignedIn = (email) => {
    setView(email === 'drivers@transport.org' ? 'calendar' : 'form');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'Requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPastJobs(all.filter(r => r.status === 'completed'));
      setCancelledJobs(all.filter(r => r.status === 'cancelled'));
    }, (err) => {
      console.warn('PastJobs snapshot error (offline):', err.code);
    });
    return unsub;
  }, []);

  const presetRange = (preset) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const fmt = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    if (preset === 'thisMonth') {
      const start = d >= 26 ? new Date(y, m, 26) : new Date(y, m - 1, 26);
      const end = d >= 26 ? new Date(y, m + 1, 25) : new Date(y, m, 25);
      setExportStart(fmt(start));
      setExportEnd(fmt(end));
    } else if (preset === 'lastMonth') {
      const start = d >= 26 ? new Date(y, m - 1, 26) : new Date(y, m - 2, 26);
      const end = d >= 26 ? new Date(y, m, 25) : new Date(y, m - 1, 25);
      setExportStart(fmt(start));
      setExportEnd(fmt(end));
    } else if (preset === 'last7') {
      const start = new Date(y, m, now.getDate() - 6);
      setExportStart(fmt(start));
      setExportEnd(fmt(now));
    } else if (preset === 'thisYear') {
      setExportStart(`${y}-01-01`);
      setExportEnd(`${y}-12-31`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, color: C.ink, fontFamily: FONT_BODY }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, button:focus, select:focus { outline: none; }
        input:focus-visible, button:focus-visible { box-shadow: 0 0 0 3px ${C.softBg}, 0 0 0 4px ${C.cardinal}; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.55; cursor: pointer; }
        @keyframes fdsaFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        .fdsa-fade { animation: fdsaFade .25s ease; }

        @media (max-width: 1024px) {
          .fdsa-header { flex-direction: column !important; gap: 16px !important; padding: 16px 20px !important; }
          .fdsa-logo-img { width: 140px !important; height: 78px !important; }
          .fdsa-title { font-size: 22px !important; }
          .fdsa-main { padding: 20px 16px 16px !important; }
          .fdsa-footer { padding: 24px 20px !important; }
          .fdsa-footer-logo { width: 260px !important; }
          .cal-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .exp-grid { grid-template-columns: 1fr !important; }
          .rpt-title { font-size: 22px !important; }
        }

        @media (max-width: 640px) {
          .cal-grid { grid-template-columns: 1fr !important; }
          .cal-month { padding: 10px !important; }
          .cal-month-name { font-size: 13px !important; }
          .cal-day { font-size: 11px !important; }
          .cal-head { flex-direction: column !important; gap: 12px !important; align-items: flex-start !important; }
          .cal-year-nav { width: 100% !important; justify-content: center !important; }
          .cal-modal { padding: 20px !important; }
          .cal-day-modal-text { font-size: 16px !important; }
          .fdsa-header { padding: 12px 14px !important; gap: 12px !important; flex-direction: column !important; align-items: center !important; text-align: center !important; }
          .fdsa-header-left { flex-direction: column !important; align-items: center !important; gap: 8px !important; }
          .fdsa-header-right { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
          .fdsa-logo-img { width: 120px !important; height: 66px !important; }
          .fdsa-subtitle { display: none !important; }
          .fdsa-title { font-size: 18px !important; }
          .fdsa-main { padding: 16px 12px 12px !important; }
          .fdsa-nav { gap: 0 !important; padding: 0 12px !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; scrollbar-width: none !important; }
          .fdsa-nav::-webkit-scrollbar { display: none !important; }
          .fdsa-nav-btn { padding: 12px 12px !important; font-size: 12px !important; white-space: nowrap !important; flex-shrink: 0 !important; }
          .fdsa-footer { padding: 20px 14px !important; gap: 8px !important; }
          .fdsa-footer-logo { width: 200px !important; }
          .fdsa-footer-brand { font-size: 14px !important; }
          .exp-grid { grid-template-columns: 1fr !important; }
          .exp-card { padding: 16px !important; }
          .exp-title { font-size: 22px !important; }
          .exp-date-grid { grid-template-columns: 1fr !important; }
          .pj-card { padding: 12px 14px !important; flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
          .pj-empty { padding: 24px 16px !important; }
          .rpt-title { font-size: 22px !important; }
          .rpt-stat { max-width: 100% !important; }
          .rpt-recent { padding: 16px !important; }
          .rpt-trip { flex-direction: column !important; gap: 4px !important; align-items: flex-start !important; }
          .rpt-detail-header { flex-direction: column !important; gap: 8px !important; align-items: flex-start !important; }
          .rpt-detail-btns { width: 100% !important; justify-content: flex-start !important; }
          .rpt-status-bar { flex-wrap: wrap !important; }
          .rpt-status-btn { min-width: 0 !important; font-size: 11px !important; padding: 8px 4px !important; }
          .pj-detail-grid { grid-template-columns: 1fr !important; }
          .rpt-edit-grid { grid-template-columns: 1fr !important; }
          .contact-action { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
        }
        @media (max-width: 480px) {
          .fdsa-header { flex-direction: column !important; align-items: center !important; text-align: center !important; }
        }
      `}</style>

      {/* ================ HEADER ================ */}
      <header style={{ backgroundColor: C.card, borderBottom: `1px solid ${C.line}` }}>
        <div className="fdsa-header" style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, position: 'relative' }}>
          <div className="fdsa-header-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img className="fdsa-logo-img" src="usc.png" alt="USC Transport" style={{ width: 180, height: 100, objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <div className="fdsa-subtitle" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.28em', color: C.mute, fontWeight: 500 }}>
                Transport Department
              </div>
              <h1 className="fdsa-title" style={{ margin: '2px 0 0', fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 500, letterSpacing: '-0.015em', color: C.ink }}>
                Transport Admin Assistant
              </h1>
            </div>
          </div>

          {/* Staff Login / User Info */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.ink }}>
                  <ShieldCheck size={16} style={{ color: C.cardinal }} />
                  <span style={{ fontWeight: 600 }}>
                    {user.email === 'admin@transport.org' ? 'Admin' : 'Driver'}
                  </span>
                </div>
                <button onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', background: 'transparent',
                    border: `1px solid ${C.lineStrong}`, borderRadius: 6,
                    cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: FONT_BODY,
                    color: C.mute, transition: 'all .15s',
                  }}>
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            ) : (
              <button onClick={() => setView('login')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', background: view === 'login' ? C.softBg : 'transparent',
                  border: `1px solid ${C.lineStrong}`, borderRadius: 6,
                  cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: FONT_BODY,
                  color: C.ink, transition: 'all .15s',
                }}>
                <LogIn size={14} />
                Staff Login
              </button>
            )}
          </div>
        </div>
        {NAV_ITEMS.length > 0 && (
        <nav className="fdsa-nav" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px', display: 'flex', gap: 2, borderTop: `1px solid ${C.line}` }}>
          {NAV_ITEMS.map(t => {
            const active = view === t.id;
            const Ico = t.icon;
            return (
              <button
                key={t.id}
                className="fdsa-nav-btn"
                onClick={() => setView(t.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 18px', fontSize: 13, fontWeight: 500, fontFamily: FONT_BODY,
                  color: active ? C.cardinal : C.mute,
                  borderBottom: `2px solid ${active ? C.cardinal : 'transparent'}`,
                  marginBottom: -1,
                  display: 'flex', alignItems: 'center', gap: 8,
                  letterSpacing: '0.02em',
                  transition: 'color .15s',
                }}
              >
                <Ico size={15} strokeWidth={active ? 2.2 : 1.8} />
                {t.label}
              </button>
            );
          })}
        </nav>
        )}
      </header>

      {/* ================ MAIN ================ */}
      <main className="fdsa-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 28px 24px' }}>
        {view === 'login' && !user && (
          <LoginPage onSignedIn={handleSignedIn} onGuest={() => setView('form')} />
        )}
        {view === 'calendar' && <CalendarPage driversConfig={driversConfig} />}
        {view === 'form' && <FormPage />}
        {view === 'pastjobs' && <PastJobsPage driversConfig={driversConfig} />}
        {view === 'report' && <ReportPage setView={setView} driversConfig={driversConfig} />}
        {view === 'settings' && <SettingsPage driversConfig={driversConfig} />}
        {view === 'export' && (
          <ExportPage
            start={exportStart} end={exportEnd}
            setStart={setExportStart} setEnd={setExportEnd}
            presetRange={presetRange}
            pastJobs={pastJobs} cancelledJobs={cancelledJobs} exporting={exporting}
            setExporting={setExporting}
          />
        )}
      </main>

      {/* ================ FOOTER ================ */}
      <footer className="fdsa-footer" style={{ borderTop: `1px solid ${C.line}`, backgroundColor: C.card, marginTop: 40 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <img className="fdsa-footer-logo" src="usclogo.png" alt="USC Gym" style={{ width: 340, maxWidth: '100%', height: 'auto' }} />
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <div className="fdsa-footer-brand" style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 500, color: C.ink, letterSpacing: '0.01em' }}>
              USC Transport Department
            </div>
          </div>
          <div style={{ fontSize: 13, color: C.mute, fontStyle: 'italic', textAlign: 'center', maxWidth: 600, lineHeight: 1.6 }}>
            &ldquo;For I know the plans I have for you,&rdquo; declares the LORD, &ldquo;plans to prosper you and not to harm you, plans to give you hope and a future.&rdquo;
          </div>
          <div style={{ fontSize: 12, color: C.mute, textAlign: 'center', marginTop: -4 }}>
            Jeremiah 29:11
          </div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.28em', color: C.faint, fontWeight: 500, textAlign: 'center', lineHeight: 1.8 }}>
            Made by Aalon Peters · 2026<br />Version 1.6
          </div>
        </div>
      </footer>
    </div>
  );
}
