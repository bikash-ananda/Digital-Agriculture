import { useTranslation } from 'react-i18next';
import { office } from '../../data/office';

export default function Contact() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-8">
      <div>
        <h2 className="text-2xl font-bold text-gov-blue border-b-2 border-gov-red pb-2 mb-4">{lang === 'ne' ? 'सम्पर्क' : 'Contact'}</h2>
        <p>{office.province[lang]}</p>
        <p>{office.ministry[lang]}</p>
        <p className="font-bold text-gov-blue mt-2">{office.name[lang]}</p>
        <p>{office.city[lang]}, {lang === 'ne' ? 'गण्डकी प्रदेश, नेपाल' : 'Gandaki Province, Nepal'}</p>
        <p className="mt-2">📞 {office.phone}</p>
        <p>✉️ {office.email}</p>
        <p>🌐 {office.website}</p>
        <h3 className="font-semibold text-gov-blue mt-6 mb-1">{lang === 'ne' ? 'कार्यालय समय' : 'Office Hours'}</h3>
        {office.hours[lang].map((h, i) => <p key={i} className="text-sm">{h}</p>)}
      </div>
      <iframe title="Office map" className="w-full h-80 rounded shadow" loading="lazy"
        src={`https://maps.google.com/maps?hl=en&q=${office.lat}%2C${office.lng}&t=m&z=14&output=embed`} />
    </div>
  );
}
