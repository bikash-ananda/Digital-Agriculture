import { useEffect, useState } from 'react';
import api from '../../services/api';
import { errMsgs } from '../../utils/errors';
import { CmdChip } from './DevicePanels';

export default function FirmwarePanel({ health, send, canUpload, cmds, lang, t }) {
  const h = health && health.latest;
  const [images, setImages] = useState([]);
  const [file, setFile] = useState(null);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [force, setForce] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/ops/admin/firmware').then((r) => setImages(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const lastOta = cmds.find((c) => c.type === 'ota');
  const active = lastOta && ['queued', 'sent', 'started'].includes(lastOta.status);

  const upload = async (e) => {
    e.preventDefault(); setMsg(null); setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('version', version); fd.append('notes', notes);
      const r = await api.post('/ops/admin/firmware', fd);
      setMsg({ ok: true, text: `${t('अपलोड भयो', 'Uploaded')}: v${r.data.version} · MD5 ${r.data.md5}` });
      setFile(null); setVersion(''); setNotes(''); e.target.reset(); load();
    } catch (err) { setMsg({ ok: false, text: errMsgs(err).join(' · ') }); } finally { setBusy(false); }
  };
  const install = async (img) => {
    if (!window.confirm(t(`संस्करण ${img.version} स्थापना गर्ने?\n\n• पम्प पहिले रोकिन्छ\n• नयाँ फर्मवेयरले सर्भरसँग सम्पर्क गरेपछि मात्र पुष्टि हुन्छ, नत्र १० मिनेटमा पुरानोमा फर्कन्छ\n• यन्त्र केही मिनेट अफलाइन हुन सक्छ`, `Install version ${img.version}?\n\n• Pumps are stopped first\n• The new firmware is only confirmed after it contacts the server, otherwise it rolls back after 10 minutes\n• The device may be offline for a few minutes`))) return;
    setMsg(null);
    try { await send('ota', { image_id: img.id, force }); setMsg({ ok: true, text: t('अद्यावधिक लाइनमा राखियो', 'Update queued') }); } catch (err) { setMsg({ ok: false, text: errMsgs(err).join(' · ') }); }
  };

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <h4 className="font-display font-bold text-terrace-900">⬆️ {t('फर्मवेयर', 'Firmware')}</h4>
      <dl className="grid sm:grid-cols-3 gap-3 text-sm">
        <div><dt className="text-gray-500">{t('हालको संस्करण', 'Running version')}</dt><dd className="font-semibold">{(h && h.firmware) || '—'}</dd></div>
        <div><dt className="text-gray-500">{t('अद्यावधिक अवस्था', 'Update state')}</dt><dd className={`font-semibold ${h && /^(failed|rolled_back)/.test(h.ota_state || '') ? 'text-gov-red' : ''}`}>{(h && h.ota_state) || '—'}</dd></div>
        <div><dt className="text-gray-500">{t('छवि पुष्टि', 'Image confirmed')}</dt><dd className="font-semibold">{h && h.image_validated !== null && h.image_validated !== undefined ? (h.image_validated ? t('हो', 'yes') : t('छैन', 'no')) : '—'}</dd></div>
      </dl>
      {lastOta && <p className="text-sm flex items-center gap-2">{t('पछिल्लो अद्यावधिक आदेश', 'Latest update command')}: v{lastOta.summary && lastOta.summary.version} <CmdChip c={lastOta} lang={lang} /></p>}
      {active && <p className="text-xs text-yellow-800 bg-yellow-50 rounded p-2">{t('अद्यावधिक चलिरहेको छ — यन्त्र पुनः सुरु हुँदा केही मिनेट अफलाइन देखिन सक्छ।', 'An update is in progress — the device may show offline for a few minutes while it restarts.')}</p>}

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left"><tr><th className="p-2">{t('संस्करण', 'Version')}</th><th className="p-2">{t('साइज', 'Size')}</th><th className="p-2">MD5</th><th className="p-2">{t('मिति', 'Date')}</th><th className="p-2" /></tr></thead>
          <tbody>
            {images.length === 0 && <tr><td colSpan="5" className="p-3 text-center text-gray-500">—</td></tr>}
            {images.map((i) => (
              <tr key={i.id} className="border-t"><td className="p-2 font-medium">{i.version}{h && h.firmware === i.version ? ` ✓` : ''}</td><td className="p-2">{Math.round(i.size_bytes / 1024)} kB</td><td className="p-2 font-mono text-xs">{i.md5}</td><td className="p-2 whitespace-nowrap">{new Date(i.uploaded_at).toLocaleDateString()}</td>
                <td className="p-2">{canUpload && <button disabled={active} onClick={() => install(i)} className="text-gov-blue underline disabled:opacity-40">{t('स्थापना', 'Install')}</button>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {canUpload && (
        <>
          <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> {t('पहिले रोलब्याक भएको संस्करण पनि पुनः प्रयास गर्ने (force)', 'Retry even a version that was rolled back before (force)')}</label>
          <form onSubmit={upload} className="grid sm:grid-cols-4 gap-3 text-sm items-end border-t pt-3">
            <label className="sm:col-span-2">{t('.bin फाइल (≤४ MB)', '.bin file (≤4 MB)')}<input required type="file" accept=".bin" onChange={(e) => setFile(e.target.files[0])} className="mt-1 block w-full text-sm" /></label>
            <label>{t('संस्करण', 'Version')}<input required placeholder="1.1.2" pattern="\d+\.\d+\.\d+.*" value={version} onChange={(e) => setVersion(e.target.value)} className="mt-1 w-full border rounded-md p-2" /></label>
            <label>{t('टिप्पणी', 'Notes')}<input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full border rounded-md p-2" /></label>
            <div className="sm:col-span-4"><button disabled={busy || !file} className="bg-agri-green text-white px-5 py-2 rounded-md font-semibold disabled:opacity-50">{busy ? '…' : t('अपलोड गर्नुहोस्', 'Upload')}</button></div>
          </form>
        </>
      )}
      {msg && <p className={`text-sm rounded p-2 ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      <p className="text-xs text-gray-500">{t('फर्मवेयरमा Wi-Fi पासवर्ड हुन सक्छ — फाइल कहिल्यै सार्वजनिक नगर्नुहोस्। सर्भरले MD5 आफैं गणना गर्छ।', 'Firmware can contain Wi-Fi passwords — never make the file public. The server computes the MD5 itself.')}</p>
    </div>
  );
}
