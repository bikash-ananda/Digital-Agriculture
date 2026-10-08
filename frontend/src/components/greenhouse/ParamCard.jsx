import { STATUS, PARAM_ICON, fmt } from '../../utils/greenhouse';

export default function ParamCard({ p, lang, t }) {
  const st = STATUS[p.status] || STATUS.no_data;
  const label = lang === 'en' ? p.label_en : p.label_ne;
  const tg = p.target;
  let bar = null;
  if (tg && p.value !== null) {
    const span = tg.max - tg.min;
    const lo = tg.min - span * 0.15;
    const W = span * 1.3;
    const pc = (x) => ((x - lo) / W) * 100;
    const seg = (a, b, color) => <div style={{ position: 'absolute', top: 0, height: '100%', left: `${pc(a)}%`, width: `${pc(b) - pc(a)}%`, background: color }} />;
    const pos = Math.min(Math.max(pc(p.value), 1), 99);
    bar = (
      <div className="mt-3">
        <div className="relative" style={{ height: 10 }}>
          <div className="absolute inset-0 rounded-full overflow-hidden bg-red-200">
            {seg(tg.min, tg.opt_min, '#fde68a')}
            {seg(tg.opt_min, tg.opt_max, '#86efac')}
            {seg(tg.opt_max, tg.max, '#fde68a')}
          </div>
          <div className="absolute rounded bg-slate-800" style={{ left: `${pos}%`, top: -4, width: 5, height: 18, transform: 'translateX(-50%)' }} />
        </div>
        <p className="mt-1.5 text-xs text-gray-500">{t('उपयुक्त', 'Optimum')}: {tg.opt_min}–{tg.opt_max} {p.unit}</p>
      </div>
    );
  }
  const tr = p.trend_per_hour;
  return (
    <div className="bg-white rounded-lg shadow p-4 border-l-4" style={{ borderLeftColor: st.bar }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-600">{PARAM_ICON[p.key]} {label}</p>
        <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${st.cls}`}>{st[lang]}</span>
      </div>
      <p className="mt-1 text-3xl font-bold" style={{ color: st.bar }}>
        {fmt(p.value, p.key === 'ec' || p.key === 'vpd' || p.key === 'dli' ? 2 : 1)}<span className="text-base font-medium text-gray-500 ml-1">{p.unit}</span>
      </p>
      {tr !== null && Math.abs(tr) >= 0.05 && (
        <p className="text-xs text-gray-500">{tr > 0 ? '▲' : '▼'} {Math.abs(tr)} {p.unit}/{t('घण्टा', 'h')}</p>
      )}
      {p.stuck && <p className="text-xs text-red-600 mt-1">⚠ {t('सेन्सरको मान अड्किएको जस्तो छ', 'Sensor reading looks stuck')}</p>}
      {bar}
    </div>
  );
}
