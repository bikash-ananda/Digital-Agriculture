export default function HealthRing({ health, lang }) {
  const score = health ? health.score : null;
  const r = 42;
  const c = 2 * Math.PI * r;
  const color = score === null ? '#94a3b8' : score >= 85 ? '#16a34a' : score >= 70 ? '#65a30d' : score >= 50 ? '#d97706' : '#dc2626';
  return (
    <div className="flex flex-col items-center">
      <svg width="110" height="110" viewBox="0 0 110 110" role="img" aria-label="Health score">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - (score || 0) / 100)} transform="rotate(-90 55 55)" />
        <text x="55" y="55" textAnchor="middle" dominantBaseline="central" fontSize="26" fontWeight="700" fill={color}>{score === null ? '—' : score}</text>
      </svg>
      <span className="text-xs font-medium" style={{ color }}>{health ? health.label[lang] : (lang === 'ne' ? 'डाटा छैन' : 'No data')}</span>
    </div>
  );
}
