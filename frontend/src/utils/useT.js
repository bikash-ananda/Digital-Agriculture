import { useTranslation } from 'react-i18next';

export default function useT() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  return { lang, t: (ne, en) => (lang === 'en' ? en : ne) };
}
