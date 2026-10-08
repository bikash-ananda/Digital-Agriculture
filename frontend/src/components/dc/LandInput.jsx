import { useState } from 'react';
import { splitSqm, toSqm } from '../../utils/dc';

export default function LandInput({ value, onChange, lang }) {
  const [v, setV] = useState(() => {
    if (!value) return { ropani: '', aana: '', paisa: '', dam: '' };
    const s = splitSqm(value);
    return { ropani: s.ropani || '', aana: s.aana || '', paisa: s.paisa || '', dam: s.dam || '' };
  });
  const sqm = toSqm(v);
  const units = lang === 'en' ? ['Ropani', 'Aana', 'Paisa', 'Dam'] : ['रोपनी', 'आना', 'पैसा', 'दाम'];
  const keys = ['ropani', 'aana', 'paisa', 'dam'];
  const upd = (k, x) => {
    const nv = { ...v, [k]: x };
    setV(nv);
    const s = toSqm(nv);
    onChange(s > 0 ? Math.round(s * 100) / 100 : '');
  };
  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {keys.map((k, i) => (
          <label key={k} className="text-xs text-gray-500">{units[i]}
            <input type="number" min="0" max={k === 'aana' ? 15 : k === 'paisa' ? 3 : undefined} step={k === 'dam' ? '0.1' : '1'} value={v[k]}
              onChange={(e) => upd(k, e.target.value)} className="mt-0.5 w-full border rounded p-1.5 bg-white text-sm text-gray-900" />
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1">{sqm > 0 ? `${sqm.toFixed(1)} m² · ${(sqm / 10000).toFixed(4)} ha` : '—'}</p>
    </div>
  );
}
