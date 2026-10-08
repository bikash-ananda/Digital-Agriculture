import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import Kpi from '../../components/dc/Kpi';
import { lbl } from '../../utils/enumLabels';
import { formatLand, nf } from '../../utils/dc';

const COLORS = ['#15803d', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];

function Bars({ title, data }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-gov-blue mb-2">{title}</h3>
      {data.length === 0 ? <p className="text-sm text-gray-500 py-8 text-center">—</p> : (
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="n" radius={[0, 4, 4, 0]}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function Overview({ ov, lang, t }) {
  if (!ov) return <p className="text-gray-500">…</p>;
  const f = ov.farmers;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const cat = ov.by_category.map((x) => ({ name: lbl(x.k, lang), n: Number(x.n) }));
  const typ = ov.by_type.map((x) => ({ name: lbl(x.k, lang), n: Number(x.n) }));
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi icon="👨‍🌾" label={t('सक्रिय कृषक', 'Active farmers')} value={nf(f.active)} sub={`${nf(f.total)} ${t('कुल', 'total')} · ${f.female} ${t('महिला', 'female')} / ${f.male} ${t('पुरुष', 'male')}`} />
        <Kpi icon="✅" label={t('प्रमाणित कृषक', 'Verified farmers')} value={`${pct(f.verified, f.total)}%`} sub={`${f.verified} / ${f.total}`} />
        <Kpi icon="🌾" label={t('फार्म तथा जमिन', 'Farms & land')} value={nf(ov.farms.count)} sub={formatLand(ov.farms.area_sqm, lang)} />
        <Kpi icon="🥕" label={`${t('उत्पादन', 'Production')} (${ov.fiscal_year})`} value={`${nf(ov.production.kg / 1000, 2)} t`} sub={`${ov.production.records} ${t('अभिलेख', 'records')} · ${ov.production.crops} ${t('बाली', 'crops')}`} />
        <Kpi icon="📟" label={t('कृषकका फार्ममा यन्त्र', 'Devices on farmer farms')} value={nf(ov.devices.at_farms)} sub={`${ov.devices.online} ${t('अनलाइन', 'online')} · ${ov.devices.farms_covered} ${t('फार्म समेटिएका', 'farms covered')}`} />
        <Kpi icon="🧮" label={t('औसत तथ्याङ्क पूर्णता', 'Avg data completeness')} value={`${f.completeness}%`} />
        <Kpi icon="🔬" label={t('अनुसन्धान सहमति', 'Research consent')} value={`${pct(f.consent_research, f.total)}%`} sub={`${f.consent_research} / ${f.total}`} />
        <Kpi icon="📍" label={t('GPS भएका फार्म', 'Farms with GPS')} value={`${pct(ov.farms.with_gps, ov.farms.count)}%`} sub={`${ov.farms.with_gps} / ${ov.farms.count}`} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Bars title={t('कृषक वर्ग अनुसार', 'Farmers by category')} data={cat} />
        <Bars title={t('कृषकको प्रकार अनुसार', 'Farmers by type')} data={typ} />
      </div>
      <p className="text-xs text-gray-500">{t('तथ्याङ्क आन्तरिक प्रयोगका लागि हो र तपाईंको कार्यालयको दायरा भित्र सीमित छ।', 'These figures are for internal use and are limited to your office’s scope.')}</p>
    </div>
  );
}
