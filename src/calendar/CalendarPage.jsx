import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronRight, X, Phone } from 'lucide-react';
import { C, FONT_DISPLAY, FONT_BODY } from '../shared/theme';
import { formatDateShort, to12h } from '../shared/helpers';

export default function CalendarPage({ driversConfig }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [approvedTrips, setApprovedTrips] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'Requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setApprovedTrips(all.filter(r => r.status === 'approved'));
    }, (err) => {
      console.warn('Calendar snapshot error (offline):', err.code);
    });
    return unsub;
  }, []);

  const tripsByDate = {};
  approvedTrips.forEach(r => {
    if (!tripsByDate[r.pickupDate]) tripsByDate[r.pickupDate] = [];
    tripsByDate[r.pickupDate].push({ ...r, _role: 'pickup' });
    if (r.serviceType === 'round-trip' && r.returnDate && r.returnDate !== r.pickupDate) {
      if (!tripsByDate[r.returnDate]) tripsByDate[r.returnDate] = [];
      tripsByDate[r.returnDate].push({ ...r, _role: 'return' });
    }
  });

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DAYS_IN_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];

  const getDaysInMonth = (mi) =>
    mi === 1 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : DAYS_IN_MONTH[mi];

  const getFirstDay = (mi) => new Date(year, mi, 1).getDay();

  const formatDateKey = (mi, d) =>
    `${year}-${String(mi+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const formatDateLong = (key) => {
    if (!key) return '';
    const [y,m,d] = key.split('-').map(Number);
    return new Date(y,m-1,d).toLocaleDateString('en-US',
      { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  };

  const selectedLabel = selectedDate ? formatDateLong(selectedDate) : '';

  return (
    <div className="fdsa-fade">
      {/* ---------- HEADER ---------- */}
      <div className="cal-head" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <h2 style={{ margin:0, fontFamily:FONT_DISPLAY, fontSize:24, fontWeight:500, color:C.ink }}>
          Calendar
        </h2>
        <div className="cal-year-nav" style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => setYear(y => y - 1)}
            style={{ padding:'8px 12px', border:`1px solid ${C.lineStrong}`, borderRadius:6, background:C.card, cursor:'pointer', fontSize:13, color:C.ink, display:'flex', alignItems:'center' }}>
            <ChevronRight size={16} style={{ transform:'rotate(180deg)' }} />
          </button>
          <span style={{ fontFamily:FONT_DISPLAY, fontSize:18, fontWeight:600, color:C.ink, minWidth:60, textAlign:'center' }}>
            {year}
          </span>
          <button onClick={() => setYear(y => y + 1)}
            style={{ padding:'8px 12px', border:`1px solid ${C.lineStrong}`, borderRadius:6, background:C.card, cursor:'pointer', fontSize:13, color:C.ink, display:'flex', alignItems:'center' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ---------- DRIVER KEY ---------- */}
      <div style={{ display:'flex', gap:16, marginBottom:20, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, fontWeight:600, color:C.mute, marginRight:4 }}>Key:</span>
        {driversConfig.drivers.map(d => (
          <div key={d.name} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:C.mute }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:d.color }} />
            {d.name}
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:C.mute }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:driversConfig.otherColor }} />
          Other
        </div>
      </div>

      {/* ---------- MONTH GRID ---------- */}
      <div className="cal-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:20 }}>
        {MONTHS.map((monthName, mi) => {
          const daysInMonth = getDaysInMonth(mi);
          const firstDay = getFirstDay(mi);
          return (
            <div className="cal-month" key={mi} style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:12, padding:16 }}>
              <div className="cal-month-name" style={{ textAlign:'center', fontSize:14, fontWeight:600, color:C.ink, marginBottom:12 }}>
                {monthName}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 }}>
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} style={{ textAlign:'center', fontSize:10, fontWeight:500, color:C.mute, padding:'4px 0' }}>
                    {d}
                  </div>
                ))}
                {Array(firstDay).fill(null).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {Array(daysInMonth).fill(null).map((_, i) => {
                  const day = i + 1;
                  const dateKey = formatDateKey(mi, day);
                  const isToday = day === today.getDate() && mi === today.getMonth() && year === today.getFullYear();
                  const isSelected = selectedDate === dateKey;
                  const dayTrips = tripsByDate[dateKey] || [];
                  const uniqueDrivers = [...new Set(dayTrips.map(t => t.assignedDriver).filter(Boolean))];
                  const hasTrip = dayTrips.length > 0;
                  return (
                    <button key={day}
                      className="cal-day"
                      onClick={() => setSelectedDate(dateKey)}
                      style={{
                        aspectRatio:'1', display:'flex', flexDirection:'column',
                        alignItems:'center', justifyContent:'center', fontSize:12,
                        fontWeight: isToday ? 700 : (hasTrip ? 600 : 400), fontFamily:FONT_BODY,
                        color: isToday && !isSelected ? C.cardinal : isSelected ? '#fff' : C.ink,
                        background: isSelected ? C.cardinal : isToday ? C.successBg : 'transparent',
                        border:'none', borderRadius:6,
                        cursor:'pointer', position:'relative', transition:'all .15s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.softBg; }}
                      onMouseLeave={e => { if (!isSelected && !isToday) e.currentTarget.style.background = 'transparent'; else if (!isSelected) e.currentTarget.style.background = C.successBg; }}>
                      {day}
                      {uniqueDrivers.length > 0 && (
                        <div style={{ display:'flex', gap:3, marginTop:2 }}>
                          {uniqueDrivers.map(driver => {
                            const dName = (driver || '').trim().toLowerCase();
                            const matched = driversConfig.drivers.find(d => {
                              const dn = d.name.toLowerCase();
                              return dn === dName || dn.split(' ')[0] === dName;
                            });
                            const dotColor = matched ? matched.color : driversConfig.otherColor;
                            return (
                              <div key={driver} style={{ width:5, height:5, borderRadius:'50%', background: isSelected ? '#fff' : dotColor }} />
                            );
                          })}
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
          );
        })}
        </div>

      {/* ---------- DAY DETAIL MODAL ---------- */}
      {selectedDate && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(43,35,25,0.4)',
          backdropFilter:'blur(4px)', display:'flex', alignItems:'center',
          justifyContent:'center', zIndex:100, padding:20,
        }} onClick={() => setSelectedDate(null)}>
          <div className="cal-modal" style={{
            background:C.card, borderRadius:14,
            boxShadow:'0 20px 60px rgba(43,35,25,0.25)', padding:28,
            maxWidth:400, width:'100%', position:'relative', maxHeight:'80vh', overflowY:'auto',
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedDate(null)}
              style={{
                position:'absolute', top:12, right:12, background:'none', border:'none',
                cursor:'pointer', color:C.faint, padding:4, display:'flex',
              }}>
              <X size={18} />
            </button>
            <h3 style={{ margin:'0 0 8px', fontFamily:FONT_DISPLAY, fontSize:18, fontWeight:500, color:C.ink }}>
              {selectedLabel}
            </h3>
            {tripsByDate[selectedDate]?.length > 0 && <>
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:8 }}>
                {tripsByDate[selectedDate].map((trip, i) => (
                  <div key={trip.id + '-' + trip._role} onClick={() => setSelectedTrip(trip)} style={{ padding:12, background:C.softBg, borderRadius:8, border:`1px solid ${C.line}`, cursor:'pointer' }}>
                    <div style={{ fontSize:12, color:C.ink, lineHeight:1.8 }}>
                      <div><strong>Recipient:</strong> {trip.recipientName}</div>
                      {trip._role === 'return' ? (
                        <>
                          <div><strong>Return Date:</strong> {formatDateShort(trip.returnDate)} · {to12h(trip.returnTime)}</div>
                          <div><strong>Returning from:</strong> {trip.dropoffLocation}</div>
                        </>
                      ) : (
                        <>
                          <div><strong>Date:</strong> {formatDateShort(trip.pickupDate)} · {to12h(trip.pickupTime)}</div>
                          <div><strong>Pickup:</strong> {trip.pickupLocation}</div>
                          <div><strong>Drop off:</strong> {trip.dropoffLocation}</div>
                          <div><strong>Service Type:</strong> {trip.serviceType === 'round-trip' ? 'Round Trip' : 'One-way'}</div>
                          {trip.serviceType === 'round-trip' && <div><strong>Return Time:</strong> {formatDateShort(trip.returnDate)} · {to12h(trip.returnTime)}</div>}
                        </>
                      )}
                      <div style={{fontWeight:700}}>Driver Assigned: {trip.assignedDriver || 'Not assigned'}</div>
                    </div>
                  </div>
          ))}
        </div>
        </>}
      </div>

      {selectedTrip && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(43,35,25,0.4)',
          backdropFilter:'blur(4px)', display:'flex', alignItems:'center',
          justifyContent:'center', zIndex:110, padding:20,
        }} onClick={() => setSelectedTrip(null)}>
          <div className="cal-modal" style={{
            background:C.card, borderRadius:14,
            boxShadow:'0 20px 60px rgba(43,35,25,0.25)', padding:28,
            maxWidth:420, width:'100%', position:'relative', maxHeight:'80vh', overflowY:'auto',
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedTrip(null)}
              style={{
                position:'absolute', top:12, right:12, background:'none', border:'none',
                cursor:'pointer', color:C.faint, padding:4, display:'flex',
              }}>
              <X size={18} />
            </button>
            <h3 style={{ margin:'0 0 16px', fontFamily:FONT_DISPLAY, fontSize:18, fontWeight:500, color:C.ink }}>
              {selectedTrip.recipientName}
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:13, color:C.ink, lineHeight:1.5 }}>
              <div><strong style={{ fontWeight:700 }}>Email:</strong> {selectedTrip.email}</div>
              <div><strong style={{ fontWeight:700 }}>Telephone:</strong> {selectedTrip.telephone}</div>
              <div><strong style={{ fontWeight:700 }}>Department:</strong> {selectedTrip.type === 'student' ? 'Student' : selectedTrip.accountName}</div>
              {selectedTrip.type === 'student' && <div><strong style={{ fontWeight:700 }}>Student ID:</strong> {selectedTrip.studentId}</div>}
              <div><strong style={{ fontWeight:700 }}>Name:</strong> {selectedTrip.firstName} {selectedTrip.lastName}</div>
              {selectedTrip._role === 'return' ? (
                <>
                  <div><strong style={{ fontWeight:700 }}>Return Date:</strong> {formatDateShort(selectedTrip.returnDate)} · {to12h(selectedTrip.returnTime)}</div>
                  <div><strong style={{ fontWeight:700 }}>Returning from:</strong> {selectedTrip.dropoffLocation}</div>
                  <div><strong style={{ fontWeight:700 }}>Destination:</strong> {selectedTrip.pickupLocation}</div>
                </>
              ) : (
                <>
                  <div><strong style={{ fontWeight:700 }}>Passengers:</strong> {selectedTrip.passengers}</div>
                  <div><strong style={{ fontWeight:700 }}>Luggage:</strong> {selectedTrip.hasLuggage ? `Yes (${selectedTrip.luggageQty})` : 'No'}</div>
                  <div><strong style={{ fontWeight:700 }}>Service Type:</strong> {selectedTrip.serviceType === 'round-trip' ? 'Round Trip' : 'One-way'}</div>
                  <div><strong style={{ fontWeight:700 }}>Pickup:</strong> {selectedTrip.pickupLocation}<br/><span style={{color:C.mute}}>{formatDateShort(selectedTrip.pickupDate)} · {to12h(selectedTrip.pickupTime)}</span></div>
                  {selectedTrip.flightNumber && <div><strong style={{ fontWeight:700 }}>Flight:</strong> {selectedTrip.flightNumber}</div>}
                  <div><strong style={{ fontWeight:700 }}>Dropoff:</strong> {selectedTrip.dropoffLocation}</div>
                  {selectedTrip.serviceType === 'round-trip' && (
                    <div><strong style={{ fontWeight:700 }}>Return:</strong> {formatDateShort(selectedTrip.returnDate)} · {to12h(selectedTrip.returnTime)}</div>
                  )}
                </>
              )}
              <div><strong style={{ fontWeight:700 }}>Driver:</strong> {selectedTrip.assignedDriver || 'Not assigned'}</div>
            </div>
            <div style={{ borderTop:`1px solid ${C.line}`, paddingTop:12, marginTop:12 }}>
              <a href={`tel:${selectedTrip.telephone && /^\d{4}$/.test(selectedTrip.telephone.trim()) ? '1-868-662-2241,' + selectedTrip.telephone.trim() : selectedTrip.telephone}`}
                className="contact-action"
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, border:`0.5px solid ${C.lineStrong}`, background:C.card, cursor:'pointer', textDecoration:'none', width:'100%' }}>
                <span style={{ width:32, height:32, borderRadius:'50%', background:C.success + '22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Phone size={16} style={{ color:C.success }} />
                </span>
                <div>
                  <div style={{ margin:0, fontSize:13, fontWeight:500, color:C.ink }}>Call client</div>
                  <div style={{ margin:0, fontSize:11, color:C.mute }}>Initiate a phone call</div>
                  <div style={{ margin:0, fontSize:11, color:C.mute }}>Tel: {selectedTrip.telephone && /^\d{4}$/.test(selectedTrip.telephone.trim()) ? '662 2241,' + selectedTrip.telephone.trim() : selectedTrip.telephone}</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
      )}
    </div>
  );
}
