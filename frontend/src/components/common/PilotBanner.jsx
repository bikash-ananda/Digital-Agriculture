import useLang from '../../utils/useLang';
import { site } from '../../data/site';

export default function PilotBanner() {
  const { t } = useLang();
  if (site.official) return null;
  return (
    <div role="note" className="bg-yellow-100 text-yellow-950 text-sm border-b border-yellow-300">
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <strong>{t('पाइलट प्लेटफर्म', 'Pilot platform')}</strong>
        <span>{t('यो डिजिटल कृषि तथा स्मार्ट फार्मिङ परियोजनाको परीक्षण संस्करण हो।', 'This is the trial version of the Digital Agriculture & Smart Farming project.')}</span>
        <a href={site.officialSite} target="_blank" rel="noreferrer" className="underline font-medium">{t('कार्यालयको आधिकारिक वेबसाइट', 'Official office website')}: {site.officialSite.replace('https://', '')}</a>
      </div>
    </div>
  );
}
