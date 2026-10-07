import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function Home() {
  const { t } = useTranslation();
  const cards = [
    ['notices', '/notices'], ['programs', '/programs'], ['knowledge', '/knowledge'],
    ['smart', '/smart-farming'], ['learning', '/learning'], ['downloads', '/downloads']
  ];
  return (
    <div>
      <section className="bg-gradient-to-r from-green-700 to-green-900 text-white py-16 text-center px-4">
        <h2 className="text-3xl md:text-4xl font-bold">{t('office')}</h2>
        <p className="mt-3 text-lg">{t('tagline')}</p>
      </section>
      <section className="max-w-7xl mx-auto px-4 py-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map(([k, to]) => (
          <Link key={k} to={to}
            className="bg-white rounded-lg shadow hover:shadow-lg transition p-6 border-t-4 border-agri-green">
            <h3 className="text-lg font-semibold text-gov-blue">{t(k)}</h3>
          </Link>
        ))}
      </section>
    </div>
  );
}
