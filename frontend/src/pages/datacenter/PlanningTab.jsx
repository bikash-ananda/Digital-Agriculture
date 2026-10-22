import { useEffect, useState } from 'react';
import api from '../../services/api';
import { formatLand, nf } from '../../utils/dc';

const BASELINE_LABELS = {
  population_total: ['जनसंख्या', 'Population'],
  population_female: ['महिला जनसंख्या', 'Female population'],
  population_male: ['पुरुष जनसंख्या', 'Male population'],
  households_total: ['घरपरिवार', 'Households'],
  population_density: ['जनघनत्व', 'Population density'],
  population_growth_pct: ['वार्षिक जनसंख्या वृद्धि', 'Annual population growth'],
  agricultural_holdings_total: ['कृषि चलन', 'Agricultural holdings']
};

const FEEDBACK_LABELS = {
  no_farmer_records: ['दर्ता अवस्था जाँच', 'Check registration status'],
  improve_farm_location_data: ['फार्म स्थान अभिलेख सुधार', 'Improve farm location records'],
  complete_environment_profile: ['वातावरणीय विवरण पूरा', 'Complete environmental profiles'],
  collect_production_records: ['उत्पादन तथ्याङ्क सङ्कलन', 'Collect production data'],
  review_reported_crop_losses: ['उल्लेखित बाली क्षति समीक्षा', 'Review reported crop losses'],
  review_data_use_consent: ['तथ्याङ्क प्रयोग सहमति जाँच', 'Review data-use consent']
};

function Kpi({ title, value, detail }) {
  return <div className="bg-white rounded-lg shadow p-4 border-l-4 border-agri-green">
    <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
    <p className="text-2xl font-bold text-gov-blue mt-1">{value}</p>
    {detail && <p className="text-xs text-gray-500 mt-1">{detail}</p>}
  </div>;
}

