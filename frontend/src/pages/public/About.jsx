import useLang from '../../utils/useLang';
import PageHeader from '../../components/layout/PageHeader';
import { office } from '../../data/office';

export default function About() {
  const { lang, t } = useLang();
  return (
    <>
      <PageHeader title={t('कृषि विकास कार्यालय कास्कीको परिचय', 'About the Agriculture Development Office, Kaski')} />
      <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          {office.intro[lang].map((p, i) => <p key={i} className="text-lg leading-8 max-w-prose">{p}</p>)}
          <h2 className="text-2xl font-bold text-terrace-900 pt-4">{t('मुख्य जिम्मेवारी', 'Main responsibilities')}</h2>
          <dl className="divide-y divide-terrace-100 border-y border-terrace-100">
            {office.responsibilities[lang].map(([h, d]) => (
              <div key={h} className="py-4 grid sm:grid-cols-3 gap-2">
                <dt className="font-display font-semibold text-terrace-800">{h}</dt>
                <dd className="sm:col-span-2 text-gray-700">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
        <aside className="space-y-6">
          <div className="bg-white border-l-4 border-gov-red p-5 shadow">
            <h2 className="text-lg font-bold text-terrace-900">{t('भौगोलिक कार्यक्षेत्र', 'Work area')}</h2>
            <p className="mt-2 text-gray-700">{office.workArea[lang]}</p>
          </div>
          <div className="bg-white border-l-4 border-agri-green p-5 shadow">
            <h2 className="text-lg font-bold text-terrace-900">{t('कार्यालय समय', 'Office hours')}</h2>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">{office.hours[lang].map((h, i) => <li key={i}>{h}</li>)}</ul>
          </div>
        </aside>
      </div>
    </>
  );
}
