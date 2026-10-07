import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { modules } from '../../data/modules';

export default function DashboardHome() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const { user, can } = useAuth();
  const cards = modules.filter((m) => m.to !== '/app' && (!m.perm || can(m.perm)));
  return (
    <div>
      <h2 className="text-2xl font-bold text-gov-blue">{lang === 'ne' ? 'स्वागत छ' : 'Welcome'}, {user.fullNameEn}</h2>
      <p className="text-gray-600 mb-6">{lang === 'ne' ? 'तपाईंको भूमिका अनुसारका मोड्युलहरू' : 'Modules available for your role'}: {user.roles.join(', ')}</p>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((m) => (
          <Link key={m.to} to={m.to} className="bg-white rounded-lg shadow hover:shadow-lg transition p-5 border-t-4 border-agri-green">
            <h3 className="font-semibold text-gov-blue">{m.label[lang]}</h3>
          </Link>
        ))}
      </div>
    </div>
  );
}
