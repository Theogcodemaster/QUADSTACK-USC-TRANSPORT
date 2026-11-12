import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Pencil, Trash2, Phone, Mail, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { buildTransportEmailURL, buildDeclineEmailURL } from '../utils/transportEmail';
import { C, FONT_DISPLAY, FONT_BODY } from '../shared/theme';
import { formatDateShort, to12h, formatCreatedAt } from '../shared/helpers';
import EditField from '../shared/EditField';

const PER_PAGE = 20;

export default function ReportPage({ setView, driversConfig }) {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [pendingPage, setPendingPage] = useState(1);
  const [editingJob, setEditingJob] = useState(null);
  const [editData, setEditData] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmCompleteId, setConfirmCompleteId] = useState(null);
  const [completeSuccess, setCompleteSuccess] = useState(false);
  const [driverSuggestion, setDriverSuggestion] = useState('');

  const driverName = (email) => {
    if (!email) return 'Unassigned';
    const map = { 'admin@transport.org': 'Admin' };
    return map[email] || email.split('@')[0].replace(/[._]/g, ' ');
  };

  useEffect(() => {
    const q = query(collection(db, 'Requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn('Report snapshot error (offline):', err.code);
    });
    return unsub;
  }, []);

  // One-time migration: rename first-name drivers to full names
  useEffect(() => {
    if (sessionStorage.getItem('driverMigrationDone')) return;
    const NAME_MAP = { 'Brent': 'Brent Roberts', 'Vincent': 'Vincent Hernandez', 'Tauren': 'Taurean Joseph', 'Taurean': 'Taurean Joseph' };
    (async () => {
      const snap = await getDocs(collection(db, 'Requests'));
      let count = 0;
      for (const d of snap.docs) {
        const current = d.data().assignedDriver;
        if (current && NAME_MAP[current]) {
          await updateDoc(doc(db, 'Requests', d.id), { assignedDriver: NAME_MAP[current] });
          count++;
        }
      }
      if (count > 0 || snap.docs.length > 0) sessionStorage.setItem('driverMigrationDone', '1');
    })();
  }, []);

  // One-time migration: renumber existing docs to JOB00001, JOB00002, etc.
  useEffect(() => {
    if (sessionStorage.getItem('jobRenumberDone')) return;
    (async () => {
      const snap = await getDocs(collection(db, 'Requests'));
      if (snap.docs.length === 0) {
        sessionStorage.setItem('jobRenumberDone', '1');
        return;
      }
      const alreadyJob = snap.docs.every(d => d.id.startsWith('JOB'));
      if (alreadyJob) {
        sessionStorage.setItem('jobRenumberDone', '1');
        return;
      }
      const sorted = [...snap.docs].sort((a, b) => {
        const ta = a.data().createdAt?.toMillis?.() || 0;
        const tb = b.data().createdAt?.toMillis?.() || 0;
        return ta - tb;
      });
      for (let i = 0; i < sorted.length; i++) {
        const d = sorted[i];
        const newId = `JOB${String(i + 1).padStart(5, '0')}`;
        if (d.id !== newId) {
          const { createdAt, ...rest } = d.data();
          await setDoc(doc(db, 'Requests', newId), { ...rest, jobNumber: i + 1, createdAt });
          await deleteDoc(doc(db, 'Requests', d.id));
        }
      }
      await setDoc(doc(db, 'Counters', 'jobs'), { nextNumber: sorted.length + 1 }, { merge: true });
      sessionStorage.setItem('jobRenumberDone', '1');
    })();
  }, []);

  const filtered = requests
    .filter(r => filter === 'all' ? ['pending','approved'].includes(r.status) : r.status === filter)
    .filter(r => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (r.firstName || '').toLowerCase().startsWith(q)
        || (r.lastName || '').toLowerCase().startsWith(q)
        || (r.accountName || '').toLowerCase().includes(q)
        || (r.recipientName || '').toLowerCase().startsWith(q);
    })
    .sort((a, b) => (a.pickupDate || '').localeCompare(b.pickupDate || ''));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((pendingPage - 1) * PER_PAGE, pendingPage * PER_PAGE);
  const selected = requests.find(r => r.id === selectedId);

  const statusStyle = (s) => {
    const map = {
      pending:   { bg: C.gold + '22', color: C.gold, label: 'Pending' },
      approved:  { bg: C.cardinal + '22', color: C.cardinal, label: 'Approved', fontWeight: 600 },
      completed: { bg: C.success + '22', color: C.success, label: 'Completed', fontWeight: 600 },
      cancelled: { bg: C.danger + '22', color: C.danger, label: 'Cancelled' },
    };
    return map[s] || { bg: C.line, color: C.mute, label: s };
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteDoc(doc(db, 'Requests', confirmDeleteId));
    } catch (err) {
      console.error('Delete error:', err);
    }
    setConfirmDeleteId(null);
    setSelectedId(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map(id => deleteDoc(doc(db, 'Requests', id))));
    } catch (err) {
      console.error('Bulk delete error:', err);
    }
    setSelectedIds([]);
    setConfirmBulkDelete(false);
  };

  const startEdit = (r) => {
    setEditingJob(r.id);
    setEditData({
      firstName: r.firstName || '',
      lastName: r.lastName || '',
      pickupLocation: r.pickupLocation || '',
      dropoffLocation: r.dropoffLocation || '',
      pickupDate: r.pickupDate || '',
      pickupTime: r.pickupTime || '',
      returnDate: r.returnDate || '',
      returnTime: r.returnTime || '',
      flightNumber: r.flightNumber || '',
      recipientName: r.recipientName || '',
      passengers: r.passengers || 1,
      hasLuggage: r.hasLuggage || false,
      luggageQty: r.luggageQty || 0,
      serviceType: r.serviceType || 'one-way',
      assignedDriver: r.assignedDriver || '',
      status: r.status || 'pending',
      amount: r.amount || '',
      currency: r.currency || 'TTD',
    });
    setDriverSuggestion(r.assignedDriver || '');
  };

  const saveEdit = async () => {
    if (!editingJob) return;
    try {
      await updateDoc(doc(db, 'Requests', editingJob), editData);
      setEditingJob(null);
    } catch (err) {
      console.error('Edit error:', err);
    }
  };

  const updateDriver = (name) => {
    setEditData(d => ({ ...d, assignedDriver: name }));
    setDriverSuggestion(name);
  };

  const driverSuggestions = driversConfig.drivers.map(d => d.name)
    .map(s => s.trim())
    .filter((v, i, a) => a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);

  useEffect(() => { setPendingPage(1); setSelectedIds([]); }, [filter]);

  useEffect(() => {
    if (selected) setDriverSuggestion(selected.assignedDriver || '');
  }, [selectedId]);

  const gmailBase = 'https://mail.google.com/mail/?view=cm&fs=1';
  const gmailEmail = selected ? `${gmailBase}&to=${selected.email}` : '';
  const gmailGeneral = selected ? `${gmailEmail}&su=Transport%20Request%20-%20${selected.firstName}%20${selected.lastName}` : '';
  const gmailAccept = selected ? `${gmailEmail}&su=Transport%20Request%20Accepted&body=Dear%20${selected.firstName}%20${selected.lastName},%0A%0AThank%20you%20for%20submitting%20your%20transportation%20request%20to%20the%20USC%20Transport%20Department.%0A%0AWe%20are%20pleased%20to%20inform%20you%20that%20your%20request%20has%20been%20reviewed%20and%20approved.%20Please%20take%20note%20of%20the%20details%20below%20and%20ensure%20that%20all%20relevant%20parties%20are%20informed%20ahead%20of%20time.%0A%0A---%20TRANSPORT%20DETAILS%20---%0A%0ADate:%20${selected.pickupDate}%0ATime:%20${selected.pickupTime}%0ALocation:%20${selected.pickupLocation}%0A%0ADriver:%20${selected.assignedDriver || 'TBD'}%0AContact:%20${selected.telephone || ''}%0A%0APlease%20ensure%20that%20all%20passengers%20are%20present%20at%20the%20designated%20location%20at%20least%2010%20minutes%20before%20the%20scheduled%20departure%20time.%20Any%20changes%20to%20the%20arrangement%20should%20be%20communicated%20to%20the%20Transport%20Department%20as%20soon%20as%20possible.%0A%0AFor%20further%20assistance%2C%20please%20do%20not%20hesitate%20to%20reach%20out%3A%0A%0APhone:%20868-662-2241%2C%20Ext.%201228%20or%201262%0AEmail:%20transport@usc.edu.tt%0A%0AWe%20wish%20you%20safe%20travels%20and%20thank%20you%20for%20using%20USC%20Transport%20Services.%0A%0AWarm%20regards%2C%0AUSC%20Transport%20Department%0AUniversity%20of%20the%20Southern%20Caribbean` : '';
  const gmailDecline = selected ? `${gmailEmail}&su=Transport%20Request%20Declined&body=Dear%20Requester%2C%0A%0AThank%20you%20for%20submitting%20your%20transportation%20request%20to%20the%20USC%20Transport%20Department.%0A%0AAfter%20careful%20review%2C%20we%20regret%20to%20inform%20you%20that%20we%20are%20unable%20to%20fulfill%20your%20request%20at%20this%20time.%20We%20apologize%20for%20any%20inconvenience%20this%20may%20cause%20and%20encourage%20you%20to%20plan%20accordingly.%0A%0AFor%20further%20assistance%20or%20to%20discuss%20alternative%20arrangements%2C%20please%20do%20not%20hesitate%20to%20reach%20out%20to%20the%20Transport%20Department%20directly%3A%0A%0APhone:%20868-662-2241%2C%20Ext.%201228%20or%201262%0AEmail:%20transport@usc.edu.tt%0A%0AWe%20appreciate%20your%20understanding%20and%20remain%20committed%20to%20supporting%20the%20USC%20community.%0A%0AWarm%20regards%2C%0AUSC%20Transport%20Department%0AUniversity%20of%20the%20Southern%20Caribbean` : '';

  return (
    <div className="fdsa-fade">
      <h2 style={{ margin:'0 0 24px', fontFamily:FONT_DISPLAY, fontSize:24, fontWeight:500, color:C.ink }}>
        Pending Jobs
      </h2>

      {!selectedId && (
      <>
      <div style={{ marginBottom:16 }}>
        <input
          type="text"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setPendingPage(1); }}
          placeholder="Search by recipient, name, or department"
          style={{
            width:'100%', padding:'10px 12px', border:`1px solid ${C.lineStrong}`, borderRadius:6,
            background:C.card, fontSize:14, fontFamily:FONT_BODY, color:C.ink,
          }}
        />
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {['all','pending','approved','cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(f => f === s ? 'all' : s)}
            style={{
              padding:'8px 16px', border:'none', borderRadius:8,
              background: filter === s ? C.cardinal : C.softBg, color: filter === s ? '#fff' : C.ink,
              cursor:'pointer', fontSize:13, fontFamily:FONT_BODY, fontWeight: filter === s ? 600 : 400,
              transition:'all .15s',
            }}>
            {s === 'all' ? 'All' : s === 'approved' ? 'Approved' : s === 'cancelled' ? 'Cancelled' : 'Pending'}
          </button>
        ))}
      </div>
      {filter === 'cancelled' && paged.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, padding:'10px 14px', background:C.card, borderRadius:10, border:`1px solid ${C.line}` }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:C.ink, cursor:'pointer', userSelect:'none' }}>
            <input type="checkbox" checked={paged.length > 0 && paged.every(r => selectedIds.includes(r.id))}
              onChange={() => {
                const allSelected = paged.every(r => selectedIds.includes(r.id));
                if (allSelected) {
                  setSelectedIds(ids => ids.filter(id => !paged.some(r => r.id === id)));
                } else {
                  setSelectedIds(ids => [...new Set([...ids, ...paged.map(r => r.id)])]);
                }
              }}
              style={{ accentColor:C.cardinal, width:16, height:16 }} />
            Select all
          </label>
          {selectedIds.length > 0 && (
            <button onClick={() => setConfirmBulkDelete(true)}
              style={{ padding:'6px 14px', border:'none', borderRadius:6, background:C.danger, color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:FONT_BODY, display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
              <Trash2 size={13} /> Delete All ({selectedIds.length})
            </button>
          )}
        </div>
      )}
      </>
      )}

      {!selectedId ? (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {paged.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:C.faint, fontSize:14, fontFamily:FONT_BODY }}>
                {searchTerm ? 'No matching jobs' : filter === 'all' ? 'No jobs' : filter === 'approved' ? 'No approved jobs' : filter === 'cancelled' ? 'No cancelled jobs' : 'No pending jobs'}
              </div>
            ) : paged.map(r => {
              const st = statusStyle(r.status);
              const isCancelledFilter = filter === 'cancelled';
              const isChecked = selectedIds.includes(r.id);
              return (
                <div key={r.id} onClick={(e) => { if (e.target.tagName === 'INPUT') return; if (isCancelledFilter && selectedIds.length > 0) return; setSelectedId(r.id === selectedId ? null : r.id); setPendingPage(1); }}
                  style={{
                    padding:'14px 16px', background:C.card, borderRadius:10,
                    border:`1px solid ${isChecked && isCancelledFilter ? C.cardinal : C.line}`, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:12,
                    transition:'all .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.lineStrong}
                  onMouseLeave={e => e.currentTarget.style.borderColor = isChecked && isCancelledFilter ? C.cardinal : C.line}>
                  {isCancelledFilter && (
                    <input type="checkbox" checked={isChecked}
                      onClick={e => e.stopPropagation()}
                      onChange={() => {
                        setSelectedIds(ids => isChecked ? ids.filter(id => id !== r.id) : [...ids, r.id]);
                      }}
                      style={{ accentColor:C.cardinal, width:16, height:16, flexShrink:0 }} />
                  )}
                  <div style={{ width:8, height:8, borderRadius:'50%', background:st.color, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14, color:C.ink }}>{r.recipientName}</div>
                    <div style={{ fontSize:12, color:C.mute, marginTop:2 }}>Date: {formatDateShort(r.pickupDate)}</div>
                    <div style={{ fontSize:12, color:C.mute, marginTop:2 }}>Pickup: {r.pickupLocation} at {to12h(r.pickupTime)}</div>
                    <div style={{ fontSize:12, color:C.mute, marginTop:2 }}>Drop off: {r.dropoffLocation}</div>
                    {r.serviceType === 'round-trip' && <div style={{ fontSize:12, color:C.mute, marginTop:2 }}>Return Time: {to12h(r.returnTime)}</div>}
                  </div>
                  <div style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:4, background:st.bg, color:st.color, whiteSpace:'nowrap' }}>
                    {st.label}
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:20 }}>
              <button onClick={() => setPendingPage(p => Math.max(1, p - 1))} disabled={pendingPage === 1}
                style={{ padding:'8px 14px', border:`1px solid ${C.lineStrong}`, borderRadius:6, background:C.card, cursor:pendingPage === 1 ? 'default' : 'pointer', fontSize:13, color:pendingPage === 1 ? C.faint : C.ink, fontFamily:FONT_BODY }}>
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPendingPage(p)}
                  style={{
                    width:32, height:32, borderRadius:6, border:'none',
                    background: p === pendingPage ? C.cardinal : 'transparent',
                    color: p === pendingPage ? '#fff' : C.mute,
                    cursor:'pointer', fontSize:13, fontWeight: p === pendingPage ? 600 : 400, fontFamily:FONT_BODY,
                  }}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPendingPage(p => Math.min(totalPages, p + 1))} disabled={pendingPage === totalPages}
                style={{ padding:'8px 14px', border:`1px solid ${C.lineStrong}`, borderRadius:6, background:C.card, cursor:pendingPage === totalPages ? 'default' : 'pointer', fontSize:13, color:pendingPage === totalPages ? C.faint : C.ink, fontFamily:FONT_BODY }}>
                Next
              </button>
            </div>
          )}
        </>
      ) : selected ? (
        <div style={{ background:C.card, borderRadius:12, border:`1px solid ${C.line}`, overflow:'hidden' }}>
          <div className="rpt-detail-header" style={{ padding:'16px 20px', borderBottom:`1px solid ${C.line}`, display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={() => { if (editingJob === selected.id) { setEditingJob(null); setEditData({}); } else { setSelectedId(null); } }}>
            <div style={{ fontWeight:600, fontSize:16, color:C.ink }}>{selected.recipientName}</div>
            <div className="rpt-detail-btns" style={{ display:'flex', gap:8 }}>
              {editingJob !== selected.id && (
                <button onClick={(e) => { e.stopPropagation(); startEdit(selected); }}
                  style={{ padding:'8px 14px', border:'none', borderRadius:6, background:C.cardinal, color:'#fff', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:6, fontFamily:FONT_BODY }}>
                  <Pencil size={14} /> Edit
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(selected.id); }}
                style={{ padding:'8px 14px', border:`1px solid ${C.danger}`, borderRadius:6, background:'transparent', color:C.danger, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:6, fontFamily:FONT_BODY }}>
                <Trash2 size={14} /> Delete
              </button>
              <button onClick={(e) => { e.stopPropagation(); if (editingJob === selected.id) { setEditingJob(null); setEditData({}); } else { setSelectedId(null); } }}
                style={{ padding:'8px 14px', border:`1px solid ${C.lineStrong}`, borderRadius:6, background:C.card, cursor:'pointer', fontSize:12, color:C.mute, fontFamily:FONT_BODY }}>
                Back
              </button>
            </div>
          </div>
          <div style={{ padding:20 }}>
            {editingJob === selected.id ? (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="rpt-edit-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <EditField label="First Name" value={editData.firstName} onChange={v => setEditData(d => ({ ...d, firstName: v }))} />
                  <EditField label="Last Name" value={editData.lastName} onChange={v => setEditData(d => ({ ...d, lastName: v }))} />
                </div>
                <EditField label="Pickup Location" value={editData.pickupLocation} onChange={v => setEditData(d => ({ ...d, pickupLocation: v }))} />
                <EditField label="Dropoff Location" value={editData.dropoffLocation} onChange={v => setEditData(d => ({ ...d, dropoffLocation: v }))} />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <EditField label="Pickup Date" type="date" value={editData.pickupDate} onChange={v => setEditData(d => ({ ...d, pickupDate: v }))} />
                  <EditField label="Pickup Time" type="time" value={editData.pickupTime} onChange={v => setEditData(d => ({ ...d, pickupTime: v }))} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <EditField label="Return Date" type="date" value={editData.returnDate} onChange={v => setEditData(d => ({ ...d, returnDate: v }))} />
                  <EditField label="Return Time" type="time" value={editData.returnTime} onChange={v => setEditData(d => ({ ...d, returnTime: v }))} />
                </div>
                <EditField label="Flight Number" value={editData.flightNumber} onChange={v => setEditData(d => ({ ...d, flightNumber: v }))} />
                <EditField label="Recipient Name" value={editData.recipientName} onChange={v => setEditData(d => ({ ...d, recipientName: v }))} />
                <EditField label="Passengers" type="number" value={editData.passengers} onChange={v => setEditData(d => ({ ...d, passengers: Number(v) }))} />
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:C.ink, cursor:'pointer' }}>
                  <input type="checkbox" checked={editData.hasLuggage} onChange={e => setEditData(d => ({ ...d, hasLuggage: e.target.checked }))}
                    style={{ accentColor:C.cardinal }} />
                  Has Luggage
                </label>
                {editData.hasLuggage && (
                  <EditField label="Luggage Qty" type="number" value={editData.luggageQty} onChange={v => setEditData(d => ({ ...d, luggageQty: Number(v) }))} />
                )}
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:C.mute, display:'block', marginBottom:4 }}>Service Type</label>
                  <select value={editData.serviceType} onChange={e => setEditData(d => ({ ...d, serviceType: e.target.value }))}
                    style={{ width:'100%', padding:'10px 12px', border:`1px solid ${C.line}`, borderRadius:6, background:C.card, fontSize:13, color:C.ink, fontFamily:FONT_BODY }}>
                    <option value="one-way">One Way</option>
                    <option value="round-trip">Round Trip</option>
                  </select>
                </div>
                <button onClick={saveEdit}
                  style={{ padding:'12px 24px', border:'none', borderRadius:8, background:C.cardinal, color:'#fff', cursor:'pointer', fontSize:14, fontWeight:600, fontFamily:FONT_BODY, marginTop:8 }}>
                  Save Changes
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12, fontSize:13, color:C.ink, lineHeight:1.5 }}>
                <div><strong style={{ color: C.mute, fontWeight:500 }}>Name:</strong> {selected.firstName} {selected.lastName}</div>
                <div><strong style={{ color: C.mute, fontWeight:500 }}>Pickup:</strong> {selected.pickupLocation} · {formatDateShort(selected.pickupDate)} · {to12h(selected.pickupTime)}</div>
                <div><strong style={{ color: C.mute, fontWeight:500 }}>Dropoff:</strong> {selected.dropoffLocation}</div>
                {selected.serviceType === 'round-trip' && <div><strong style={{ color: C.mute, fontWeight:500 }}>Return:</strong> {formatDateShort(selected.returnDate)} · {to12h(selected.returnTime)}</div>}
                <div><strong style={{ color: C.mute, fontWeight:500 }}>Flight:</strong> {selected.flightNumber || '—'}</div>
                <div><strong style={{ color: C.mute, fontWeight:500 }}>Recipient:</strong> {selected.recipientName || '—'}</div>
                <div><strong style={{ color: C.mute, fontWeight:500 }}>Passengers:</strong> {selected.passengers || 1}</div>
                <div><strong style={{ color: C.mute, fontWeight:500 }}>Luggage:</strong> {selected.hasLuggage ? `Yes (${selected.luggageQty || 0})` : 'No'}</div>
                <div><strong style={{ color: C.mute, fontWeight:500 }}>Service:</strong> {selected.serviceType === 'round-trip' ? 'Round Trip' : 'One Way'}</div>
                <div><strong style={{ color: C.mute, fontWeight:500 }}>Driver:</strong> {selected.assignedDriver || 'Unassigned'}</div>
                <div><strong style={{ color: C.mute, fontWeight:500 }}>Status:</strong> <span style={{ ...statusStyle(selected.status), padding:'2px 8px', borderRadius:4 }}>{statusStyle(selected.status).label}</span></div>
                <div><strong style={{ color: C.mute, fontWeight:500 }}>Request Timestamp:</strong> {formatCreatedAt(selected.createdAt)}</div>

                <div style={{ borderTop:`1px solid ${C.line}`, paddingTop:16, marginTop:8 }}>
                  <div style={{ fontWeight:600, fontSize:14, color:C.ink, marginBottom:10 }}>Assigned Driver</div>
                  <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                    <div style={{ flex:1, position:'relative' }}>
                      <input value={driverSuggestion} onChange={e => updateDriver(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && driverSuggestion) {
                            const match = driverSuggestions.filter(s => s.toLowerCase().includes(driverSuggestion.toLowerCase()) && s !== driverSuggestion);
                            if (match.length > 0) { e.preventDefault(); updateDriver(match[0]); }
                          }
                        }}
                        placeholder="Enter driver name"
                        style={{ width:'100%', padding:'10px 12px', border:`1px solid ${C.lineStrong}`, borderRadius:6, background:C.card, fontSize:13, color:C.ink, fontFamily:FONT_BODY, boxSizing:'border-box' }} />
                      {driverSuggestion && driverSuggestions.filter(s => s.toLowerCase().includes(driverSuggestion.toLowerCase()) && s !== driverSuggestion).length > 0 && (
                        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:C.card, border:`1px solid ${C.line}`, borderRadius:6, zIndex:10, marginTop:4, boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
                          {driverSuggestions.filter(s => s.toLowerCase().includes(driverSuggestion.toLowerCase()) && s !== driverSuggestion).slice(0, 5).map(s => (
                            <div key={s} onClick={() => updateDriver(s)}
                              style={{ padding:'8px 12px', cursor:'pointer', fontSize:13, color:C.ink, fontFamily:FONT_BODY }}
                              onMouseEnter={e => e.currentTarget.style.background = C.softBg}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              {s}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={async () => { try { await updateDoc(doc(db, 'Requests', selected.id), { assignedDriver: driverSuggestion || null }); } catch(e) { console.error(e); } }}
                      style={{ padding:'10px 16px', background:C.cardinal, color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:FONT_BODY }}>
                      Save
                    </button>
                  </div>
                </div>

                <div style={{ borderTop:`1px solid ${C.line}`, paddingTop:16, marginTop:16 }}>
                  <div style={{ fontWeight:600, fontSize:14, color:C.ink, marginBottom:10 }}>Status</div>
                  <div className="rpt-status-bar" style={{ display:'flex', gap:0, borderRadius:6, overflow:'hidden', border:`1px solid ${C.line}` }}>
                    {['pending','approved','completed','cancelled'].map(s => (
                      <button key={s} type="button" className="rpt-status-btn" onClick={() => { if (s === 'completed') { setConfirmCompleteId(selected.id); } else { (async () => { try { await updateDoc(doc(db, 'Requests', selected.id), { status: s }); } catch(e) { console.error(e); } })(); } }}
                        style={{
                          flex:1, padding:'10px 8px', border:'none', cursor:'pointer', fontFamily:FONT_BODY,
                          fontSize:12, fontWeight: selected.status === s ? 600 : 400,
                          background: selected.status === s ? C.cardinal : C.card,
                          color: selected.status === s ? '#fff' : C.ink,
                          transition:'all .1s',
                        }}>
                        {s === 'pending' ? 'Pending' : s === 'approved' ? 'Approved' : s === 'completed' ? 'Completed' : 'Cancelled'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop:`1px solid ${C.line}`, paddingTop:16, marginTop:16 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:C.mute, letterSpacing:'0.04em', marginBottom:10, textTransform:'uppercase' }}>Contact Client</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <a href={`tel:${selected.telephone && /^\d{4}$/.test(selected.telephone.trim()) ? '1-868-662-2241,' + selected.telephone.trim() : selected.telephone}`}
                      className="contact-action"
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:8, border:`0.5px solid ${C.lineStrong}`, background:C.card, cursor:'pointer', textDecoration:'none', width:'100%' }}>
                      <span style={{ width:36, height:36, borderRadius:'50%', background:C.success + '22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Phone size={18} style={{ color:C.success }} />
                      </span>
                      <div>
                        <div style={{ margin:0, fontSize:14, fontWeight:500, color:C.ink }}>Call client</div>
                        <div style={{ margin:0, fontSize:12, color:C.mute }}>Initiate a phone call</div>
                        <div style={{ margin:0, fontSize:12, color:C.mute }}>Tel: {selected.telephone && /^\d{4}$/.test(selected.telephone.trim()) ? '662 2241,' + selected.telephone.trim() : selected.telephone}</div>
                      </div>
                      <ChevronRight size={16} style={{ color:C.faint, marginLeft:'auto' }} />
                    </a>
                    <a href={gmailGeneral}
                      target="_blank"
                      className="contact-action"
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:8, border:`0.5px solid ${C.lineStrong}`, background:C.card, cursor:'pointer', textDecoration:'none', width:'100%' }}>
                      <span style={{ width:36, height:36, borderRadius:'50%', background:C.cardinal + '22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Mail size={18} style={{ color:C.cardinal }} />
                      </span>
                      <div>
                        <div style={{ margin:0, fontSize:14, fontWeight:500, color:C.ink }}>Email client</div>
                        <div style={{ margin:0, fontSize:12, color:C.mute }}>Compose a general email</div>
                      </div>
                      <ChevronRight size={16} style={{ color:C.faint, marginLeft:'auto' }} />
                    </a>
                  </div>
                </div>

                <div style={{ borderTop:`1px solid ${C.line}`, paddingTop:16, marginTop:16 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:C.mute, letterSpacing:'0.04em', marginBottom:10, textTransform:'uppercase' }}>Email Prompts</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <a href={buildTransportEmailURL({
                        requesterName: `${selected.firstName} ${selected.lastName}`,
                        requesterEmail: selected.email,
                        date: selected.pickupDate,
                        time: selected.pickupTime,
                        location: selected.pickupLocation,
                        driverName: selected.assignedDriver || 'TBD',
                        driverContact: selected.telephone || '',
                      })}
                      target="_blank"
                      className="contact-action"
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:8, border:`0.5px solid ${C.lineStrong}`, background:C.card, cursor:'pointer', textDecoration:'none', width:'100%' }}>
                      <span style={{ width:36, height:36, borderRadius:'50%', background:C.success + '22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <CheckCircle size={18} style={{ color:C.success }} />
                      </span>
                      <div>
                        <div style={{ margin:0, fontSize:14, fontWeight:500, color:C.ink }}>Send acceptance email</div>
                        <div style={{ margin:0, fontSize:12, color:C.mute }}>Confirm and accept the client</div>
                      </div>
                      <Mail size={16} style={{ color:C.faint, marginLeft:'auto' }} />
                    </a>
                    <a href={buildDeclineEmailURL({
                        requesterName: `${selected.firstName} ${selected.lastName}`,
                        requesterEmail: selected.email,
                      })}
                      target="_blank"
                      className="contact-action"
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:8, border:`0.5px solid ${C.lineStrong}`, background:C.card, cursor:'pointer', textDecoration:'none', width:'100%' }}>
                      <span style={{ width:36, height:36, borderRadius:'50%', background:C.danger + '22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <XCircle size={18} style={{ color:C.danger }} />
                      </span>
                      <div>
                        <div style={{ margin:0, fontSize:14, fontWeight:500, color:C.ink }}>Send decline email</div>
                        <div style={{ margin:0, fontSize:12, color:C.mute }}>Politely decline the client</div>
                      </div>
                      <Mail size={16} style={{ color:C.faint, marginLeft:'auto' }} />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {confirmDeleteId && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(43,35,25,0.4)',
          backdropFilter:'blur(4px)', display:'flex', alignItems:'center',
          justifyContent:'center', zIndex:200, padding:20,
        }} onClick={() => setConfirmDeleteId(null)}>
          <div style={{
            background:C.card, borderRadius:14, padding:28, maxWidth:380, width:'100%',
            boxShadow:'0 20px 60px rgba(43,35,25,0.25)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 8px', fontFamily:FONT_DISPLAY, fontSize:18, fontWeight:500, color:C.ink }}>Delete Job?</h3>
            <p style={{ margin:'0 0 20px', fontSize:13, color:C.mute, lineHeight:1.5 }}>
              This action cannot be undone.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmDeleteId(null)}
                style={{ padding:'10px 20px', border:`1px solid ${C.lineStrong}`, borderRadius:8, background:C.card, cursor:'pointer', fontSize:13, color:C.ink, fontFamily:FONT_BODY }}>
                Cancel
              </button>
              <button onClick={handleConfirmDelete}
                style={{ padding:'10px 20px', border:'none', borderRadius:8, background:C.danger, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:FONT_BODY }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBulkDelete && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(43,35,25,0.4)',
          backdropFilter:'blur(4px)', display:'flex', alignItems:'center',
          justifyContent:'center', zIndex:200, padding:20,
        }} onClick={() => setConfirmBulkDelete(false)}>
          <div style={{
            background:C.card, borderRadius:14, padding:28, maxWidth:380, width:'100%',
            boxShadow:'0 20px 60px rgba(43,35,25,0.25)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 8px', fontFamily:FONT_DISPLAY, fontSize:18, fontWeight:500, color:C.ink }}>Delete {selectedIds.length} Job{selectedIds.length > 1 ? 's' : ''}?</h3>
            <p style={{ margin:'0 0 20px', fontSize:13, color:C.mute, lineHeight:1.5 }}>
              This will permanently delete all selected cancelled jobs. This action cannot be undone.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmBulkDelete(false)}
                style={{ padding:'10px 20px', border:`1px solid ${C.lineStrong}`, borderRadius:8, background:C.card, cursor:'pointer', fontSize:13, color:C.ink, fontFamily:FONT_BODY }}>
                Cancel
              </button>
              <button onClick={handleBulkDelete}
                style={{ padding:'10px 20px', border:'none', borderRadius:8, background:C.danger, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:FONT_BODY }}>
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCompleteId && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(43,35,25,0.4)',
          backdropFilter:'blur(4px)', display:'flex', alignItems:'center',
          justifyContent:'center', zIndex:200, padding:20,
        }} onClick={() => setConfirmCompleteId(null)}>
          <div style={{
            background:C.card, borderRadius:14, padding:28, maxWidth:380, width:'100%',
            boxShadow:'0 20px 60px rgba(43,35,25,0.25)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 8px', fontFamily:FONT_DISPLAY, fontSize:18, fontWeight:500, color:C.ink }}>Mark as Completed?</h3>
            <p style={{ margin:'0 0 20px', fontSize:13, color:C.mute, lineHeight:1.5 }}>
              This will mark the job as completed and move it to Past Jobs.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmCompleteId(null)}
                style={{ padding:'10px 20px', border:`1px solid ${C.lineStrong}`, borderRadius:8, background:C.card, cursor:'pointer', fontSize:13, color:C.ink, fontFamily:FONT_BODY }}>
                Cancel
              </button>
              <button onClick={async () => { try { await updateDoc(doc(db, 'Requests', confirmCompleteId), { status: 'completed' }); } catch(e) { console.error(e); } setConfirmCompleteId(null); setCompleteSuccess(true); }}
                style={{ padding:'10px 20px', border:'none', borderRadius:8, background:C.cardinal, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:FONT_BODY }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {completeSuccess && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(43,35,25,0.4)',
          backdropFilter:'blur(4px)', display:'flex', alignItems:'center',
          justifyContent:'center', zIndex:200, padding:20,
        }} onClick={() => setCompleteSuccess(false)}>
          <div style={{
            background:C.card, borderRadius:14, padding:28, maxWidth:380, width:'100%',
            boxShadow:'0 20px 60px rgba(43,35,25,0.25)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 8px', fontFamily:FONT_DISPLAY, fontSize:18, fontWeight:500, color:C.ink }}>Job Completed</h3>
            <p style={{ margin:'0 0 20px', fontSize:13, color:C.mute, lineHeight:1.5 }}>
              View the job in Past Jobs.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setCompleteSuccess(false)}
                style={{ padding:'10px 20px', border:`1px solid ${C.lineStrong}`, borderRadius:8, background:C.card, cursor:'pointer', fontSize:13, color:C.ink, fontFamily:FONT_BODY }}>
                Close
              </button>
              <button onClick={() => { setCompleteSuccess(false); setSelectedId(null); setView('pastjobs'); }}
                style={{ padding:'10px 20px', border:'none', borderRadius:8, background:C.cardinal, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:FONT_BODY }}>
                Open Past Jobs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
