import { useLocation } from 'react-router-dom';
import { modules } from '../../data/modules';

export default function ModulePlaceholder() {
  const { pathname } = useLocation();
  const m = modules.find((x) => x.to === pathname);
  return (
    <div>
      <h2 className="text-2xl font-bold text-gov-blue">{m ? m.label.en : pathname}</h2>
      <p className="mt-2 text-gray-600">This module will be built in a later step.</p>
    </div>
  );
}
