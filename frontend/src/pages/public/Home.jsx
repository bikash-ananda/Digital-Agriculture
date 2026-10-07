import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { office, officers, notices, usefulLinks } from '../../data/office';

export default function Home() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const cards = [
    ['/notices', { ne: 'सूचना', en: 'Notices' }],
    ['/programs', { ne: 'कृषि कार्यक्रम', en: 'Programs' }],
    ['/knowledge', { ne: 'कृषि ज्ञान केन्द्र', en: 'Knowledge Center' }],
    ['/smart-farming', { ne: 'स्मार्ट फार्मिङ', en: 'Smart Farming' }],
    ['/learning', { ne: 'सिकाइ केन्द्र', en: 'Learning Center' }],
    ['/publications', { ne: 'प्रकाशन', en: 'Publications' }]
  ];
  return (
    <div>
      <section className="bg-gradient-to-r from-green-700 to-green-900 text-white py-14 text-center px-4">
        <h2 className="text-3xl md:text-4xl font-bold">{office.name[lang]}</h2>
        <p className="mt-3 text-lg">{lang === 'ne' ? 'डिजिटल कृषि तथा स्मार्ट फार्मिङ प्लेटफर्म' : 'Digital Agriculture & Smart Farming Platform'}</p>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h3 className="text-xl font-bold text-gov-blue border-b-2 border-gov-red pb-1 mb-3">{lang === 'ne' ? 'सूचना' : 'Notices'}</h3>
          <div className="bg-white rounded shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr><th className="p-3">{lang === 'ne' ? 'विषय' : 'Subject'}</th><th className="p-3 whitespace-nowrap">{lang === 'ne' ? 'अन्तिम म्याद' : 'Deadline'}</th></tr>
              </thead>
              <tbody>
                {notices.map((n, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3"><a href={`${office.website}/notice`} target="_blank" rel="noreferrer" className="text-gov-blue hover:underline">{n.title}</a></td>
                    <td className="p-3 whitespace-nowrap">{n.deadline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          {officers.map((o) => (
            <div key={o.name} className="bg-white rounded shadow p-4 border-l-4 border-agri-green">
              <p className="text-xs text-gray-500">{o.role[lang]}</p>
              <p className="font-semibold text-gov-blue">{o.name}</p>
              <p className="text-sm">{o.post}</p>
              <p className="text-sm">📞 {o.phone}</p>
              <p className="text-sm break-all">✉️ {o.email}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map(([to, label]) => (
          <Link key={to} to={to} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6 border-t-4 border-agri-green">
            <h3 className="text-lg font-semibold text-gov-blue">{label[lang]}</h3>
          </Link>
        ))}
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-10 grid lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-xl font-bold text-gov-blue border-b-2 border-gov-red pb-1 mb-3">{lang === 'ne' ? 'कार्यालय भएको स्थान' : 'Office Location'}</h3>
          <iframe title="Office map" className="w-full h-72 rounded shadow" loading="lazy"
            src={`https://maps.google.com/maps?hl=en&q=${office.lat}%2C${office.lng}&t=m&z=14&output=embed`} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gov-blue border-b-2 border-gov-red pb-1 mb-3">{lang === 'ne' ? 'महत्वपूर्ण लिङ्कहरु' : 'Important Links'}</h3>
          <ul className="bg-white rounded shadow divide-y">
            {usefulLinks.map(([name, url]) => (
              <li key={url}><a href={url} target="_blank" rel="noreferrer" className="block p-3 text-sm text-gov-blue hover:bg-gray-50">{name}</a></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
