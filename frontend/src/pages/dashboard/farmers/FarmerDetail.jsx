import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const emptyFarm = { name: '', area_sqm: '', ownership_type: 'owned', irrigation_type: 'none', address: '' };

export default function FarmerDetail() {
  const { i18n } = useTranslation();
  const t = (ne, en) => (i18n.language === 'en' ? en : ne);
  const { id } = useParams();
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showFarm, setShowFarm] = useState(false);
  const [farm, setFarm] = useState(emptyFarm);
  const [farmErrors, setFarmErrors] = useState([]);

  const load = () => api.get(`/farmers/${id}`).then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.message || 'Failed to load'));
  useEffect(() => { load(); }, [id]);

  const addFarm = async (e) => {
    e.preventDefault();
    setFarmErrors([]);
    try {
      await api.post(`/farmers/${id}/farms`, farm);
      setFarm(emptyFarm); setShowFarm(false); load();
    } catch (err) {
      const d = err.response?.data;
      setFarmErrors(d?.errors?.map((x) => `${x.field}: ${x.message}`) || [d?.message || 'Request failed']);
    }
  };

  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>;
  if (!data) return <p className="text-gray-500">...</p>;
  const f = data.farmer;
  const rows = [
    [t('कोड', 'Code'), f.farmer_code], [t('नाम (अंग्रेजी)', 'Name (English)'), f.full_name_en], [t('नाम (नेपाली)', 'Name (Nepali)'), f.full_name_ne || '-'],
    [t('लिङ्ग', 'Gender'), f.gender || '-'], [t('फोन', 'Phone'), f.phone || '-'], [t('इमेल', 'Email'), f.email || '-'],
    [t('स्थानीय तह', 'Local Level'), (i18n.language === 'en' ? f.local_level_en : f.local_level_ne) || '-'], [t('वडा', 'Ward'), f.ward_no || '-'],
    [t('ठेगाना', 'Address'), f.address || '-'], [t('समूह', 'Group'), f.group_name || '-'], [t('स्थिति', 'Status'), f.status]
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gov-blue">{f.full_name_ne || f.full_name_en}</h2>
        <div className="flex gap-2">
          <Link to="/app/farmers" className="px-4 py-2 border rounded text-sm">← {t('सूची', 'List')}</Link>
          {can('farmers.update') && <Link to={`/app/farmers/${f.id}/edit`} className="bg-gov-blue text-white px-4 py-2 rounded text-sm">{t('सम्पादन', 'Edit')}</Link>}
        </div>
      </div>

      <div className="bg-white rounded shadow divide-y">
        {rows.map(([k, v]) => <div key={k} className="flex p-3 text-sm"><span className="w-44 font-medium text-gray-500">{k}</span><span>{v}</span></div>)}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gov-blue">{t('फार्महरू', 'Farms')} ({data.farms.length})</h3>
          {can('farms.create') && <button onClick={() => setShowFarm(!showFarm)} className="bg-agri-green text-white px-3 py-1.5 rounded text-sm">+ {t('फार्म थप्नुहोस्', 'Add Farm')}</button>}
        </div>

        {showFarm && (
          <form onSubmit={addFarm} className="bg-white rounded shadow p-4 mb-3 grid sm:grid-cols-2 gap-3">
            {farmErrors.length > 0 && <ul className="sm:col-span-2 p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{farmErrors.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            <label className="block text-sm">{t('फार्मको नाम', 'Farm Name')} *
              <input required value={farm.name} onChange={(e) => setFarm({ ...farm, name: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
            <label className="block text-sm">{t('क्षेत्रफल (वर्ग मि.)', 'Area (sq m)')}
              <input type="number" step="0.01" value={farm.area_sqm} onChange={(e) => setFarm({ ...farm, area_sqm: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
            <label className="block text-sm">{t('स्वामित्व', 'Ownership')}
              <select value={farm.ownership_type} onChange={(e) => setFarm({ ...farm, ownership_type: e.target.value })} className="mt-1 w-full border rounded p-2 bg-white">
                {['owned', 'leased', 'shared', 'government'].map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
            <label className="block text-sm">{t('सिँचाइ', 'Irrigation')}
              <select value={farm.irrigation_type} onChange={(e) => setFarm({ ...farm, irrigation_type: e.target.value })} className="mt-1 w-full border rounded p-2 bg-white">
                {['none', 'rainfed', 'drip', 'sprinkler', 'canal', 'other'].map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
            <label className="block text-sm sm:col-span-2">{t('ठेगाना', 'Address')}
              <input value={farm.address} onChange={(e) => setFarm({ ...farm, address: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
            <div className="sm:col-span-2"><button className="bg-agri-green text-white px-4 py-2 rounded text-sm">{t('सुरक्षित गर्नुहोस्', 'Save Farm')}</button></div>
          </form>
        )}

        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr>
              <th className="p-3">{t('नाम', 'Name')}</th><th className="p-3">{t('क्षेत्रफल', 'Area')}</th><th className="p-3">{t('स्वामित्व', 'Ownership')}</th>
              <th className="p-3">{t('सिँचाइ', 'Irrigation')}</th><th className="p-3">{t('ग्रीनहाउस/टनेल', 'Units')}</th></tr></thead>
            <tbody>
              {data.farms.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-gray-500">{t('फार्म दर्ता गरिएको छैन', 'No farms registered')}</td></tr>}
              {data.farms.map((fm) => (
                <tr key={fm.id} className="border-t"><td className="p-3 font-medium">{fm.name}</td><td className="p-3">{fm.area_sqm ?? '-'}</td>
                  <td className="p-3">{fm.ownership_type}</td><td className="p-3">{fm.irrigation_type}</td><td className="p-3">{fm.unit_count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
