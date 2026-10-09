import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import useLang from '../../utils/useLang';
import { findNav } from '../../utils/nav';

export default function PageHeader({ title, intro }) {
  const { pathname } = useLocation();
  const { lang, t } = useLang();
  const hit = findNav(pathname);
  const heading = title || (hit ? hit.item.label[lang] : pathname);
  return (
    <header className="contour bg-white border-b border-terrace-100">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10">
        <nav aria-label="Breadcrumb" className="text-sm text-gray-600 mb-3">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link to="/" className="text-gov-blue hover:underline">{t('गृहपृष्ठ', 'Home')}</Link></li>
            {hit && hit.parent && (<><li aria-hidden="true"><ChevronRight size={14} /></li><li>{hit.parent.label[lang]}</li></>)}
            <li aria-hidden="true"><ChevronRight size={14} /></li>
            <li aria-current="page" className="font-medium text-terrace-800">{heading}</li>
          </ol>
        </nav>
        <h1 className="text-3xl md:text-4xl font-bold text-terrace-900">{heading}</h1>
        {intro && <p className="mt-2 max-w-2xl text-gray-700">{intro}</p>}
      </div>
    </header>
  );
}
