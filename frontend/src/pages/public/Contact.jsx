import { MapPin, Phone, Mail, Globe, Clock } from 'lucide-react';
import useLang from '../../utils/useLang';
import PageHeader from '../../components/layout/PageHeader';
import { office } from '../../data/office';

export default function Contact() {
  const { lang, t } = useLang();
  const rows = [
    [MapPin, `${office.name[lang]}, ${office.city[lang]}, ${lang === 'ne' ? 'कास्की, गण्डकी प्रदेश' : 'Kaski, Gandaki Province'}`],
    [Phone, <a key="p" className="text-gov-blue hover:underline" href={`tel:+977${office.phone.replace('-', '')}`}>{office.phone}</a>],
    [Mail, <a key="m" className="text-gov-blue hover:underline" href={`mailto:${office.email}`}>{office.email}</a>],
    [Globe, <a key="w" className="text-gov-blue hover:underline" href={office.website} target="_blank" rel="noreferrer">{office.website}</a>]
  ];
  return (
    <>
      <PageHeader title={t('सम्पर्क', 'Contact us')} intro={t('सेवा, अनुदान र प्राविधिक सल्लाहका लागि कार्यालयमा सम्पर्क गर्नुहोस्।', 'Reach the office for services, grants and technical advice.')} />
      <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-2 gap-12">
        <div>
          <ul className="divide-y divide-terrace-100 border-y border-terrace-100">
            {rows.map(([Icon, content], i) => (
              <li key={i} className="flex items-start gap-4 py-4"><span className="w-10 h-10 shrink-0 rounded-full bg-terrace-50 text-terrace-800 grid place-items-center"><Icon size={18} aria-hidden="true" /></span><span className="pt-1.5 break-all">{content}</span></li>
            ))}
          </ul>
          <h2 className="mt-8 text-xl font-bold text-terrace-900 flex items-center gap-2"><Clock size={20} aria-hidden="true" /> {t('कार्यालय समय', 'Office hours')}</h2>
          <ul className="mt-2 space-y-1 text-gray-700">{office.hours[lang].map((h, i) => <li key={i}>{h}</li>)}</ul>
        </div>
        <iframe title="Office map" className="w-full h-96 rounded-md border border-terrace-100" loading="lazy"
          src={`https://maps.google.com/maps?hl=en&q=${office.lat}%2C${office.lng}&t=m&z=14&output=embed`} />
      </div>
    </>
  );
}
