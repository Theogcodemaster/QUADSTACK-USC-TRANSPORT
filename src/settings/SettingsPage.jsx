import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Plus, CheckCircle } from 'lucide-react';
import { C, FONT_DISPLAY, FONT_BODY } from '../shared/theme';

export default function SettingsPage({ driversConfig }) {
  const [drivers, setDrivers] = useState(driversConfig.drivers);
  const [otherColor, setOtherColor] = useState(driversConfig.otherColor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDrivers(driversConfig.drivers);
    setOtherColor(driversConfig.otherColor);
  }, [driversConfig]);

  const addDriver = () => {
    setDrivers([...drivers, { name: '', color: '#6366F1' }]);
  };

  const removeDriver = (idx) => {
    setDrivers(drivers.filter((_, i) => i !== idx));
  };

  const updateDriver = (idx, field, value) => {
    setDrivers(drivers.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, 'Settings', 'drivers'), {
        drivers: drivers.filter(d => d.name.trim()),
        otherColor,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save settings error:', err);
    }
    setSaving(false);
  };

  return (
    <div className="fdsa-fade">
      <h2 style={{ margin: '0 0 24px', fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 500, color: C.ink }}>
        Settings
      </h2>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 24, maxWidth: 600 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: C.ink }}>
          Drivers & Calendar Colors
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: C.mute }}>
          Manage the list of drivers and their assigned colors for the calendar view.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {drivers.map((d, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: d.color, border: `1px solid ${C.line}`, flexShrink: 0 }} />
              <input
                type="color"
                value={d.color}
                onChange={e => updateDriver(idx, 'color', e.target.value)}
                style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0, background: 'transparent' }}
              />
              <input
                value={d.name}
                onChange={e => updateDriver(idx, 'name', e.target.value)}
                placeholder="Driver name"
                style={{
                  flex: 1, padding: '10px 12px', border: `1px solid ${C.lineStrong}`, borderRadius: 6,
                  background: C.card, fontSize: 14, fontFamily: FONT_BODY, color: C.ink,
                }}
              />
              <button onClick={() => removeDriver(idx)}
                style={{
                  padding: '8px', background: 'transparent', border: `1px solid ${C.line}`,
                  borderRadius: 6, cursor: 'pointer', color: C.danger, display: 'flex', alignItems: 'center',
                }}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        <button onClick={addDriver}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 14,
            padding: '10px 16px', background: C.softBg, border: `1px dashed ${C.lineStrong}`,
            borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: FONT_BODY,
            color: C.mute, transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C.line; e.currentTarget.style.color = C.ink; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.softBg; e.currentTarget.style.color = C.mute; }}>
          <Plus size={16} />
          Add Driver
        </button>

        <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${C.line}` }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 8 }}>
            Other (unassigned) color
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: otherColor, border: `1px solid ${C.line}`, flexShrink: 0 }} />
            <input
              type="color"
              value={otherColor}
              onChange={e => setOtherColor(e.target.value)}
              style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0, background: 'transparent' }}
            />
            <span style={{ fontSize: 13, color: C.mute }}>{otherColor}</span>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding: '10px 24px', background: C.cardinal, color: '#fff', border: 'none',
              borderRadius: 6, cursor: saving ? 'wait' : 'pointer', fontSize: 14, fontWeight: 600,
              fontFamily: FONT_BODY, transition: 'all .15s', opacity: saving ? 0.7 : 1,
            }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && (
            <span style={{ fontSize: 13, color: C.success, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={14} /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
