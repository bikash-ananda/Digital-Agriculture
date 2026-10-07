const colors = {
  online: 'bg-green-100 text-green-800', offline: 'bg-red-100 text-red-800', registered: 'bg-gray-100 text-gray-700',
  disabled: 'bg-gray-200 text-gray-600', active: 'bg-green-100 text-green-800', faulty: 'bg-red-100 text-red-800',
  on: 'bg-green-100 text-green-800', off: 'bg-gray-100 text-gray-700', unknown: 'bg-yellow-100 text-yellow-800',
  maintenance: 'bg-yellow-100 text-yellow-800', inactive: 'bg-gray-200 text-gray-600'
};

export default function StatusBadge({ value }) {
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[value] || 'bg-gray-100 text-gray-700'}`}>{value}</span>;
}
