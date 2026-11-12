import { C, FONT_MONO } from './theme';

export default function SheetDescription({ index, name, desc, last }) {
  return (
    <div style={{
      display: 'flex', gap: 14, padding: '12px 0',
      borderBottom: last ? 'none' : `1px solid ${C.line}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: C.softBg, color: C.cardinal,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600, flexShrink: 0,
      }}>{index}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{name}</div>
        <div style={{ fontSize: 12, color: C.mute, marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}
