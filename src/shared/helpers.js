export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

export const firstOfMonth = (iso) => iso.slice(0, 8) + '01';

export const formatDateShort = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('en-US',
    { weekday: 'short', month: 'short', day: 'numeric' });
};

export const formatMoney = (n) =>
  `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const to12h = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const formatCreatedAt = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${date} - ${h}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const formatMonth = (ds) => {
  if (!ds) return '';
  const [y, m] = ds.split('-').map(Number);
  return new Date(y, m-1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const formatDateTime = (ds) => {
  if (!ds) return '';
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};
