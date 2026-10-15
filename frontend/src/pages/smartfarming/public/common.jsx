import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { copy } from './helpers';
import { AgriculturePageHero } from '../../../components/layout/AgricultureShowcase';

export function PublicPage({ eyebrow, title, intro, children }) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  return <div className="min-h-[60vh] bg-[#f5f8f4]">
    <AgriculturePageHero title={title} intro={intro} eyebrow={eyebrow} parent={copy(lang, 'Smart Farming', 'स्मार्ट फार्मिङ')} parentTo="/smart-farming" />
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">{children}</div>
  </div>;
}

export function Callout({ title, children, tone = 'emerald' }) {
  const colors = tone === 'amber' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950';
  return <aside className={`rounded-2xl border p-4 ${colors}`}><h2 className="font-semibold">{title}</h2><div className="mt-1 text-sm leading-6">{children}</div></aside>;
}

export function SecondaryLink({ to, children }) {
  return <Link to={to} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-emerald-700 hover:text-emerald-900">{children}<ArrowRight size={16} aria-hidden="true" /></Link>;
}

