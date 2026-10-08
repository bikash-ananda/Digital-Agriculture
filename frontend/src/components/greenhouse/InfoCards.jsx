import { fmt } from '../../utils/greenhouse';

export function DerivedChips({ d, t }) {
  const items = [
    ['VPD', d.vpd, 'kPa', 2], [t('शीत बिन्दु', 'Dew point'), d.dew_point, '°C', 1], ['DLI', d.dli, 'mol/m²', 1],
    [t('GDD (आज)', 'GDD today'), d.gdd_today, '°C·d', 1], [t('GDD (जम्मा)', 'GDD total'), d.gdd_accumulated, '°C·d', 0]
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([k, v, u, dec]) => (
        <div key={k} className="bg-white rounded-lg shadow px-3 py-2 text-center min-w-24">
          <p className="text-xs text-gray-500">{k}</p>
          <p className="font-semibold text-gov-blue">{fmt(v, dec)} <span className="text-xs font-normal text-gray-500">{u}</span></p>
        </div>
      ))}
    </div>
  );
}

const SEV = {
  critical: 'bg-red-50 border-red-300 text-red-800',
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-900',
  info: 'bg-blue-50 border-blue-300 text-blue-900'
};

export function Recommendations({ recs, risks, lang, t }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-gov-blue mb-3">💡 {t('सिफारिस तथा जोखिम', 'Recommendations & Risks')}</h3>
      {risks && risks.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {risks.map((r) => (
            <span key={r.code} className={`px-2 py-1 rounded text-xs font-medium ${r.level === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {lang === 'en' ? r.message_en : r.message_ne}
            </span>
          ))}
        </div>
      )}
      {(!recs || recs.length === 0) ? (
        <p className="text-sm text-green-700 bg-green-50 rounded p-3">✅ {t('सबै मापन लक्ष्य दायरा भित्र छन्', 'All measured parameters are within target')}</p>
      ) : (
        <ul className="space-y-2">
          {recs.map((r) => (
            <li key={r.code} className={`border rounded p-3 text-sm ${SEV[r.severity]}`}>{lang === 'en' ? r.message_en : r.message_ne}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-gray-400">{t('यी नियममा आधारित सूचक हुन्; निदान होइनन्। प्राविधिकसँग परामर्श गर्नुहोस्।', 'These are rule-based indicators, not diagnoses. Confirm with an agriculture technician.')}</p>
    </div>
  );
}

export function PlantDescription({ analysis, lang, t }) {
  const paragraphs = analysis.description ? analysis.description[lang] : [];
  const c = analysis.cycle;
  const s = analysis.stage;
  return (
    <div className="bg-white rounded-lg shadow p-4 border-t-4 border-agri-green">
      <h3 className="font-semibold text-gov-blue mb-1">🌿 {t('बिरुवाको स्वचालित विवरण', 'Automatic Plant Description')}</h3>
      {c && s && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>{lang === 'en' ? s.name_en : s.name_ne}{s.overridden ? ` (${t('म्यानुअल', 'manual')})` : ''}</span>
            <span>{t('दिन', 'Day')} {c.days_since} / {s.total_days}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-agri-green" style={{ width: `${s.progress_percent}%` }} /></div>
        </div>
      )}
      <div className="space-y-2 text-sm leading-relaxed text-gray-800">
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </div>
  );
}
