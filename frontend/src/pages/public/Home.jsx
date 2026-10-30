import { Link } from 'react-router-dom';
import { ClipboardList, BookOpen, Cpu, PhoneCall, ChevronRight, Thermometer, Wifi, Server, LayoutDashboard, Phone, Mail } from 'lucide-react';
import useLang from '../../utils/useLang';
import { AgricultureHero } from '../../components/layout/AgricultureShowcase';
import { office, officers, usefulLinks } from '../../data/office';

const SERVICES = [
  { to: '/programs', icon: ClipboardList, ne: ['अनुदान तथा कृषि कार्यक्रम', 'चालु कार्यक्रम, अनुदान र तालिमका जानकारी'], en: ['Grants and programs', 'Current programs, grants and training'] },
  { to: '/knowledge', icon: BookOpen, ne: ['कृषि प्रविधि सिक्नुहोस्', 'बाली, माटो, सिँचाइ, रोग तथा कीरा व्यवस्थापन'], en: ['Learn farming practice', 'Crops, soil, irrigation, pest and disease management'] },
  { to: '/smart-farming', icon: Cpu, ne: ['स्मार्ट फार्मिङ', 'ग्रीनहाउसमा सेन्सरबाट अनुगमन र स्वचालित सिँचाइ'], en: ['Smart farming', 'Sensor monitoring and automatic irrigation in greenhouses'] },
  { to: '/contact', icon: PhoneCall, ne: ['कार्यालयमा सम्पर्क', 'फोन, इमेल र कार्यालय समय'], en: ['Contact the office', 'Phone, email and office hours'] }
];

const FLOW = [
  { icon: Thermometer, ne: 'सेन्सर: तापक्रम, आर्द्रता, माटोको चिस्यान, EC', en: 'Sensors: temperature, humidity, soil moisture, EC' },
  { icon: Cpu, ne: 'ESP32 यन्त्रले डाटा पठाउँछ', en: 'An ESP32 device sends the readings' },
  { icon: Wifi, ne: 'इन्टरनेट मार्फत', en: 'Over the internet' },
  { icon: Server, ne: 'सर्भर र डाटाबेसमा विश्लेषण तथा भण्डारण', en: 'Analysis and storage on the server and database' },
  { icon: LayoutDashboard, ne: 'प्राविधिक र कृषकका लागि ड्यासबोर्ड', en: 'A dashboard for technicians and farmers' }
];

const ascii = (s) => s.replace(/[०-९]/g, (d) => '०१२३४५६७८९'.indexOf(d));

