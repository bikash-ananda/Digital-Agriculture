import { useTranslation } from 'react-i18next';
import { office } from '../../data/office';

export default function About() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h2 className="text-2xl font-bold text-gov-blue border-b-2 border-gov-red pb-2 mb-4">{lang === 'ne' ? 'कृषि विकास कार्यालय कास्कीको परिचय' : 'About the Office'}</h2>
      {office.intro[lang].map((p, i) => <p key={i} className="mb-4 leading-relaxed">{p}</p>)}
      <h3 className="text-lg font-semibold text-gov-blue mt-6 mb-3">{lang === 'ne' ? 'मुख्य क्षेत्रगत जिम्मेवारी' : 'Main Responsibilities'}</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {office.responsibilities[lang].map(([t, d]) => (
          <div key={t} className="bg-white rounded shadow p-4 border-t-4 border-agri-green">
            <p className="font-semibold text-gov-blue">{t}</p>
            <p className="text-sm mt-1">{d}</p>
          </div>
        ))}
      </div>
      <h3 className="text-lg font-semibold text-gov-blue mt-6 mb-2">{lang === 'ne' ? 'भौगोलिक कार्यक्षेत्र' : 'Geographical Work Area'}</h3>
      <p>{office.workArea[lang]}</p>
    </div>
  );
}
