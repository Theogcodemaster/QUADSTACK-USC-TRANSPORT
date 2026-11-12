import { useState, useRef, useEffect } from 'react'
import { collection, addDoc, serverTimestamp, doc, getDoc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase'
import { COST_CENTRES } from '../costCentres'
import { Send, CheckCircle, AlertCircle, GraduationCap, Building2, Luggage, ArrowLeftRight, MapPin, Plane, ClipboardPlus } from 'lucide-react'
import { C, FONT_DISPLAY, FONT_BODY } from '../shared/theme'
import { todayISO } from '../shared/helpers'

const PICKUP_SUGGESTIONS = [
  'USC Gym',
  'Piarco International Airport',
  'Timothy Greaves Residence Hall',
  'Ladies Residence Hall',
  'POS Ferry Terminal',
  'Admin Carpark',
]

export default function FormPage() {
  const [showForm, setShowForm] = useState(false)
  const [isStudent, setIsStudent] = useState(false)
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    telephone: '',
    accountName: '',
    studentId: '',
    recipientName: '',
    passengers: '1',
    hasLuggage: false,
    luggageQty: '1',
    serviceType: 'one-way',
    pickupDate: todayISO(),
    pickupTime: '',
    pickupLocation: '',
    flightNumber: '',
    dropoffLocation: '',
    returnDate: '',
    returnTime: '',
  })
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCode, setSelectedCode] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false)
  const [showDomainHint, setShowDomainHint] = useState(false)
  const [domainHint, setDomainHint] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState(null)
  const [showEarlyModal, setShowEarlyModal] = useState(false)
  const wrapperRef = useRef(null)
  const pickupRef = useRef(null)
  const emailRef = useRef(null)

  const filtered = query.trim() === ''
    ? COST_CENTRES
    : COST_CENTRES.filter(
        c => c.name.toLowerCase().includes(query.toLowerCase()) ||
             c.code.toLowerCase().includes(query.toLowerCase())
      )

  const selectAccount = (entry) => {
    setForm(f => ({ ...f, accountName: entry.name }))
    setSelectedCode(entry.code)
    setQuery(entry.name)
    setShowDropdown(false)
  }

  const handleAccountInput = (e) => {
    const val = e.target.value
    setQuery(val)
    setForm(f => ({ ...f, accountName: val }))
    if (!val.trim()) setSelectedCode('')
    setShowDropdown(true)
    setHighlightIdx(-1)
  }

  const handleKeyDown = (e) => {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && highlightIdx >= 0 && filtered[highlightIdx]) {
      e.preventDefault()
      selectAccount(filtered[highlightIdx])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (pickupRef.current && !pickupRef.current.contains(e.target)) {
        setShowPickupSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (emailRef.current && !emailRef.current.contains(e.target)) {
        setShowDomainHint(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggleMode = (student) => {
    setIsStudent(student)
    setForm(f => ({ ...f, accountName: '', studentId: '' }))
    setQuery('')
    setSelectedCode('')
    setStatus(null)
  }

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [field]: value }))
  }

  const selectPickupSuggestion = (suggestion) => {
    setForm(f => ({ ...f, pickupLocation: suggestion }))
    setShowPickupSuggestions(false)
  }

  const handlePickupInput = (e) => {
    setForm(f => ({ ...f, pickupLocation: e.target.value }))
    setShowPickupSuggestions(true)
  }

  const handleEmailChange = (e) => {
    const val = e.target.value
    setForm(f => ({ ...f, email: val }))
    const atIdx = val.lastIndexOf('@')
    if (atIdx !== -1) {
      const afterAt = val.slice(atIdx + 1).toLowerCase()
      if (afterAt === 's') {
        setDomainHint('stu.usc.edu.tt')
        setShowDomainHint(true)
      } else if (afterAt === 'u') {
        setDomainHint('usc.edu.tt')
        setShowDomainHint(true)
      } else {
        setShowDomainHint(false)
      }
    } else {
      setShowDomainHint(false)
    }
  }

  const applyDomainHint = (hint) => {
    const atIdx = form.email.lastIndexOf('@')
    setForm(f => ({ ...f, email: f.email.slice(0, atIdx + 1) + hint }))
    setShowDomainHint(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.email || !form.firstName || !form.lastName || !form.telephone) {
      setStatus({ type: 'error', msg: 'Email, name, and telephone are required.' })
      return
    }
    if (isStudent && !form.studentId.trim()) {
      setStatus({ type: 'error', msg: 'Student ID is required.' })
      return
    }
    if (!isStudent && (!form.accountName || !selectedCode)) {
      setStatus({ type: 'error', msg: 'Select a valid department from the dropdown.' })
      return
    }
    if (!form.recipientName) {
      setStatus({ type: 'error', msg: 'Name of person to receive service is required.' })
      return
    }
    if (!form.pickupLocation || !form.dropoffLocation) {
      setStatus({ type: 'error', msg: 'Pick-up and drop-off locations are required.' })
      return
    }
    if (!form.pickupTime) {
      setStatus({ type: 'error', msg: 'Pick-up time is required.' })
      return
    }
    if (form.serviceType === 'round-trip' && (!form.returnDate || !form.returnTime)) {
      setStatus({ type: 'error', msg: 'Return date and time are required for round trips.' })
      return
    }
    if (isPiarco && !/^[A-Za-z0-9]{2}\d{1,4}[A-Za-z]?$/.test(form.flightNumber)) {
      setStatus({ type: 'error', msg: 'Enter a valid flight number (e.g. BW600).' })
      return
    }

    setSubmitting(true)
    setStatus(null)

    try {
      const docData = {
        type: isStudent ? 'student' : 'department',
        status: 'pending',
        assignedDriver: null,
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        telephone: form.telephone,
        accountName: form.accountName,
        accountCode: '890110',
        analysisCode: isStudent ? `S${form.studentId}` : selectedCode,
        studentId: isStudent ? form.studentId : null,
        recipientName: form.recipientName,
        passengers: parseInt(form.passengers, 10) || 1,
        hasLuggage: form.hasLuggage,
        luggageQty: form.hasLuggage ? parseInt(form.luggageQty, 10) || 1 : 0,
        serviceType: form.serviceType,
        pickupDate: form.pickupDate,
        pickupTime: form.pickupTime,
        pickupLocation: form.pickupLocation,
        flightNumber: form.pickupLocation === 'Piarco International Airport' ? form.flightNumber : null,
        dropoffLocation: form.dropoffLocation,
        returnDate: form.serviceType === 'round-trip' ? form.returnDate : null,
        returnTime: form.serviceType === 'round-trip' ? form.returnTime : null,
        createdAt: serverTimestamp(),
      }

      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'Counters', 'jobs');
        const counterSnap = await transaction.get(counterRef);
        const nextNum = counterSnap.exists() ? (counterSnap.data().nextNumber || 1) : 1;
        const jobId = `JOB${String(nextNum).padStart(5, '0')}`;

        transaction.set(doc(db, 'Requests', jobId), {
          ...docData,
          jobNumber: nextNum,
        });
        transaction.set(counterRef, { nextNumber: nextNum + 1 }, { merge: true });
      });

      setShowEarlyModal(true)

      setStatus({ type: 'success', msg: 'Transport request saved successfully. Look out for confirmation or denial message' })
      setForm({
        email: '',
        firstName: '',
        lastName: '',
        telephone: '',
        accountName: '',
        studentId: '',
        recipientName: '',
        passengers: '1',
        hasLuggage: false,
        luggageQty: '1',
        serviceType: 'one-way',
        pickupDate: todayISO(),
        pickupTime: '',
        pickupLocation: '',
        flightNumber: '',
        dropoffLocation: '',
        returnDate: '',
        returnTime: '',
      })
      setQuery('')
      setSelectedCode('')
    } catch (err) {
      setStatus({ type: 'error', msg: err?.message || 'Failed to save.' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    border: `1px solid ${C.lineStrong}`, borderRadius: 6,
    background: C.card, fontSize: 14, fontFamily: FONT_BODY, color: C.ink,
  }

  const labelStyle = {
    display: 'block', fontSize: 11, color: C.mute, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
  }

  const isPiarco = form.pickupLocation === 'Piarco International Airport'
  const isRoundTrip = form.serviceType === 'round-trip'
  const accountCode = isStudent && form.studentId.trim()
    ? `S${form.studentId}`
    : selectedCode

  return (
    <div className="fdsa-fade">
      <style>{`
        .frm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .frm-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
        .frm-card  { padding: 28px; }
        .frm-flight { display: flex; align-items: center; gap: 10px; }
        @media (max-width: 640px) {
          .frm-grid-2 { grid-template-columns: 1fr; }
          .frm-grid-3 { grid-template-columns: 1fr; }
          .frm-card  { padding: 16px; }
          .frm-flight { flex-direction: column; align-items: stretch; }
          .frm-section-title { font-size: 16px !important; }
          .frm-head h2 { font-size: 22px !important; }
          .frm-head p { font-size: 13px !important; }
          .frm-return { padding: 14px !important; }
        }
      `}</style>
      <div className="frm-head" style={{ marginBottom: 26 }}>
        <h2 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 500, letterSpacing: '-0.015em' }}>
          Transport Request Form
        </h2>
        <p style={{ margin: '6px 0 0', color: C.mute, fontSize: 14, maxWidth: 620 }}>
          Fill in your details to request transportation.
        </p>
      </div>

      {!showForm ? (
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          <div style={{
            background: C.card, border: `2px dashed ${C.lineStrong}`,
            borderRadius: 16, padding: '60px 40px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center', gap: 20,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: C.successBg, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <ClipboardPlus size={32} style={{ color: C.cardinal }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 500, color: C.ink }}>
                Make a Transport Request
              </h3>
              <p style={{ margin: '8px 0 0', color: C.mute, fontSize: 14, maxWidth: 400, lineHeight: 1.5 }}>
                Fill out the transport request form to schedule a pickup and drop-off for yourself, a student, or a department.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowForm(true); setStatus(null) }}
              style={{
                padding: '14px 36px', border: 'none', borderRadius: 8,
                background: C.cardinal, color: '#FAF8F3',
                cursor: 'pointer', fontSize: 15, fontWeight: 600, fontFamily: FONT_BODY,
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 2px 8px rgba(94,183,106,0.25)',
                transition: 'all .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.cardinalDark}
              onMouseLeave={e => e.currentTarget.style.background = C.cardinal}
            >
              <ClipboardPlus size={18} />
              Start Transport Request
            </button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} style={{ maxWidth: 740, margin: '0 auto' }}>
        <div className="frm-card" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12 }}>

          {/* ── Contact Info ── */}
          <div style={{ marginBottom: 24 }}>
            <div className="frm-section-title" style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 14, fontFamily: FONT_DISPLAY, letterSpacing: '0.01em' }}>
              Contact Information
            </div>

            <div style={{ marginBottom: 16, position: 'relative' }} ref={emailRef}>
              <label style={labelStyle}>Email</label>
              <input type="email" value={form.email} onChange={handleEmailChange} onKeyDown={(e) => { if (e.key === 'Enter' && showDomainHint && domainHint) { e.preventDefault(); applyDomainHint(domainHint) } }} placeholder="you@example.com" style={inputStyle} required autoComplete="off" />
              {showDomainHint && domainHint && (
                <button
                  type="button"
                  onClick={() => applyDomainHint(domainHint)}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    marginTop: 2, padding: '10px 14px', border: `1px solid ${C.lineStrong}`,
                    borderRadius: 6, background: C.card, cursor: 'pointer',
                    fontFamily: FONT_BODY, fontSize: 13, color: C.ink,
                    textAlign: 'left', boxShadow: '0 8px 24px rgba(43,35,25,0.12)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{ color: C.mute }}>@</span>
                  {domainHint}
                </button>
              )}
            </div>

            <div className="frm-grid-2" style={{ marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input type="text" value={form.firstName} onChange={update('firstName')} placeholder="John" style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input type="text" value={form.lastName} onChange={update('lastName')} placeholder="Doe" style={inputStyle} required />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Telephone Number</label>
              <input type="tel" value={form.telephone} onChange={update('telephone')} placeholder="+1 (868) 555-0123" style={inputStyle} required />
            </div>
          </div>

          {/* ── Department / Student ── */}
          <div style={{ marginBottom: 24 }}>
            <div className="frm-section-title" style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 14, fontFamily: FONT_DISPLAY, letterSpacing: '0.01em' }}>
              Department / School
            </div>

            <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.lineStrong}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => toggleMode(false)}
                style={{
                  flex: 1, padding: '11px 16px', border: 'none', cursor: 'pointer',
                  fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: isStudent ? C.card : C.cardinal,
                  color: isStudent ? C.ink : '#FAF8F3',
                  transition: 'all .15s',
                }}
              >
                <Building2 size={15} />
                Department
              </button>
              <button
                type="button"
                onClick={() => toggleMode(true)}
                style={{
                  flex: 1, padding: '11px 16px', border: 'none', cursor: 'pointer',
                  fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: isStudent ? C.cardinal : C.card,
                  color: isStudent ? '#FAF8F3' : C.ink,
                  transition: 'all .15s',
                }}
              >
                <GraduationCap size={15} />
                Student
              </button>
            </div>

            {isStudent ? (
              <div>
                <label style={labelStyle}>Student ID</label>
                <input
                  type="text"
                  value={form.studentId}
                  onChange={update('studentId')}
                  placeholder="e.g. 2022092267"
                  style={inputStyle}
                  required
                />
                {form.studentId.trim() && null}
              </div>
            ) : (
              <div style={{ position: 'relative' }} ref={wrapperRef}>
                <label style={labelStyle}>Department / School</label>
                <input
                  type="text"
                  value={query}
                  onChange={handleAccountInput}
                  onFocus={() => { setShowDropdown(true); setHighlightIdx(-1) }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type to search..."
                  style={inputStyle}
                  autoComplete="off"
                  required
                />
                {selectedCode && null}
                {showDropdown && filtered.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: C.card, border: `1px solid ${C.lineStrong}`,
                    borderRadius: 6, boxShadow: '0 8px 24px rgba(43,35,25,0.12)',
                    maxHeight: 220, overflowY: 'auto', marginTop: 4,
                  }}>
                    {filtered.slice(0, 50).map((entry, i) => (
                      <button
                        type="button"
                        key={entry.code}
                        onClick={() => selectAccount(entry)}
                        onMouseEnter={() => setHighlightIdx(i)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '10px 14px',
                          background: i === highlightIdx ? C.softBg : 'transparent',
                          border: 'none', cursor: 'pointer', fontFamily: FONT_BODY,
                          fontSize: 13, color: C.ink,
                        }}
                      >
                        {entry.name}
                      </button>
                    ))}
                    {filtered.length > 50 && (
                      <div style={{ padding: '8px 14px', fontSize: 11, color: C.mute, textAlign: 'center', borderTop: `1px solid ${C.line}` }}>
                        {filtered.length - 50} more — type to narrow
                      </div>
                    )}
                  </div>
                )}
                {showDropdown && filtered.length === 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: C.card, border: `1px solid ${C.lineStrong}`,
                    borderRadius: 6, padding: '14px', fontSize: 13, color: C.mute,
                    marginTop: 4,
                  }}>
                    No matching departments found.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Recipient & Passengers ── */}
          <div style={{ marginBottom: 24 }}>
            <div className="frm-section-title" style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 14, fontFamily: FONT_DISPLAY, letterSpacing: '0.01em' }}>
              Trip Details
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Name of Person to Receive Service</label>
              <input type="text" value={form.recipientName} onChange={update('recipientName')} placeholder="Who is this service for?" style={inputStyle} required />
            </div>

            <div className="frm-grid-2" style={{ marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Number of Passengers</label>
                <input type="number" min="1" value={form.passengers} onChange={update('passengers')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Would you have any luggage?</label>
                <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.lineStrong}`, borderRadius: 6, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, hasLuggage: false }))}
                    style={{
                      flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                      fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500,
                      background: !form.hasLuggage ? C.cardinal : C.card,
                      color: !form.hasLuggage ? '#FAF8F3' : C.ink,
                    }}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, hasLuggage: true }))}
                    style={{
                      flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                      fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500,
                      background: form.hasLuggage ? C.cardinal : C.card,
                      color: form.hasLuggage ? '#FAF8F3' : C.ink,
                    }}
                  >
                    Yes
                  </button>
                </div>
              </div>
            </div>

            {form.hasLuggage && (
              <div className="frm-return" style={{
                padding: 16, background: C.softBg,
                borderRadius: 8, border: `1px solid ${C.line}`,
              }}>
                <label style={labelStyle}>Number of Luggage</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, luggageQty: String(n) }))}
                      style={{
                        flex: 1, padding: '10px', border: `1px solid ${C.lineStrong}`,
                        borderRadius: 6, cursor: 'pointer', fontFamily: FONT_BODY,
                        fontSize: 14, fontWeight: 600,
                        background: form.luggageQty === String(n) ? C.cardinal : C.card,
                        color: form.luggageQty === String(n) ? '#FAF8F3' : C.ink,
                        transition: 'all .1s',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Service Type ── */}
          <div style={{ marginBottom: 24 }}>
            <div className="frm-section-title" style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 14, fontFamily: FONT_DISPLAY, letterSpacing: '0.01em' }}>
              Type of Service
            </div>

            <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.lineStrong}`, borderRadius: 8, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, serviceType: 'one-way', returnDate: '', returnTime: '' }))}
                style={{
                  flex: 1, padding: '12px 16px', border: 'none', cursor: 'pointer',
                  fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: form.serviceType === 'one-way' ? C.cardinal : C.card,
                  color: form.serviceType === 'one-way' ? '#FAF8F3' : C.ink,
                  transition: 'all .15s',
                }}
              >
                <ArrowLeftRight size={15} />
                One-way
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, serviceType: 'round-trip' }))}
                style={{
                  flex: 1, padding: '12px 16px', border: 'none', cursor: 'pointer',
                  fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: form.serviceType === 'round-trip' ? C.cardinal : C.card,
                  color: form.serviceType === 'round-trip' ? '#FAF8F3' : C.ink,
                  transition: 'all .15s',
                }}
              >
                <ArrowLeftRight size={15} style={{ transform: 'rotate(180deg)' }} />
                Round Trip
              </button>
            </div>
          </div>

          {/* ── Pick-up ── */}
          <div style={{ marginBottom: 24 }}>
            <div className="frm-section-title" style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 14, fontFamily: FONT_DISPLAY, letterSpacing: '0.01em' }}>
              Pick-up
            </div>

            <div className="frm-grid-2" style={{ marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Pick-up Date</label>
                <input type="date" value={form.pickupDate} onChange={update('pickupDate')} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Pick-up Time</label>
                <input type="time" value={form.pickupTime} onChange={update('pickupTime')} style={inputStyle} required />
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: isPiarco ? 12 : 0 }} ref={pickupRef}>
              <label style={labelStyle}>Pick-up Location</label>
              <input
                type="text"
                value={form.pickupLocation}
                onChange={handlePickupInput}
                onFocus={() => setShowPickupSuggestions(true)}
                placeholder="Type or select a suggestion..."
                style={inputStyle}
                autoComplete="off"
                required
              />
              {showPickupSuggestions && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: C.card, border: `1px solid ${C.lineStrong}`,
                  borderRadius: 6, boxShadow: '0 8px 24px rgba(43,35,25,0.12)',
                  marginTop: 4, overflow: 'hidden',
                }}>
                  {PICKUP_SUGGESTIONS.filter(s => s.toLowerCase().includes(form.pickupLocation.toLowerCase())).map(s => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => selectPickupSuggestion(s)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px',
                        border: 'none', cursor: 'pointer', fontFamily: FONT_BODY,
                        fontSize: 13, color: C.ink, background: C.card,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = C.softBg}
                      onMouseLeave={e => e.currentTarget.style.background = C.card}
                    >
                      <MapPin size={14} style={{ color: C.mute, flexShrink: 0 }} />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isPiarco && (
              <div className="frm-flight" style={{
                padding: '12px 14px', background: C.softBg, borderRadius: 6,
              }}>
                <Plane size={16} style={{ color: C.mute, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, marginBottom: 4 }}>Flight Number</label>
                  <input
                    type="text"
                    value={form.flightNumber}
                    onChange={(e) => {
                      const stripped = e.target.value.replace(/\s/g, '')
                      setForm(f => ({ ...f, flightNumber: stripped }))
                    }}
                    placeholder="e.g. BW600"
                    pattern="^[A-Za-z0-9]{2}\d{1,4}[A-Za-z]?$"
                    required
                    title="Enter a valid IATA flight number, e.g. BW600"
                    style={{ ...inputStyle, background: C.card }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Drop-off ── */}
          <div style={{ marginBottom: 24 }}>
            <div className="frm-section-title" style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 14, fontFamily: FONT_DISPLAY, letterSpacing: '0.01em' }}>
              Drop-off
            </div>

            <div>
              <label style={labelStyle}>Drop-off Location</label>
              <input type="text" value={form.dropoffLocation} onChange={update('dropoffLocation')} placeholder="Where to?" style={inputStyle} required />
            </div>
          </div>

          {/* ── Return (Round Trip) ── */}
          {isRoundTrip && (
            <div className="frm-return" style={{
              marginBottom: 24, padding: 20, background: C.softBg,
              borderRadius: 8, border: `1px solid ${C.line}`,
            }}>
              <div className="frm-section-title" style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 14, fontFamily: FONT_DISPLAY, letterSpacing: '0.01em' }}>
                Return Trip
              </div>

              <div className="frm-grid-2">
                <div>
                  <label style={labelStyle}>Return Date *</label>
                  <input type="date" value={form.returnDate} onChange={update('returnDate')} style={inputStyle} required={isRoundTrip} />
                </div>
                <div>
                  <label style={labelStyle}>Return Time *</label>
                  <input type="time" value={form.returnTime} onChange={update('returnTime')} style={inputStyle} required={isRoundTrip} />
                </div>
              </div>
            </div>
          )}

          {/* ── Status ── */}
          {status && (
            <div style={{
              marginBottom: 16, padding: '12px 16px', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
              background: status.type === 'success' ? C.successBg : C.dangerBg,
              color: status.type === 'success' ? C.success : C.danger,
            }}>
              {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{status.msg}</span>
            </div>
          )}

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '14px 18px',
              background: submitting ? C.softBg : C.cardinal,
              color: submitting ? C.faint : '#FAF8F3',
              border: 'none', borderRadius: 8,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: 15, fontWeight: 600, fontFamily: FONT_BODY,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              letterSpacing: '0.01em',
              boxShadow: submitting ? 'none' : '0 2px 8px rgba(94,183,106,0.2)',
            }}
          >
            <Send size={16} />
            {submitting ? 'Submitting\u2026' : 'Submit Transport Request'}
          </button>
        </div>
      </form>
      )}

      {showEarlyModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(43,35,25,0.5)',
          backdropFilter:'blur(4px)', display:'flex', alignItems:'center',
          justifyContent:'center', zIndex:200, padding:20,
        }} onClick={() => setShowEarlyModal(false)}>
          <div style={{
            background: C.card, borderRadius: 16, padding: 32, maxWidth: 480, width: '100%',
            boxShadow: '0 20px 60px rgba(43,35,25,0.25)', textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: C.success + '22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <CheckCircle size={28} style={{ color: C.success }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: C.ink }}>
              Request Received
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: 15, color: C.mute, lineHeight: 1.6 }}>
              Remember, requests are to be sent 5 working days in advance.
            </p>
            <button onClick={() => setShowEarlyModal(false)}
              style={{
                padding: '12px 32px', border: 'none', borderRadius: 8,
                background: C.success, color: '#fff', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, fontFamily: FONT_BODY,
              }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
