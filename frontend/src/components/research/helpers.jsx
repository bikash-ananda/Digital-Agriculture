export function Caveats({ list, t }) {
  if (!list || !list.length) return null;
  return (
    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-900">
      <p className="font-semibold mb-1">{t('अध्ययनमा ध्यान दिनुपर्ने कुरा', 'Read this before drawing conclusions')}</p>
      <ul className="list-disc pl-5 space-y-0.5">{list.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}
