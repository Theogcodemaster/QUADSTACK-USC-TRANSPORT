import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';
import { FileDown, CalendarRange } from 'lucide-react';
import { C, FONT_DISPLAY, FONT_BODY, FONT_MONO } from '../shared/theme';
import { formatMoney } from '../shared/helpers';
import DateField from '../shared/DateField';
import SheetDescription from '../shared/SheetDescription';

export default function ExportPage({ start, end, setStart, setEnd, presetRange, pastJobs, cancelledJobs, exporting, setExporting }) {
  const inRange = pastJobs.filter(d => d.pickupDate >= start && d.pickupDate <= end);
  const cancelledInRange = cancelledJobs.filter(d => d.pickupDate >= start && d.pickupDate <= end);
  const rangeTotal = inRange.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const runExport = async () => {
    if (start > end) {
      alert('Start date must be on or before end date.');
      return;
    }
    if (inRange.length === 0 && cancelledInRange.length === 0) {
      alert('No saved jobs in that date range.');
      return;
    }
    setExporting(true);
    try {
      const sorted = [...inRange].sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
      const sortedCancelled = [...cancelledInRange].sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
      const total = sorted.reduce((s, d) => s + (Number(d.amount) || 0), 0);

      const monthName = new Date(start + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const rows = [
        [`TRANSPORTATION REPORT - ${monthName}`],
        ['Date', 'Acct Code', 'Account Name', 'Fund', 'Function', 'Transaction Description', 'Amount', 'Currency'],
        ...sorted.map(d => [
          d.pickupDate,
          d.accountCode || '890110',
          d.type === 'student' ? (d.recipientName || '') : (d.accountName || ''),
          10,
          d.analysisCode || '',
          `${d.pickupLocation || ''} / ${d.dropoffLocation || ''}`,
          Number(d.amount) || 0,
          d.currency || 'TTD',
        ]),
        [],
        [],
        [],
        ['', '', '', '', '', 'Total Sum', total, ''],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
      const dataRows = rows.slice(1);
      ws['!cols'] = dataRows[0].map((_, ci) => {
        const maxLen = dataRows.reduce((max, row) => {
          const val = row[ci] != null ? String(row[ci]) : '';
          return Math.max(max, val.length);
        }, 0);
        return { wch: Math.max(maxLen + 2, 10) };
      });

      for (let c = 0; c < 8; c++) {
        const ref = XLSX.utils.encode_cell({ r: 1, c });
        if (ws[ref]) ws[ref].s = { font: { bold: true } };
      }

      for (let r = 2; r < 2 + sorted.length; r++) {
        const ref = XLSX.utils.encode_cell({ r, c: 6 });
        if (ws[ref]) ws[ref].z = '"$"#,##0.00';
      }

      const totalRow = 2 + sorted.length + 3;
      const totalRef = XLSX.utils.encode_cell({ r: totalRow, c: 6 });
      if (ws[totalRef]) ws[totalRef].z = '"$"#,##0.00';

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transport Report');

      if (sortedCancelled.length > 0) {
        const cancelledRows = [
          [`CANCELLED JOBS - ${monthName}`],
          ['Date', 'Acct Code', 'Account Name', 'Fund', 'Function', 'Transaction Description', 'Amount', 'Currency'],
          ...sortedCancelled.map(d => [
            d.pickupDate,
            d.accountCode || '890110',
            d.type === 'student' ? (d.recipientName || '') : (d.accountName || ''),
            10,
          d.analysisCode || '',
            `${d.pickupLocation || ''} / ${d.dropoffLocation || ''}`,
            Number(d.amount) || 0,
            d.currency || 'TTD',
          ]),
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(cancelledRows);
        ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
        const cancelledDataRows = cancelledRows.slice(1);
        ws2['!cols'] = cancelledDataRows[0].map((_, ci) => {
          const maxLen = cancelledDataRows.reduce((max, row) => {
            const val = row[ci] != null ? String(row[ci]) : '';
            return Math.max(max, val.length);
          }, 0);
          return { wch: Math.max(maxLen + 2, 10) };
        });
        for (let c = 0; c < 8; c++) {
          const ref = XLSX.utils.encode_cell({ r: 1, c });
          if (ws2[ref]) ws2[ref].s = { font: { bold: true } };
        }
        XLSX.utils.book_append_sheet(wb, ws2, 'Cancelled');
      }

      const filename = `Transport_Report_${start}_to_${end}.xlsx`;
      if (Capacitor.isNativePlatform()) {
        const b64 = XLSX.write(wb, { type: 'base64' });
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
        XLSX.writeFile(wb, filename);
      }
    } catch (err) {
      alert('Export error: ' + (err?.message || 'unknown'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fdsa-fade">
      <div style={{ marginBottom: 26 }}>
        <h2 className="exp-title" style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 500, letterSpacing: '-0.015em' }}>Export Report</h2>
        <p style={{ margin: '6px 0 0', color: C.mute, fontSize: 14, maxWidth: 620 }}>
          Generate a multi-sheet Excel workbook for any date range. Signatures are excluded from export per policy.
        </p>
      </div>

      <div className="exp-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="exp-card" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.25em', color: C.mute, fontWeight: 600, marginBottom: 14 }}>
            Date range
          </div>

          <div className="exp-date-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <DateField label="Start" value={start} onChange={setStart} />
            <DateField label="End"   value={end}   onChange={setEnd} />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
            {[
              { id: 'thisMonth', label: 'This month' },
              { id: 'lastMonth', label: 'Last month' },
              { id: 'last7',     label: 'Last 7 days' },
              { id: 'thisYear',  label: 'This year' },
            ].map(p => (
              <button key={p.id} onClick={() => presetRange(p.id)}
                style={{
                  padding: '7px 12px', background: C.softBg, color: C.ink,
                  border: `1px solid ${C.line}`, borderRadius: 999, cursor: 'pointer',
                  fontSize: 11, fontWeight: 500, fontFamily: FONT_BODY,
                }}>
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 22, padding: '14px 16px', background: C.softBg, borderRadius: 8, fontSize: 12, color: C.mute }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <CalendarRange size={14} />
              <span style={{ color: C.ink, fontWeight: 600, fontSize: 13 }}>Preview</span>
            </div>
            <div>{inRange.length} completed trip{inRange.length === 1 ? '' : 's'} in range</div>
            {cancelledInRange.length > 0 && <div>{cancelledInRange.length} cancelled trip{cancelledInRange.length === 1 ? '' : 's'} in range</div>}
            <div>Range total: <span style={{ color: C.ink, fontWeight: 600, fontFamily: FONT_MONO }}>{formatMoney(rangeTotal)}</span></div>
          </div>

          <button onClick={runExport} disabled={exporting || (inRange.length === 0 && cancelledInRange.length === 0)}
            style={{
              width: '100%', marginTop: 20, padding: '14px 18px',
              background: inRange.length === 0 && cancelledInRange.length === 0 ? C.softBg : C.cardinal,
              color: inRange.length === 0 && cancelledInRange.length === 0 ? C.faint : '#FAF8F3',
              border: 'none', borderRadius: 8,
              cursor: (exporting || (inRange.length === 0 && cancelledInRange.length === 0)) ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: FONT_BODY,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              letterSpacing: '0.01em',
              boxShadow: inRange.length > 0 || cancelledInRange.length > 0 ? '0 2px 8px rgba(94,183,106,0.2)' : 'none',
            }}>
            <FileDown size={16} />
            {exporting ? 'Exporting\u2026' : 'Download Excel workbook'}
          </button>
        </div>

        <div className="exp-card" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.25em', color: C.mute, fontWeight: 600, marginBottom: 14 }}>
            Workbook contents
          </div>
          <SheetDescription
            index="1" name="Transport Report"
            desc="Each trip with Date, Acct Code, Account Name, Fund, Function, Transaction Description, Amount, and Currency."
            last={false}
          />
          {cancelledInRange.length > 0 && <SheetDescription
            index="2" name="Cancelled"
            desc="All cancelled jobs in the selected date range."
            last
          />}
          <div style={{ marginTop: 18, padding: '12px 14px', background: C.softBg, borderRadius: 8, fontSize: 12, color: C.mute, lineHeight: 1.5 }}>
            Report automatically generated for Finance Department
          </div>
        </div>
      </div>
    </div>
  );
}
