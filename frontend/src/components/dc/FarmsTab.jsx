import { useState } from 'react';
import api from '../../services/api';
import DynamicForm from './DynamicForm';
import { FARM_ADD_FIELDS, FARM_EDIT_FIELDS } from '../../utils/dcFields';
import { lbl } from '../../utils/enumLabels';
import { formatLand } from '../../utils/dc';

export default function FarmsTab({ farmerId, farms, lookups, canEdit, lang, t, reload }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      {canEdit && <button onClick={() => setAdding(!adding)} className="bg-agri-green text-white px-4 py-2 rounded text-sm font-semibold">+ {t('फार्म थप्नुहोस्', 'Add farm')}</button>}
      {adding && <DynamicForm fields={FARM_ADD_FIELDS} lookups={lookups} lang={lang} t={t} resetOnSuccess onSubmit={(v) => api.post(`/farmers/${farmerId}/farms`, v).then(() => { reload(); return {}; })} />}
      {farms.length === 0 && <p className="text-gray-500">{t('फार्म दर्ता गरिएको छैन', 'No farms registered')}</p>}
      {farms.map((fm) => (
        <div key={fm.id} className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gov-blue">{fm.name}</p>
              <p className="text-sm text-gray-600">{formatLand(fm.area_sqm, lang)} · {lbl(fm.ownership_type, lang)} · {t('सिँचाइ', 'irrigation')}: {lbl(fm.irrigation_type, lang)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {fm.soil_type ? `${t('माटो', 'Soil')}: ${lbl(fm.soil_type, lang)} · ` : ''}
                {fm.water_source ? `${t('पानी', 'Water')}: ${lbl(fm.water_source, lang)} · ` : ''}
                {fm.altitude_m ? `${fm.altitude_m} m · ` : ''}
                {fm.latitude ? `GPS ${fm.latitude}, ${fm.longitude}` : t('GPS छैन', 'No GPS')} · {fm.unit_count} {t('इकाई', 'units')}
              </p>
            </div>
            {canEdit && (
              <button onClick={() => setEditing(editing === fm.id ? null : fm.id)} className="px-3 py-1.5 border rounded text-sm">
                {editing === fm.id ? t('बन्द', 'Close') : t('विवरण सम्पादन', 'Edit details')}
              </button>
            )}
          </div>
          {editing === fm.id && (
            <div className="mt-3">
              <DynamicForm key={fm.id} fields={FARM_EDIT_FIELDS} initial={fm} lookups={lookups} lang={lang} t={t}
                onSubmit={(v) => api.put(`/farmers/farms/${fm.id}/details`, v).then((r) => { reload(); return r.data; })} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
