import useLang from '../../utils/useLang';
import PageHeader from '../../components/layout/PageHeader';
import Photo from '../../components/photos/Photo';
import { allPhotos } from '../../utils/photos';

export default function PhotoCredits() {
  const { lang, t } = useLang();
  return (
    <>
      <PageHeader title={t('फोटो श्रेय', 'Photo credits')} intro={t('यस वेबसाइटका तस्बिरहरू तल देखाइएका अनुमतिपत्रअन्तर्गत प्रयोग गरिएका छन्।', 'Photographs on this website are used under the licences shown below.')} />
      <div className="max-w-7xl mx-auto px-4 py-10">
        {allPhotos.length === 0 && <p className="text-gray-600">{t('अहिले कुनै तस्बिर प्रयोगमा छैन।', 'No photographs are in use yet.')}</p>}
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {allPhotos.map((p) => (
            <li key={p.id} className="bg-white rounded-lg shadow overflow-hidden">
              <Photo p={p} lang={lang} sizes="(min-width: 1024px) 33vw, 100vw" className="block" imgClass="h-48 w-full object-cover" />
              <div className="p-4 text-sm space-y-1">
                <p className="font-semibold text-terrace-900">{p.title}</p>
                <p>{t('छायाँकार', 'Author')}: {p.author}</p>
                <p>{t('अनुमतिपत्र', 'Licence')}: {p.license_url ? <a className="text-gov-blue underline" href={p.license_url} target="_blank" rel="noreferrer">{p.license}</a> : p.license}</p>
                {p.source_url && <p><a className="text-gov-blue underline" href={p.source_url} target="_blank" rel="noreferrer">{t('स्रोत पृष्ठ', 'Source page')}</a></p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
