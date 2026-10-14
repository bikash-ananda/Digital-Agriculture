import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export default function useLang() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const t = useCallback((ne, en) => (lang === 'en' ? en : ne), [lang]);
  return { lang, t };
}
