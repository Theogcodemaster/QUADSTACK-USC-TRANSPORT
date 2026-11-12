import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { Pencil, Trash2, Phone, Mail, ChevronRight, FileText } from 'lucide-react';
import { C, FONT_DISPLAY, FONT_BODY } from '../shared/theme';
import { formatDateShort, to12h, formatCreatedAt, formatMonth, formatDateTime, formatMoney } from '../shared/helpers';
import EditField from '../shared/EditField';

export default function PastJobsPage({ driversConfig }) {
  const [jobs, setJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [pastPage, setPastPage] = useState(1);
  const [selectedPast, setSelectedPast] = useState(null);
  const [editingPast, setEditingPast] = useState(null);
  const [editPastData, setEditPastData] = useState({});
  const PER_PAGE = 15;
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showAllJobs, setShowAllJobs] = useState(false);

  useEffect(() => {
    if (selectedPast) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [selectedPast]);

  useEffect(() => {
    const q = query(collection(db, 'Requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setJobs(all.filter(r => r.status === 'completed'));
    }, (err) => {
      console.warn('PastJobsPage snapshot error (offline):', err.code);
    });
    return unsub;
  }, []);

  const filtered = jobs.filter(r => {
    if (!showAllJobs && r.amount != null && r.amount !== '') return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (r.firstName || '').toLowerCase().startsWith(q)
      || (r.lastName || '').toLowerCase().startsWith(q)
      || (r.accountName || '').toLowerCase().includes(q)
      || (r.recipientName || '').toLowerCase().startsWith(q)
      || (r.department || '').toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const da = a.pickupDate || '';
    const db = b.pickupDate || '';
    return sortAsc ? da.localeCompare(db) : db.localeCompare(da);
  });

  const totalPastPages = Math.ceil(sorted.length / PER_PAGE);
  useEffect(() => {
    if (pastPage > totalPastPages && totalPastPages > 0) setPastPage(totalPastPages);
    else if (sorted.length === 0) setPastPage(1);
  }, [sorted.length]);

  const paginated = sorted.slice((pastPage - 1) * PER_PAGE, pastPage * PER_PAGE);

  const handlePastDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteDoc(doc(db, 'Requests', confirmDeleteId));
      setConfirmDeleteId(null);
      setSelectedPast(null);
    } catch (err) {
      alert('Failed to delete: ' + (err?.message || 'unknown'));
    }
  };

  const formatDate = (ds) => {
    if (!ds) return '';
    const [y, m, d] = ds.split('-').map(Number);
    return new Date(y, m-1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const startEdit = (r) => {
    setEditingPast(r.id);
    setEditPastData({
      pickupLocation: r.pickupLocation || '',
      dropoffLocation: r.dropoffLocation || '',
      pickupDate: r.pickupDate || '',
      pickupTime: r.pickupTime || '',
      returnDate: r.returnDate || '',
      returnTime: r.returnTime || '',
      flightNumber: r.flightNumber || '',
      passengers: r.passengers || 1,
      hasLuggage: r.hasLuggage || false,
      luggageQty: r.luggageQty || 0,
      recipientName: r.recipientName || '',
      serviceType: r.serviceType || 'one-way',
      assignedDriver: r.assignedDriver || '',
    });
  };

  const saveEdit = async (id) => {
    try {
      await updateDoc(doc(db, 'Requests', id), editPastData);
      setEditingPast(null);
      setEditPastData({});
    } catch (err) {
      alert('Failed to save: ' + (err?.message || 'unknown'));
    }
  };

  const [pastDriverName, setPastDriverName] = useState('');
  const [adminAmount, setAdminAmount] = useState('');
  const [adminCurrency, setAdminCurrency] = useState('TTD');
  const [adminAccountCode, setAdminAccountCode] = useState('');
  const [adminAnalysisCode, setAdminAnalysisCode] = useState('');

  useEffect(() => {
    if (selectedPast?.assignedDriver) setPastDriverName(selectedPast.assignedDriver);
    else setPastDriverName('');
    setAdminAmount(selectedPast?.amount != null ? String(selectedPast.amount) : '');
    setAdminCurrency(selectedPast?.currency || 'TTD');
    setAdminAccountCode('890110');
    setAdminAnalysisCode(selectedPast?.analysisCode || (selectedPast?.type === 'student' && selectedPast?.studentId ? `S${selectedPast.studentId}` : ''));
  }, [selectedPast]);

  const saveAdminFields = async (id) => {
    try {
      await updateDoc(doc(db, 'Requests', id), {
        amount: adminAmount ? Number(adminAmount) : null,
        currency: adminCurrency,
        accountCode: adminAccountCode || null,
        analysisCode: adminAnalysisCode || null,
      });
    } catch (err) {
      alert('Failed to save: ' + (err?.message || 'unknown'));
    }
  };

  const updatePastDriver = async (id) => {
    try {
      await updateDoc(doc(db, 'Requests', id), { assignedDriver: pastDriverName || null });
    } catch (err) {
      alert('Failed to assign driver: ' + (err?.message || 'unknown'));
    }
  };

  const printForm = async (r) => {
    const doc = new jsPDF();
    const margin = 20;
    let y = 20;
    const lineHeight = 10;
    const labelW = 80;

    const addLine = (label, value) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value || 'N/A'), margin + labelW, y);
      y += lineHeight;
    };

    const addSection = (title) => {
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(title, margin, y);
      y += 4;
      doc.setDrawColor(200);
      doc.line(margin, y, 190, y);
      y += 6;
      doc.setFontSize(10);
    };

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('USC Transport Request Form', margin, y);
    y += 14;

    addSection('Contact Information');
    addLine('Email Address:', r.email);
    addLine('Name (First, Last):', `${r.firstName} ${r.lastName}`);
    addLine('Telephone Number:', r.telephone);
    addLine('Type:', r.type === 'student' ? 'Student' : 'Department');
    addLine(r.type === 'student' ? 'Student ID:' : 'Department Name:', r.type === 'student' ? r.studentId : r.accountName);

    addSection('Passenger and Trip Details');
    addLine('Name of Person to Receive Service:', r.recipientName);
    addLine('Number of Passengers:', r.passengers);
    addLine('Luggage Number:', r.hasLuggage ? r.luggageQty : 0);
    addLine('Type of Service:', r.serviceType === 'round-trip' ? 'Return' : 'One Way');

    const fmtDate = (d) => {
      if (!d) return 'N/A';
      const parts = d.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };
    const fmtTime = (t) => {
      if (!t) return 'N/A';
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hr = h % 12 || 12;
      return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    addSection('Trip Details');
    addLine('Pickup Date:', fmtDate(r.pickupDate));
    addLine('Pickup Time:', fmtTime(r.pickupTime));
    addLine('Pickup Location:', r.pickupLocation);
    addLine('Drop Off Location:', r.dropoffLocation);
    addLine('Flight Number:', r.flightNumber || 'N/A');
    if (r.serviceType === 'round-trip') {
      addLine('Return Date:', fmtDate(r.returnDate));
      addLine('Return Time:', fmtTime(r.returnTime));
    }

    addSection('Payment');
    addLine('Amount:', r.amount != null && r.amount !== '' ? `${r.currency || 'TTD'} ${Number(r.amount).toFixed(2)}` : 'N/A');
    addLine('Request Timestamp:', formatCreatedAt(r.createdAt));

    const filename = `Transport_Form_${r.firstName}_${r.lastName}.pdf`;
    if (Capacitor.isNativePlatform()) {
      const b64 = doc.output('datauristring').split(',')[1];
      const result = await Filesystem.writeFile({
        path: filename,
        data: b64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: filename,
        files: [result.uri],
      });
    } else {
      doc.save(filename);
    }
  };

  if (selectedPast) {
    const r = selectedPast;

    const pastJobsGmailBase = 'https://mail.google.com/mail/?view=cm&fs=1';
    const pastJobsGmailGeneral = r ? `${pastJobsGmailBase}&to=${r.email}&su=Transport%20Request%20-%20${r.firstName}%20${r.lastName}` : '';

    return (
      <>
      <div className="fdsa-fade">
        <button onClick={() => { setSelectedPast(null); setEditingPast(null); setEditPastData({}); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 0', fontSize: 13, color: C.cardinal, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20,
          }}>
          ← Back to Past Jobs
        </button>

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 500 }}>
                {r.recipientName}
              </h3>
              <button onClick={() => editingPast === r.id ? setEditingPast(null) : startEdit(r)}
                style={{
                  background: 'none', border: `1px solid ${C.lineStrong}`, borderRadius: 6, cursor: 'pointer',
                  padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: editingPast === r.id ? C.cardinal : C.mute,
                  transition: 'all .15s',
                }}>
                <Pencil size={14} />
              </button>
            </div>
            <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: C.success, color: '#fff' }}>
              Completed
            </span>
          </div>

          {editingPast === r.id ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 14, color: C.ink, marginBottom: 28 }}>
              <EditField label="Pickup Location" value={editPastData.pickupLocation} onChange={v => setEditPastData(d => ({ ...d, pickupLocation: v }))} />
              <EditField label="Dropoff Location" value={editPastData.dropoffLocation} onChange={v => setEditPastData(d => ({ ...d, dropoffLocation: v }))} />
              <EditField label="Pickup Date" type="date" value={editPastData.pickupDate} onChange={v => setEditPastData(d => ({ ...d, pickupDate: v }))} />
              <EditField label="Pickup Time" type="time" value={editPastData.pickupTime} onChange={v => setEditPastData(d => ({ ...d, pickupTime: v }))} />
              <EditField label="Return Date" type="date" value={editPastData.returnDate} onChange={v => setEditPastData(d => ({ ...d, returnDate: v }))} />
              <EditField label="Return Time" type="time" value={editPastData.returnTime} onChange={v => setEditPastData(d => ({ ...d, returnTime: v }))} />
              <EditField label="Flight Number" value={editPastData.flightNumber} onChange={v => setEditPastData(d => ({ ...d, flightNumber: v }))} />
              <EditField label="Recipient Name" value={editPastData.recipientName} onChange={v => setEditPastData(d => ({ ...d, recipientName: v }))} />
              <EditField label="Passengers" type="number" value={editPastData.passengers} onChange={v => setEditPastData(d => ({ ...d, passengers: Number(v) }))} />
              <div>
                <div style={{ fontSize: 11, color: C.mute, fontWeight: 500, marginBottom: 6 }}>Luggage</div>
                <select value={editPastData.hasLuggage ? 'yes' : 'no'} onChange={e => { const yes = e.target.value === 'yes'; setEditPastData(d => ({ ...d, hasLuggage: yes, luggageQty: yes ? d.luggageQty || 1 : 0 })) }}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.lineStrong}`, borderRadius: 6, background: C.card, fontSize: 14, fontFamily: FONT_BODY, color: C.ink }}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              {editPastData.hasLuggage && (
                <EditField label="Luggage Qty" type="number" value={editPastData.luggageQty} onChange={v => setEditPastData(d => ({ ...d, luggageQty: Number(v) }))} />
              )}
              <div>
                <div style={{ fontSize: 11, color: C.mute, fontWeight: 500, marginBottom: 6 }}>Service Type</div>
                <select value={editPastData.serviceType} onChange={e => setEditPastData(d => ({ ...d, serviceType: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.lineStrong}`, borderRadius: 6, background: C.card, fontSize: 14, fontFamily: FONT_BODY, color: C.ink }}>
                  <option value="one-way">One-way</option>
                  <option value="round-trip">Round Trip</option>
                </select>
              </div>
              <EditField label="Assigned Driver" value={editPastData.assignedDriver} onChange={v => setEditPastData(d => ({ ...d, assignedDriver: v }))} />
            </div>
          ) : (
            <div className="pj-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 14, color: C.ink, marginBottom: 28 }}>
              <div><strong style={{ fontWeight: 700 }}>Email:</strong><br/>{r.email}</div>
              <div><strong style={{ fontWeight: 700 }}>Telephone:</strong><br/>{r.telephone}</div>
              <div><strong style={{ fontWeight: 700 }}>Type:</strong><br/>{r.type === 'student' ? 'Student' : r.accountName}</div>
              {r.type === 'student' && <div><strong style={{ fontWeight: 700 }}>Student ID:</strong><br/>{r.studentId}</div>}
              <div><strong style={{ fontWeight: 700 }}>Name:</strong><br/>{r.firstName} {r.lastName}</div>
              <div><strong style={{ fontWeight: 700 }}>Passengers:</strong><br/>{r.passengers}</div>
              <div><strong style={{ fontWeight: 700 }}>Luggage:</strong><br/>{r.hasLuggage ? `Yes (${r.luggageQty})` : 'No'}</div>
              <div><strong style={{ fontWeight: 700 }}>Service Type:</strong><br/>{r.serviceType === 'round-trip' ? 'Round Trip' : 'One-way'}</div>
              <div><strong style={{ fontWeight: 700 }}>Pickup:</strong><br/>{r.pickupLocation}<br/>{formatDateTime(r.pickupDate)}<br/>{to12h(r.pickupTime)}</div>
              {r.flightNumber && <div><strong style={{ fontWeight: 700 }}>Flight:</strong><br/>{r.flightNumber}</div>}
              <div><strong style={{ fontWeight: 700 }}>Dropoff:</strong><br/>{r.dropoffLocation}</div>
              {r.serviceType === 'round-trip' && (
                <div><strong style={{ fontWeight: 700 }}>Return:</strong><br/>{formatDateTime(r.returnDate)}<br/>{to12h(r.returnTime)}</div>
              )}
              <div><strong style={{ fontWeight: 700 }}>Driver:</strong><br/>{r.assignedDriver || 'Not assigned'}</div>
              <div><strong style={{ fontWeight: 700 }}>Request Timestamp:</strong><br/>{formatCreatedAt(r.createdAt)}</div>
            </div>
          )}
          {editingPast === r.id && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => { setEditingPast(null); setEditPastData({}); }}
                style={{ padding: '10px 18px', background: C.card, color: C.ink, border: `1px solid ${C.lineStrong}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: FONT_BODY }}>
                Cancel
              </button>
              <button onClick={() => saveEdit(r.id)}
                style={{ padding: '10px 18px', background: C.cardinal, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: FONT_BODY }}>
                Save Changes
              </button>
            </div>
          )}

          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 16 }}>Driver</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 240px' }}>
                <label style={{ display: 'block', fontSize: 11, color: C.mute, fontWeight: 500, marginBottom: 6 }}>
                  Assigned Driver
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input value={pastDriverName} onChange={e => setPastDriverName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && pastDriverName) {
                          const driverNames = driversConfig.drivers.map(d => d.name);
                          const match = driverNames.filter(s => s.toLowerCase().includes(pastDriverName.toLowerCase()) && s !== pastDriverName);
                          if (match.length > 0) { e.preventDefault(); setPastDriverName(match[0]); }
                        }
                      }}
                      placeholder="Enter driver name"
                      style={{
                        width: '100%', padding: '10px 12px', border: `1px solid ${C.lineStrong}`, borderRadius: 6,
                        background: C.card, fontSize: 14, fontFamily: FONT_BODY, color: C.ink,
                      }}
                    />
                    {pastDriverName && driversConfig.drivers.map(d => d.name).filter(s => s.toLowerCase().includes(pastDriverName.toLowerCase()) && s !== pastDriverName).length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: C.card, border: `1px solid ${C.line}`, borderRadius: 6, marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                        {driversConfig.drivers.map(d => d.name).filter(s => s.toLowerCase().includes(pastDriverName.toLowerCase()) && s !== pastDriverName).slice(0, 5).map(s => (
                          <div key={s} onClick={() => setPastDriverName(s)}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: C.ink, fontFamily: FONT_BODY }}
                            onMouseEnter={e => e.currentTarget.style.background = C.softBg}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => updatePastDriver(r.id)}
                    style={{
                      padding: '10px 16px', background: C.cardinal, color: '#fff',
                      border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    }}>
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 24, marginTop: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 16 }}>Administrator</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: 11, color: C.mute, fontWeight: 500, marginBottom: 6 }}>Amount</label>
                <input type="number" step="0.01" value={adminAmount} onChange={e => setAdminAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.lineStrong}`, borderRadius: 6, background: C.card, fontSize: 14, fontFamily: FONT_BODY, color: C.ink }}
                />
              </div>
              <div style={{ flex: '0 0 100px' }}>
                <label style={{ display: 'block', fontSize: 11, color: C.mute, fontWeight: 500, marginBottom: 6 }}>Currency</label>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.lineStrong}` }}>
                  <button onClick={() => setAdminCurrency('TTD')}
                    style={{ flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: FONT_BODY,
                      background: adminCurrency === 'TTD' ? C.cardinal : C.card, color: adminCurrency === 'TTD' ? '#fff' : C.ink }}>
                    TTD
                  </button>
                  <button onClick={() => setAdminCurrency('USD')}
                    style={{ flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: FONT_BODY,
                      background: adminCurrency === 'USD' ? C.cardinal : C.card, color: adminCurrency === 'USD' ? '#fff' : C.ink }}>
                    USD
                  </button>
                </div>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: 11, color: C.mute, fontWeight: 500, marginBottom: 6 }}>Account Code</label>
                <input type="text" value={adminAccountCode} onChange={e => setAdminAccountCode(e.target.value)}
                  placeholder="890110"
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.lineStrong}`, borderRadius: 6, background: C.card, fontSize: 14, fontFamily: FONT_BODY, color: C.ink }}
                />
              </div>
              {r.type === 'student' ? (
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: 11, color: C.mute, fontWeight: 500, marginBottom: 6 }}>Student ID</label>
                  <input type="text" value={adminAnalysisCode} onChange={e => setAdminAnalysisCode(e.target.value)}
                    placeholder="S + Student ID"
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.lineStrong}`, borderRadius: 6, background: C.card, fontSize: 14, fontFamily: FONT_BODY, color: C.ink }}
                  />
                </div>
              ) : (
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: 11, color: C.mute, fontWeight: 500, marginBottom: 6 }}>Function</label>
                  <input type="text" value={adminAnalysisCode} onChange={e => setAdminAnalysisCode(e.target.value)}
                    placeholder="Analysis code"
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.lineStrong}`, borderRadius: 6, background: C.card, fontSize: 14, fontFamily: FONT_BODY, color: C.ink }}
                  />
                </div>
              )}
              <div>
                <button onClick={() => saveAdminFields(r.id)}
                  style={{ padding: '10px 16px', background: C.cardinal, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Save
                </button>
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
              <button onClick={async () => { const latest = jobs.find(j => j.id === r.id) || r; await printForm(latest); }}
                style={{ padding: '10px 20px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: FONT_BODY, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={14} /> Print Form
              </button>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 24, marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.mute, letterSpacing: '0.04em', marginBottom: 10, textTransform: 'uppercase' }}>Contact Client</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href={`tel:${r.telephone && /^\d{4}$/.test(r.telephone.trim()) ? '1-868-662-2241,' + r.telephone.trim() : r.telephone}`}
                className="contact-action"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, border: `0.5px solid ${C.lineStrong}`, background: C.card, cursor: 'pointer', textDecoration: 'none', width: '100%' }}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: C.success + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Phone size={18} style={{ color: C.success }} />
                </span>
                <div>
                  <div style={{ margin: 0, fontSize: 14, fontWeight: 500, color: C.ink }}>Call client</div>
                  <div style={{ margin: 0, fontSize: 12, color: C.mute }}>Initiate a phone call</div>
                  <div style={{ margin: 0, fontSize: 12, color: C.mute }}>Tel: {r.telephone && /^\d{4}$/.test(r.telephone.trim()) ? '662 2241,' + r.telephone.trim() : r.telephone}</div>
                </div>
                <ChevronRight size={16} style={{ color: C.faint, marginLeft: 'auto' }} />
              </a>
              <a href={pastJobsGmailGeneral}
                target="_blank"
                className="contact-action"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, border: `0.5px solid ${C.lineStrong}`, background: C.card, cursor: 'pointer', textDecoration: 'none', width: '100%' }}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardinal + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail size={18} style={{ color: C.cardinal }} />
                </span>
                <div>
                  <div style={{ margin: 0, fontSize: 14, fontWeight: 500, color: C.ink }}>Email client</div>
                  <div style={{ margin: 0, fontSize: 12, color: C.mute }}>Compose a general email</div>
                </div>
                <ChevronRight size={16} style={{ color: C.faint, marginLeft: 'auto' }} />
              </a>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 24, marginTop: 24 }}>