export default function Home() {
  const { lang, t } = useLang();
  const L = (o) => o[lang];
  return (
    <div>
      <AgricultureHero />
      

      <section className="bg-white border-y border-terrace-100">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-terrace-900">{t('तपाईंलाई के चाहियो?', 'What do you need?')}</h2>
          <ul className="mt-6 grid md:grid-cols-2 gap-x-12">
            {SERVICES.map(({ to, icon: Icon, ne, en }) => {
              const [h, d] = lang === 'en' ? en : ne;
              return (
                <li key={to} className="border-b border-terrace-100">
                  <Link to={to} className="group flex items-center gap-4 py-5">
                    <span className="shrink-0 w-12 h-12 rounded-full bg-terrace-50 text-terrace-800 grid place-items-center group-hover:bg-terrace-800 group-hover:text-white transition-colors"><Icon size={22} aria-hidden="true" /></span>
                    <span className="flex-1">
                      <span className="block font-semibold text-terrace-900 text-lg leading-snug">{h}</span>
                      <span className="block text-sm text-gray-600">{d}</span>
                    </span>
                    <ChevronRight className="text-gray-400 group-hover:text-gov-red" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="max-w-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-terrace-900">{t('सम्पर्क अधिकारीहरू', 'Contact officers')}</h2>
          <p className="mt-2 text-gray-600">{t('कार्यालयका सेवा र कार्यक्रमबारे जानकारीका लागि सम्बन्धित अधिकारीसँग सम्पर्क गर्नुहोस्।', 'Contact the relevant officer for information about office services and programs.')}</p>
        </div>
        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {officers.map((o) => (
            <li key={o.name} className="rounded-xl border border-terrace-100 border-l-4 border-l-agri-green bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-600">{L(o.role)}</p>
              <p className="font-display font-semibold text-terrace-900 text-lg">{o.name}</p>
              <p className="text-sm text-gray-700">{o.post}</p>
              <p className="mt-2 text-sm flex items-center gap-2"><Phone size={14} aria-hidden="true" /><a className="text-gov-blue hover:underline" href={`tel:+977${ascii(o.phone)}`}>{o.phone}</a></p>
              <p className="text-sm flex items-center gap-2 break-all"><Mail size={14} aria-hidden="true" /><a className="text-gov-blue hover:underline" href={`mailto:${o.email}`}>{o.email}</a></p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white border-y border-terrace-100">
        <div className="max-w-7xl mx-auto px-4 py-14">
          <h2 className="text-2xl md:text-3xl font-bold text-terrace-900">{t('हामी के गर्छौं', 'What we do')}</h2>
          <div className="mt-8 grid md:grid-cols-2 gap-x-14 gap-y-8">
            {office.responsibilities[lang].map(([h, d]) => (
              <div key={h} className="border-l-4 border-terrace-100 pl-5">
                <h3 className="text-lg font-bold text-terrace-800">{h}</h3>
                <p className="mt-1 text-gray-700 max-w-prose">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-terrace-900 text-white on-dark">
        <div className="max-w-7xl mx-auto px-4 py-16 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold leading-snug">{t('बिरौटाको ग्रीनहाउसमा स्मार्ट फार्मिङको पहिलो नमूना', 'The first smart farming pilot, in a Birauta greenhouse')}</h2>
            <p className="mt-4 text-terrace-100 max-w-xl">{t('कार्यालयको प्रदर्शन स्थलमा सेन्सरले तापक्रम, आर्द्रता र माटोको अवस्था नाप्छ। प्राविधिकले सिँचाइ र मिस्टिङ टाढैबाट नियन्त्रण गर्न वा स्वचालित बनाउन सक्छन्।', 'At the office’s demonstration site, sensors measure temperature, humidity and soil condition. Technicians can control irrigation and misting remotely, or let rules run them automatically.')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/smart-farming" className="bg-white text-terrace-900 hover:bg-terrace-50 px-6 py-3 rounded-md font-semibold">{t('स्मार्ट फार्मिङबारे जान्नुहोस्', 'Learn about smart farming')}</Link>
              <Link to="/login" className="border border-white/70 hover:bg-white/10 px-6 py-3 rounded-md font-semibold">{t('ड्यासबोर्डमा लगइन', 'Sign in to the dashboard')}</Link>
            </div>
          </div>
          <ol className="ml-5">
            {FLOW.map(({ icon: Icon, ne, en }, i) => (
              <li key={i} className={`relative pl-10 pb-7 border-l-2 ${i === FLOW.length - 1 ? 'border-transparent pb-0' : 'border-white/25'}`}>
                <span className="absolute -left-[23px] top-0 w-11 h-11 rounded-full bg-terrace-700 border-2 border-white/30 grid place-items-center"><Icon size={20} aria-hidden="true" /></span>
                <p className="font-medium pt-2">{lang === 'en' ? en : ne}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-14 grid lg:grid-cols-2 gap-10">
        <div>
          <h2 className="text-2xl font-bold text-terrace-900 border-b-2 border-gov-red pb-2">{t('कार्यालय भएको स्थान', 'Find the office')}</h2>
          <iframe title="Office map" className="mt-4 w-full h-80 rounded-md border border-terrace-100" loading="lazy"
            src={`https://maps.google.com/maps?hl=en&q=${office.lat}%2C${office.lng}&t=m&z=14&output=embed`} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-terrace-900 border-b-2 border-gov-red pb-2">{t('महत्वपूर्ण लिङ्कहरू', 'Important links')}</h2>
          <ul className="mt-2">
            {usefulLinks.map(([name, url]) => (
              <li key={url} className="border-b border-terrace-100"><a href={url} target="_blank" rel="noreferrer" className="block py-3 text-gov-blue hover:underline">{name}</a></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
