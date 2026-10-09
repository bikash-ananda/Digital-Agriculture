export default function UnitPicker({ units, value, onChange, lang, disabled = [] }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2">
      {units.map((u) => {
        const on = value.includes(u.id);
        const off = disabled.includes(u.id);
        return (
          <label key={u.id} className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm cursor-pointer ${on ? 'bg-terrace-50 border-agri-green' : 'bg-white'} ${off ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <input type="checkbox" checked={on} disabled={off} onChange={() => toggle(u.id)} />
            <span>{lang === 'en' ? u.name_en : (u.name_ne || u.name_en)}</span>
            {u.is_simulated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">SIM</span>}
            <span className="text-xs text-gray-500">{u.days}d</span>
          </label>
        );
      })}
    </div>
  );
}
