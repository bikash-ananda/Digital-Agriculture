import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

export default function FarmerList() {
  const { i18n } = useTranslation();
  const t = (ne, en) => (i18n.language === 'en' ? en : ne);
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/farmers', { params: { page, limit, search: query } })
      .then((r) => { setRows(r.data.data); setTotal(r.data.total); setError(''); })
      .catch((e) => setError(e.response?.data?.message || 'Failed to load farmers'))
      .finally(() => setLoading(false));
  }, [page, query]);

  const pages = Math.max(Math.ceil(total / limit), 1);
  const submit = (e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-2xl font-bold text-gov-blue">{t('कृषकहरू', 'Farmers')} <span className="text-base text-gray-500">({total})</span></h2>
        {can('farmers.create') && (
          <Link to="/app/farmers/new" className="bg-agri-green hover:bg-green-800 text-white px-4 py-2 rounded font-semibold text-sm">
            + {t('कृषक थप्नुहोस्', 'Add Farmer')}
          </Link>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 border rounded p-2 bg-white"
          placeholder={t('नाम, फोन वा कोड खोज्नुहोस्', 'Search by name, phone or code')} />
        <button className="bg-gov-blue text-white px-4 rounded text-sm">{t('खोज्नुहोस्', 'Search')}</button>
      </form>

      {error && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">{t('कोड', 'Code')}</th>
              <th className="p-3">{t('नाम', 'Name')}</th>
              <th className="p-3">{t('फोन', 'Phone')}</th>
              <th className="p-3">{t('स्थानीय तह', 'Local Level')}</th>
              <th className="p-3">{t('वडा', 'Ward')}</th>
              <th className="p-3">{t('फार्म', 'Farms')}</th>
              <th className="p-3">{t('स्थिति', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="7" className="p-4 text-center text-gray-500">...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan="7" className="p-4 text-center text-gray-500">{t('कुनै कृषक भेटिएन', 'No farmers found')}</td></tr>}
            {rows.map((f) => (
              <tr key={f.id} className="border-t hover:bg-gray-50">
                <td className="p-3 whitespace-nowrap">{f.farmer_code}</td>
                <td className="p-3"><Link className="text-gov-blue hover:underline font-medium" to={`/app/farmers/${f.id}`}>{f.full_name_ne || f.full_name_en}</Link></td>
                <td className="p-3">{f.phone || '-'}</td>
                <td className="p-3">{(i18n.language === 'en' ? f.local_level_en : f.local_level_ne) || '-'}</td>
                <td className="p-3">{f.ward_no || '-'}</td>
                <td className="p-3">{f.farm_count}</td>
                <td className="p-3">{f.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50">←</button>
        <span>{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded bg-white disabled:opacity-50">→</button>
      </div>
    </div>
  );
}
