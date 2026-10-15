import { useLocation } from 'react-router-dom';
import useLang from '../../utils/useLang';
import { findNav } from '../../utils/nav';
import { AgriculturePageHero } from './AgricultureShowcase';

export default function PageHeader({ title, intro }) {
  const { pathname } = useLocation();
  const { lang } = useLang();
  const hit = findNav(pathname);
  const heading = title || (hit ? hit.item.label[lang] : pathname);

  return <AgriculturePageHero title={heading} intro={intro} parent={hit?.parent?.label[lang]} parentTo={hit?.parent?.to} />;
}
