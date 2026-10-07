import { useTranslation } from 'react-i18next';

export default function Login() {
  const { t } = useTranslation();
  return (
    <div className="max-w-md mx-auto my-16 bg-white p-8 rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gov-blue mb-6">{t('loginTitle')}</h2>
      <input className="w-full border rounded p-2 mb-3" placeholder={t('username')} />
      <input className="w-full border rounded p-2 mb-4" type="password" placeholder={t('password')} />
      <button className="w-full bg-agri-green text-white py-2 rounded font-semibold">{t('login')}</button>
    </div>
  );
}
