import { Link } from 'react-router-dom';
import useLang from '../../utils/useLang';
import PageHeader from '../../components/layout/PageHeader';

export default function Placeholder() {
  const { t } = useLang();
  return (
    <>
      <PageHeader />
      <div className="max-w-3xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold text-terrace-900">{t('यो पृष्ठको सामग्री तयार हुँदैछ', 'This page is being prepared')}</h2>
        <p className="mt-3 text-gray-700">{t('तत्काल जानकारीका लागि नयाँ सूचना हेर्नुहोस् वा कार्यालयमा सम्पर्क गर्नुहोस्।', 'For immediate information, see the latest notices or contact the office.')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/notices" className="bg-terrace-800 hover:bg-terrace-900 text-white px-5 py-2.5 rounded-md font-semibold">{t('सूचना हेर्नुहोस्', 'View notices')}</Link>
          <Link to="/contact" className="border border-terrace-800 text-terrace-800 hover:bg-terrace-50 px-5 py-2.5 rounded-md font-semibold">{t('सम्पर्क गर्नुहोस्', 'Contact the office')}</Link>
          <Link to="/" className="px-5 py-2.5 text-gov-blue underline">{t('गृहपृष्ठमा फर्कनुहोस्', 'Back to home')}</Link>
        </div>
      </div>
    </>
  );
}
