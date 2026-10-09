import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import api from '../../services/api';
import { uuid } from '../../utils/surveyStore';

const HEADERS = ['full_name_en', 'full_name_ne', 'gender', 'date_of_birth', 'phone', 'email', 'local_level', 'ward_no', 'address', 'group_name', 'farmer_type', 'farmer_category',
  'national_farmer_id', 'household_members', 'main_occupation', 'farm_name', 'farm_area_ropani', 'farm_area_aana', 'farm_area_paisa', 'farm_area_dam', 'farm_area_sqm',
  'ownership_type', 'irrigation_type', 'latitude', 'longitude'];
const MAX_ROWS = 5000;
const STATUS_CLS = { ok: 'bg-green-100 text-green-800', duplicate: 'bg-yellow-100 text-yellow-900', error: 'bg-red-100 text-red-800' };

const saveBlob = (blob, name) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); };

export default function ImportTab({ lang, t }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [unknown, setUnknown] = useState([]);
  const [stage, setStage] = useState('idle');
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const [history, setHistory] = useState([]);

  const loadHistory = () => api.get('/datacenter/imports').then((r) => setHistory(r.data)).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  const reset = () => { setRows([]); setUnknown([]); setResults(null); setDone(null); setErr(''); setStage('idle'); setProgress(''); };

  const template = async () => {
    try { const r = await api.get('/datacenter/import/template', { responseType: 'blob' }); saveBlob(r.data, 'farmers_import_template.csv'); }
    catch (e) { setErr(e.response?.status === 403 ? t('अनुमति छैन', 'No permission') : 'Download failed'); }
  };

  const onFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    reset(); setFile(f);
    Papa.parse(f, {
      header: true, skipEmptyLines: 'greedy',
      transformHeader: (h) => h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (res) => {
        const fields = res.meta.fields || [];
        if (!fields.includes('full_name_en') && !fields.includes('full_name_ne')) { setErr(t('फाइलमा full_name_en वा full_name_ne स्तम्भ हुनुपर्छ। टेम्प्लेट प्रयोग गर्नुहोस्।', 'The file needs a full_name_en or full_name_ne column. Please use the template.')); return; }
        if (res.data.length === 0) { setErr(t('फाइलमा कुनै पङ्क्ति छैन', 'The file has no data rows')); return; }
        if (res.data.length > MAX_ROWS) { setErr(t(`एकपटकमा ${MAX_ROWS} पङ्क्ति सम्म मात्र आयात गर्न मिल्छ। फाइल विभाजन गर्नुहोस्।`, `At most ${MAX_ROWS} rows can be imported at once. Please split the file.`)); return; }
        setUnknown(fields.filter((x) => !HEADERS.includes(x)));
        setRows(res.data.map((r, i) => ({ ...r, n: i + 2 })));
        setStage('parsed');
      },
      error: () => setErr(t('फाइल पढ्न सकिएन', 'Could not read the file'))
    });
  };

  const check = async () => {
    setStage('checking'); setErr('');
    try {
      const out = [];
      const size = 400;
      for (let i = 0; i < rows.length; i += size) {
        setProgress(`${Math.min(i + size, rows.length)} / ${rows.length}`);
        const r = await api.post('/datacenter/import/preview', { rows: rows.slice(i, i + size) });
        out.push(...r.data.rows);
      }
      setResults(out); setStage('checked');
    } catch (e) { setErr(e.response?.data?.message || 'Check failed'); setStage('parsed'); }
  };

  const importValid = async () => {
    const okRows = new Set(results.filter((r) => r.status === 'ok').map((r) => r.n));
    const send = rows.filter((r) => okRows.has(r.n));
    if (!window.confirm(t(`${send.length} कृषक आयात गर्ने? आयात गरिएका अभिलेख "मस्यौदा" हुन्छन् र सहमति दर्ता गरिएको हुँदैन।`, `Import ${send.length} farmers? Imported records start as “draft” with no consent recorded.`))) return;
    setStage('importing'); setErr('');
    const batch = uuid();
    const tally = { imported: 0, duplicates: 0, errors: 0, results: [] };
    try {
      const size = 200;
      for (let i = 0; i < send.length; i += size) {
        setProgress(`${Math.min(i + size, send.length)} / ${send.length}`);
        const r = await api.post('/datacenter/import/commit', { batch, filename: file.name, rows: send.slice(i, i + size) });
        tally.imported += r.data.imported; tally.duplicates += r.data.duplicates; tally.errors += r.data.errors; tally.results.push(...r.data.results);
      }
      setDone({ ...tally, batch }); setStage('done'); loadHistory();
    } catch (e) {
      setErr(`${e.response?.data?.message || 'Import failed'} — ${t('कतिपय पङ्क्ति आयात भइसकेको हुन सक्छ; इतिहासमा जाँच गर्नुहोस्।', 'some rows may already be imported; check the history below.')}`);
      setDone({ ...tally, batch }); setStage('done'); loadHistory();
    }
  };

  const problemCsv = () => {
    const byN = Object.fromEntries(rows.map((r) => [r.n, r]));
    const list = (results || []).filter((r) => r.status !== 'ok').map((r) => ({ row_number: r.n, status: r.status, problems: r.errors.join(' | '), ...byN[r.n] }));
    saveBlob(new Blob(['\uFEFF' + Papa.unparse(list)], { type: 'text/csv;charset=utf-8' }), 'import_problem_rows.csv');
  };

  const undo = async (h) => {
    if (!window.confirm(t('यो आयात फिर्ता गर्ने? आयात गरिएका कृषक र फार्म मेटिनेछन्।', 'Undo this import? The imported farmers and farms will be deleted.'))) return;
    try { const r = await api.post(`/datacenter/imports/${h.batch_uuid}/undo`); setErr(''); alert(`${r.data.removed} ${t('कृषक हटाइए', 'farmers removed')}`); loadHistory(); }
    catch (e) { setErr(e.response?.data?.message || 'Undo failed'); }
  };

  const sum = results ? { ok: results.filter((r) => r.status === 'ok').length, dup: results.filter((r) => r.status === 'duplicate').length, err: results.filter((r) => r.status === 'error').length, warn: results.filter((r) => r.warnings.length).length } : null;
  const shown = results ? results.filter((r) => r.status !== 'ok' || r.warnings.length).slice(0, 200) : [];

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded p-4 text-sm space-y-1">
        <p className="font-semibold">{t('सुरु गर्नुअघि', 'Before you start')}</p>
        <ul className="list-disc pl-5">
          <li>{t('टेम्प्लेट डाउनलोड गरी उदाहरणका दुई पङ्क्ति मेटेर आफ्नो तथ्याङ्क राख्नुहोस्। Excel मा “CSV UTF-8” का रूपमा सुरक्षित गर्नुहोस् (नत्र नेपाली अक्षर बिग्रन्छ)।', 'Download the template, delete the two example rows and add your data. In Excel, save as “CSV UTF-8”, or Nepali text will be corrupted.')}</li>
          <li>{t('मितिहरू ई.सं. (AD) मा YYYY-MM-DD ढाँचामा राख्नुहोस्, वि.सं. होइन।', 'Dates must be AD in YYYY-MM-DD format, not BS.')}</li>
          <li>{t('जमिन रोपनी / आना / पैसा / दाम स्तम्भमा वा वर्ग मिटर (farm_area_sqm) मा दिन सकिन्छ।', 'Land can be entered in the ropani / aana / paisa / dam columns, or in square metres (farm_area_sqm).')}</li>
          <li>{t('आयात गरिएका कृषक “मस्यौदा” हुन्छन् — सहमति दर्ता र प्रमाणीकरण अझै गर्नुपर्छ।', 'Imported farmers start as “draft”. Consent still has to be recorded and the record verified.')}</li>
        </ul>
        <button onClick={template} className="mt-2 bg-white border border-blue-300 px-3 py-1.5 rounded text-sm font-semibold">⬇ {t('टेम्प्लेट डाउनलोड', 'Download template')}</button>
      </div>

      {err && <div role="alert" className="p-3 bg-red-50 text-red-700 rounded text-sm">{err}</div>}

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <label className="block text-sm font-medium">{t('CSV फाइल छान्नुहोस्', 'Choose a CSV file')}
          <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={stage === 'checking' || stage === 'importing'} className="mt-1 block w-full text-sm" /></label>
        {rows.length > 0 && <p className="text-sm text-gray-700">{file.name} · {rows.length} {t('पङ्क्ति', 'rows')}</p>}
        {unknown.length > 0 && <p className="text-sm text-yellow-900 bg-yellow-50 rounded p-2">⚠ {t('यी स्तम्भ बेवास्ता गरिनेछन्', 'These columns will be ignored')}: {unknown.join(', ')}</p>}
        <div className="flex flex-wrap gap-3">
          {stage === 'parsed' && <button onClick={check} className="bg-gov-blue text-white px-4 py-2 rounded text-sm font-semibold">{t('फाइल जाँच गर्नुहोस् (आयात हुँदैन)', 'Check the file (nothing is imported yet)')}</button>}
          {stage === 'checked' && sum.ok > 0 && <button onClick={importValid} className="bg-agri-green hover:bg-green-800 text-white px-4 py-2 rounded text-sm font-semibold">{t(`${sum.ok} मान्य पङ्क्ति आयात गर्नुहोस्`, `Import ${sum.ok} valid rows`)}</button>}
          {stage === 'checked' && sum.dup + sum.err > 0 && <button onClick={problemCsv} className="border px-4 py-2 rounded text-sm">⬇ {t('समस्या भएका पङ्क्ति (CSV)', 'Problem rows (CSV)')}</button>}
          {stage !== 'idle' && stage !== 'checking' && stage !== 'importing' && <button onClick={reset} className="px-4 py-2 text-sm underline">{t('रद्द गर्नुहोस्', 'Start over')}</button>}
        </div>
        {(stage === 'checking' || stage === 'importing') && <p className="text-sm text-gray-700">{stage === 'checking' ? t('जाँच गर्दै', 'Checking') : t('आयात गर्दै', 'Importing')}… {progress}</p>}
      </div>

      {sum && stage === 'checked' && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-4 gap-3">
            {[[t('मान्य', 'Ready'), sum.ok, 'text-agri-green'], [t('दोहोरो', 'Duplicates'), sum.dup, 'text-yellow-700'], [t('त्रुटि', 'Errors'), sum.err, 'text-gov-red'], [t('सावधानी सहित', 'With warnings'), sum.warn, 'text-gray-700']].map(([k, v, c]) => (
              <div key={k} className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-600">{k}</p><p className={`text-3xl font-bold font-display ${c}`}>{v}</p></div>
            ))}
          </div>
          {shown.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('पङ्क्ति', 'Row')}</th><th className="p-3">{t('नाम', 'Name')}</th><th className="p-3">{t('अवस्था', 'Status')}</th><th className="p-3">{t('विवरण', 'Details')}</th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.n} className="border-t align-top">
                      <td className="p-3">{r.n}</td><td className="p-3">{r.name || '—'}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[r.status]}`}>{r.status}</span></td>
                      <td className="p-3 text-xs">{r.errors.map((m, i) => <p key={i} className="text-red-700">{m}</p>)}{r.warnings.map((m, i) => <p key={i} className="text-yellow-800">⚠ {m}</p>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {results.filter((r) => r.status !== 'ok' || r.warnings.length).length > 200 && <p className="p-3 text-xs text-gray-500">{t('पहिलो २०० मात्र देखाइएको। पूरा सूची CSV मा डाउनलोड गर्नुहोस्।', 'Showing the first 200. Download the CSV for the full list.')}</p>}
            </div>
          )}
          <p className="text-xs text-gray-500">{t('४०० पङ्क्तिका भाग बीचका दोहोरो आयात गर्दा पत्ता लाग्छन्।', 'Duplicates between different 400-row blocks of one file are caught during the import itself.')}</p>
        </div>
      )}

      {done && (
        <div className="p-4 bg-green-50 border border-green-200 rounded space-y-2">
          <p className="font-semibold text-green-900">✓ {done.imported} {t('कृषक आयात भए', 'farmers imported')} · {done.duplicates} {t('दोहोरो', 'duplicates')} · {done.errors} {t('त्रुटि', 'errors')}</p>
          <Link to="/app/farmers" className="text-sm text-gov-blue underline">{t('कृषक सूची खोल्नुहोस्', 'Open the farmers list')}</Link>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <h3 className="font-semibold text-gov-blue p-4 pb-2">{t('आयात इतिहास', 'Import history')}</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('मिति', 'Date')}</th><th className="p-3">{t('फाइल', 'File')}</th><th className="p-3">{t('प्रयोगकर्ता', 'User')}</th><th className="p-3">{t('आयात', 'Imported')}</th><th className="p-3">{t('दोहोरो / त्रुटि', 'Dup / err')}</th><th className="p-3" /></tr></thead>
          <tbody>
            {history.length === 0 && <tr><td colSpan="6" className="p-4 text-center text-gray-500">—</td></tr>}
            {history.map((h) => (
              <tr key={h.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{new Date(h.created_at).toLocaleString()}</td><td className="p-3">{h.filename || '—'}</td><td className="p-3">{h.username}</td>
                <td className="p-3">{h.rows_imported}</td><td className="p-3">{h.rows_duplicate} / {h.rows_error}</td>
                <td className="p-3">{h.undone_at ? <span className="text-xs text-gray-500">{t('फिर्ता गरियो', 'Undone')}</span> : h.rows_imported > 0 && <button onClick={() => undo(h)} className="text-gov-red text-xs underline">{t('फिर्ता गर्नुहोस्', 'Undo')}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
