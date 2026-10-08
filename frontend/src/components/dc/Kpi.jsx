export default function Kpi({ icon, label, value, sub, color = 'text-gov-blue' }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border-t-4 border-agri-green">
      <p className="text-sm text-gray-600">{icon} {label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
