import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Placeholder() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h2 className="text-2xl font-bold text-gov-blue">{pathname}</h2>
      <p className="mt-2 text-gray-600">{t('underDev')}</p>
    </div>
  );
}