<button onClick={() => setConfirmDeleteId(r.id)}
              style={{ padding: '10px 20px', background: C.danger, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: FONT_BODY }}>
              <Trash2 size={14} style={{ marginRight: 6 }} /> Delete Job
            </button>
          </div>
        </div>
      </div>

      {confirmDeleteId && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(43,35,25,0.4)',
          backdropFilter:'blur(4px)', display:'flex', alignItems:'center',
          justifyContent:'center', zIndex:200, padding:20,
        }} onClick={() => setConfirmDeleteId(null)}>
          <div style={{
            background:C.card, borderRadius:14,
            boxShadow:'0 20px 60px rgba(43,35,25,0.25)', padding:28,
            maxWidth:380, width:'100%', position:'relative',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 8px', fontFamily:FONT_DISPLAY, fontSize:18, fontWeight:500, color:C.ink }}>
              Delete Request
            </h3>
            <p style={{ margin:'0 0 20px', color:C.mute, fontSize:14, lineHeight:1.5 }}>
              Are you sure you want to permanently delete this completed job?
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmDeleteId(null)}
                style={{
                  padding:'10px 18px', background:C.card, color:C.ink,
                  border:`1px solid ${C.lineStrong}`, borderRadius:6, cursor:'pointer',
                  fontSize:13, fontWeight:500, fontFamily:FONT_BODY,
                }}>
                Cancel
              </button>
              <button onClick={handlePastDelete}
                style={{
                  padding:'10px 18px', background:C.danger, color:'#fff',
                  border:'none', borderRadius:6, cursor:'pointer',
                  fontSize:13, fontWeight:600, fontFamily:FONT_BODY,
                  display:'flex', alignItems:'center', gap:6,
                }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div className="fdsa-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 500, color: C.ink }}>
          Past Jobs
        </h2>
        <span style={{ fontSize: 12, color: C.mute }}>{sorted.length} job{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPastPage(1); }}
            placeholder="Search by recipient, name, or department"
            style={{
              width: '100%', padding: '10px 12px', border: `1px solid ${C.lineStrong}`, borderRadius: 6,
              background: C.card, fontSize: 14, fontFamily: FONT_BODY, color: C.ink,
            }} />
        </div>
        <button onClick={() => { setShowAllJobs(!showAllJobs); setPastPage(1); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 16px', border: `1px solid ${C.lineStrong}`, borderRadius: 6,
            background: showAllJobs ? C.cardinal : C.card, cursor: 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: FONT_BODY, color: showAllJobs ? '#fff' : C.ink,
          }}>
          All Jobs {showAllJobs ? 'ON' : 'OFF'}
        </button>
        <button onClick={() => { setSortAsc(!sortAsc); setPastPage(1); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 16px', border: `1px solid ${C.lineStrong}`, borderRadius: 6,
            background: sortAsc ? C.softBg : C.card, cursor: 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: FONT_BODY, color: C.ink,
          }}>
          Date {sortAsc ? '\u2191 Oldest' : '\u2193 Newest'}
        </button>
      </div>

      {paginated.length === 0 ? (
        <div className="pj-empty" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 40, textAlign: 'center' }}>
          <p style={{ color: C.mute, fontSize: 14, margin: 0 }}>{searchTerm ? 'No matching completed jobs.' : 'No completed jobs yet.'}</p>
        </div>
      ) : (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {paginated.map((r, idx) => {
            const currentMonth = formatMonth(r.pickupDate);
            const prevMonth = idx > 0 ? formatMonth(paginated[idx-1].pickupDate) : null;
            const showHeader = idx === 0 || currentMonth !== prevMonth;
            return (
              <div key={r.id} style={{ marginBottom: idx < paginated.length - 1 ? 8 : 0 }}>
                {showHeader && (
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    <span style={{ fontSize:15, fontWeight:600, color:C.ink, fontFamily:'Inter, sans-serif' }}>
                      {currentMonth}
                    </span>
                    <div style={{ flex:1, height:1, background:C.line }} />
                  </div>
                )}
                <div className="pj-card"
              onClick={() => setSelectedPast(r)}
              style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 4 }}>
                {r.recipientName}
                </div>
                <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.6 }}>
                  <div><strong>Name:</strong> {r.firstName} {r.lastName}</div>
                  <div><strong>Pickup:</strong> {r.pickupLocation}</div>
                  <div style={{color:C.mute}}>{formatDate(r.pickupDate)}</div>
                  <div style={{color:C.mute}}>{to12h(r.pickupTime)}</div>
                  <div style={{marginTop:2}}><strong>Dropoff:</strong> {r.dropoffLocation}</div>
                  {r.serviceType === 'round-trip' && <div style={{color:C.mute}}>Return: {formatDate(r.returnDate)}</div>}
                  {r.serviceType === 'round-trip' && <div style={{color:C.mute}}>{to12h(r.returnTime)}</div>}
                  <div><strong>Passengers:</strong> {r.passengers}{r.hasLuggage ? ` / Luggage: ${r.luggageQty}` : ''}</div>
                  {r.flightNumber && <div><strong>Flight:</strong> {r.flightNumber}</div>}
                  {r.assignedDriver && <div><strong>Driver:</strong> {r.assignedDriver}</div>}
                  <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: r.type === 'student' ? '#EEF3EC' : C.softBg, fontSize: 11, fontWeight: 600, color: r.type === 'student' ? '#3F6B3A' : C.mute }}>
                      {r.type === 'student' ? 'Student' : r.accountName}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: r.serviceType === 'round-trip' ? C.softBg : C.successBg, fontSize: 11, fontWeight: 600, color: C.mute }}>
                      {r.serviceType === 'round-trip' ? 'Round Trip' : 'One-way'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {r.amount != null && r.amount !== '' ? (
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', background: '#EEF3EC', color: C.success }}>
                    {formatMoney(r.amount)} {r.currency || 'TTD'}
                  </span>
                ) : (
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: C.success, color: '#fff' }}>
                    Completed
                  </span>
                )}
              </div>
            </div>
          </div>
          );
        })}
        </div>
        {totalPastPages > 1 && (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:20 }}>
            <button onClick={() => setPastPage(p => Math.max(1, p - 1))} disabled={pastPage === 1}
              style={{ padding:'8px 14px', border:`1px solid ${C.lineStrong}`, borderRadius:6, background:C.card, cursor:pastPage === 1 ? 'default' : 'pointer', fontSize:13, color:pastPage === 1 ? C.faint : C.ink, fontFamily:FONT_BODY }}>
              Previous
            </button>
            {Array.from({ length: totalPastPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPastPage(p)}
                style={{
                  width:32, height:32, borderRadius:6, border:'none',
                  background: p === pastPage ? C.cardinal : 'transparent',
                  color: p === pastPage ? '#fff' : C.mute,
                  cursor:'pointer', fontSize:13, fontWeight: p === pastPage ? 600 : 400, fontFamily:FONT_BODY,
                }}>
                {p}
              </button>
            ))}
            <button onClick={() => setPastPage(p => Math.min(totalPastPages, p + 1))} disabled={pastPage === totalPastPages}
              style={{ padding:'8px 14px', border:`1px solid ${C.lineStrong}`, borderRadius:6, background:C.card, cursor:pastPage === totalPastPages ? 'default' : 'pointer', fontSize:13, color:pastPage === totalPastPages ? C.faint : C.ink, fontFamily:FONT_BODY }}>
              Next
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}