export default function PlanningTab({ fy, lang, t, canCollect }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [feedback, setFeedback] = useState({});
  const [feedbackError, setFeedbackError] = useState('');
  const en = lang === 'en';

  useEffect(() => {
    setData(null);
    api.get('/datacenter/planning', { params: { fy } })
      .then((r) => { setData(r.data); setError(''); })
      .catch((e) => setError(e.response?.data?.message || t('योजना विश्लेषण लोड भएन', 'Could not load planning analysis')));
  }, [fy, t]);

  const sendFeedback = async (item, choice) => {
    const key = item.code + ':' + (item.local_level_id || 'district');
    setSaving(key); setFeedbackError('');
    try {
      await api.post('/datacenter/planning/feedback', {
        recommendation_code: item.code, local_level_id: item.local_level_id || undefined, feedback: choice
      });
      setFeedback((prev) => ({ ...prev, [key]: choice }));
    } catch (e) { setFeedbackError(e.response?.data?.message || t('प्रतिक्रिया सुरक्षित भएन', 'Could not save feedback')); }
    finally { setSaving(''); }
  };

  if (error) return <div role="alert" className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>;
  if (!data) return <p className="text-gray-500">…</p>;

  const s = data.summary;
  const recommendationText = (item, field) => en ? item[field + '_en'] : item[field + '_ne'];
  const unitText = (row) => {
    const units = {
      people: en ? 'people' : 'जना', households: en ? 'households' : 'घरपरिवार',
      people_per_sq_km: en ? 'people / sq km' : 'जना / वर्ग कि.मि.',
      percent_per_year: en ? '% per year' : '% प्रति वर्ष', holdings: en ? 'holdings' : 'कृषि चलन'
    };
    return units[row.unit] || row.unit;
  };

  return (
    <div className="space-y-5">
      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi title={t('ऐतिहासिक जनसंख्या आधार', 'Historical population baseline')} value={s.population_2021 === null ? '—' : nf(s.population_2021)} detail={t('राष्ट्रिय जनगणना २०२१', 'National census 2021')} />
        <Kpi title={t('कृषि चलन आधार', 'Agriculture holdings baseline')} value={s.agriculture_holdings_2021_22 === null ? '—' : nf(s.agriculture_holdings_2021_22)} detail={t('कृषि गणना २०२१/२२', 'Agriculture census 2021/22')} />
        <Kpi title={t('सक्रिय कृषक अभिलेख', 'Active farmer records')} value={nf(s.active_farmers)} detail={t('वर्तमान प्रणालीमा', 'In the current system')} />
        <Kpi title={t('GPS सहितका फार्म', 'Farms with GPS')} value={s.geo_pct + '%'} detail={nf(s.geocoded_farms) + ' / ' + nf(s.farms)} />
      </section>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-950">
        <p className="font-semibold">{t('यस विश्लेषणले के देखाउँछ', 'How to read these planning signals')}</p>
        <p className="mt-1">{t(
          'जनगणना र कृषि गणनाका आधार वर्षसहितका जिल्ला तथ्याङ्कलाई हालको प्रणालीका अभिलेखबाट अलग राखिएको छ। दर्ता संख्या ÷ ऐतिहासिक कृषि चलन अनुपात प्रतिनिधित्व वा कृषक समेटिएको प्रतिशत होइन। पालिका पङ्क्तिहरू प्रणालीमा भेटिएका अभिलेख मात्र हुन्।',
          'Official district baselines are shown separately from current system records. Registered farmers divided by historical holdings is a scale comparison, not a coverage or representation rate. Local-level rows count records currently in this system.'
        )}</p>
      </div>

      <section className="bg-white rounded-lg shadow overflow-x-auto">
        <div className="p-4 pb-2">
          <h3 className="font-semibold text-gov-blue">{t('कास्कीका स्थानीय तह अनुसार प्रणाली अभिलेख', 'System records by Kaski local level')}</h3>
          <p className="text-xs text-gray-500 mt-1">{t('किसान अभिलेख कृषकको बसोबास भएको स्थानीय तहअनुसार; फार्म अभिलेख फार्मको स्थानअनुसार देखाइन्छ। वातावरणीय प्रतिशत भनेको माटो, पानी, सिँचित क्षेत्र, उचाइ, सिँढीखेत वा सडक पहुँचमध्ये कम्तीमा एउटा विवरण भएको फार्म हो।', 'Farmer counts use residence; farm and production data use the farm location. Environment data means a farm has at least one recorded soil, water, irrigated area, elevation, terrace, road-access, or market-distance field.')}</p>
        </div>
        <table className="w-full text-sm min-w-[880px]">
          <thead className="bg-gray-100 text-left"><tr>
            {[t('स्थानीय तह', 'Local level'), t('वडा', 'Wards'), t('कृषक', 'Farmers'), t('फार्म', 'Farms'), t('GPS', 'GPS'), t('माटो/पानी/उचाइ/पहुँच', 'Environment data'), t('उत्पादन अभिलेख', 'Production records'), t('उल्लेखित क्षति (के.जी.)', 'Reported loss (kg)'), t('पशुपालन अभिलेख', 'Livestock records')].map((h) => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>{data.local_levels.map((level) => (
            <tr key={level.id} className="border-t">
              <td className="p-3 font-medium">{en ? level.name_en : level.name_ne}</td>
              <td className="p-3">{level.total_wards || '—'}</td>
              <td className="p-3">{nf(level.active_farmers)}{level.avg_completeness ? <span className="block text-xs text-gray-500">{t('पूर्णता', 'completeness')} {level.avg_completeness}%</span> : null}</td>
              <td className="p-3">{nf(level.farms)}{level.area_sqm ? <span className="block text-xs text-gray-500">{formatLand(level.area_sqm, lang)}</span> : null}</td>
              <td className="p-3">{level.geo_pct}%</td>
              <td className="p-3">{level.environment_profile_pct}%</td>
              <td className="p-3">{nf(level.production_records)}<span className="block text-xs text-gray-500">{nf(level.crop_types)} {t('बाली', 'crops')}</span></td>
              <td className="p-3">{nf(level.loss_kg)}{level.loss_causes && <span className="block text-xs text-gray-500">{level.loss_causes.split(', ').map((x) => x.replaceAll('_', ' ')).join(', ')}</span>}</td>
              <td className="p-3">{nf(level.livestock_records)}<span className="block text-xs text-gray-500">{nf(level.animals)} {t('पशुपन्छी', 'animals')}</span></td>
            </tr>
          ))}</tbody>
        </table>
        <p className="px-4 pb-4 text-xs text-gray-500">{t('कम अभिलेख संख्या कृषक कम भएको प्रमाण होइन; सर्वेक्षणको पहुँच र अभिलेख पूर्णता जाँच्नुपर्ने सङ्केत मात्र हो।', 'A low record count does not prove that an area has fewer farmers; it is a signal to check survey reach and record completeness.')}</p>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold text-gov-blue">{t('समीक्षा गर्नुपर्ने योजना सङ्केत', 'Planning signals for review')}</h3>
          <p className="text-xs text-gray-500 mt-1">{t('यी नियममा आधारित संकेत हुन्, स्वचालित निर्णय होइनन्। क्षति वा जोखिम भनेर देखाइएको कुरा कृषकले दिएको अभिलेख हो; पूर्वानुमान होइन।', 'These are rule-based prompts, not automated decisions. Reported losses come from farmer records; they are not forecasts.')}</p>
        </div>
        {feedbackError && <p role="alert" className="p-2 bg-red-50 text-red-700 rounded text-sm">{feedbackError}</p>}
        {data.recommendations.length === 0 && <p className="p-4 bg-white rounded shadow text-sm text-gray-600">{t('हाल समीक्षा सङ्केत बनाउन पर्याप्त अभिलेख वा देखिएका तथ्याङ्कीय खाली ठाउँ छैन।', 'There are no current signals to review. More records may be needed.')}</p>}
        {data.recommendations.map((item, i) => {
          const key = item.code + ':' + (item.local_level_id || 'district');
          const label = FEEDBACK_LABELS[item.code];
          const response = feedback[key];
          return <article key={key + ':' + i} className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-[220px] flex-1">
                <p className="text-xs uppercase tracking-wide text-gray-500">{label ? (en ? label[1] : label[0]) : ''}{item.local_level_en ? ' · ' + (en ? item.local_level_en : item.local_level_ne) : ''}</p>
                <p className="font-semibold text-gov-blue mt-1">{recommendationText(item, 'message')}</p>
                <p className="text-sm text-gray-700 mt-1">{recommendationText(item, 'action')}</p>
                <p className="text-xs text-gray-500 mt-2">{t('प्रमाण', 'Evidence')}: {JSON.stringify(item.evidence)}</p>
              </div>
              {canCollect && <div className="flex flex-wrap gap-2 items-center">
                <button disabled={!!saving || !!response} onClick={() => sendFeedback(item, 'useful')} className="px-3 py-2 border rounded text-sm disabled:opacity-60">👍 {t('उपयोगी', 'Useful')}</button>
                <button disabled={!!saving || !!response} onClick={() => sendFeedback(item, 'not_useful')} className="px-3 py-2 border rounded text-sm disabled:opacity-60">👎 {t('उपयोगी छैन', 'Not useful')}</button>
                <button disabled={!!saving || !!response} onClick={() => sendFeedback(item, 'needs_review')} className="px-3 py-2 border rounded text-sm disabled:opacity-60">{t('समीक्षा चाहिन्छ', 'Needs review')}</button>
                {response && <span role="status" className="text-xs text-green-700">✓ {t('प्रतिक्रिया सुरक्षित भयो', 'Feedback saved')}</span>}
              </div>}
            </div>
          </article>;
        })}
        {canCollect && <p className="text-xs text-gray-500">{t('प्रतिक्रिया समीक्षा अभिलेखका लागि मात्र सुरक्षित हुन्छ; यसले स्वचालित रूपमा AI मोडेल तालिम गर्दैन।', 'Feedback is saved for human review; it does not automatically train an AI model.')}</p>}
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gov-blue">{t('आधिकारिक जनसांख्यिक तथा कृषि आधार', 'Official population and agriculture baselines')}</h3>
        <div className="divide-y mt-2">{data.baseline.map((row) => {
          const label = BASELINE_LABELS[row.indicator_code] || [row.indicator_code, row.indicator_code];
          return <div key={row.indicator_code + row.period} className="py-2 flex flex-wrap items-start justify-between gap-2 text-sm">
            <div><span className="font-medium">{en ? label[1] : label[0]}</span><span className="text-gray-500"> · {row.period}</span>
              <p className="text-xs text-gray-500">{row.note}</p>
            </div>
            <span className="font-semibold">{nf(row.value)} {unitText(row)}</span>
            <a className="text-gov-blue underline text-xs" href={row.source_url} target="_blank" rel="noreferrer">{row.source_title}</a>
          </div>;
        })}</div>
      </section>
    </div>
  );
}
