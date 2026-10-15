import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { office, usefulLinks } from '../../../data/office';
import { PublicPage } from './common';
import { copy, surface } from './helpers';

const services = [
  { en: 'Agriculture Development Office, Kaski', ne: 'कृषि विकास कार्यालय, कास्की', kindEn: 'Local office · farmer support and technical guidance', kindNe: 'स्थानीय कार्यालय · कृषक सेवा तथा प्राविधिक सल्लाह', href: 'https://kaski.ado.gov.np/', label: 'kaski.ado.gov.np', local: true },
  { en: 'Soil and Fertilizer Testing Laboratory, Gandaki', ne: 'माटो तथा मल परीक्षण प्रयोगशाला, गण्डकी', kindEn: 'Soil and fertilizer laboratory', kindNe: 'माटो तथा मल प्रयोगशाला', href: 'http://soillabgandaki.gov.np/', label: 'soillabgandaki.gov.np' },
  { en: 'Seed Quality Control Center, Gandaki', ne: 'बीउ बिजन प्रयोगशाला, गण्डकी', kindEn: 'Seed information and laboratory services', kindNe: 'बीउसम्बन्धी जानकारी तथा प्रयोगशाला सेवा', href: 'https://seedlabgandaki.gov.np/', label: 'seedlabgandaki.gov.np' },
  { en: 'Agriculture Development Directorate, Gandaki', ne: 'कृषि विकास निर्देशनालय, गण्डकी', kindEn: 'Provincial agriculture services', kindNe: 'प्रदेशस्तरीय कृषि सेवा', href: 'https://add.gandaki.gov.np', label: 'add.gandaki.gov.np' },
  { en: 'Department of Agriculture, Nepal', ne: 'कृषि विभाग, नेपाल', kindEn: 'Government technical publications and services', kindNe: 'सरकारी प्राविधिक प्रकाशन तथा सेवा', href: 'https://doanepal.gov.np/ne/', label: 'doanepal.gov.np' },
  { en: 'Ministry of Agriculture, Land Management and Cooperatives, Gandaki', ne: 'कृषि, भूमि व्यवस्था तथा सहकारी मन्त्रालय, गण्डकी', kindEn: 'Provincial ministry', kindNe: 'प्रदेश मन्त्रालय', href: 'https://molmac.gandaki.gov.np/', label: 'molmac.gandaki.gov.np' }
];

export default function AgricultureServices() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  return <PublicPage eyebrow={copy(lang, 'SERVICE DIRECTORY', 'सेवा निर्देशिका')} title={copy(lang, 'Agricultural services and contacts', 'कृषि सेवा तथा सम्पर्क')} intro={copy(lang, 'A directory of the Kaski office and government service websites already listed by the site. These are external links; this directory does not claim to verify individual professionals or provide booking.', 'वेबसाइटमा उल्लेखित कास्की कार्यालय र सरकारी सेवा वेबसाइटको सूची। यी बाह्य लिङ्क हुन्; यस निर्देशिकाले व्यक्तिगत प्राविधिकको प्रमाणीकरण वा भेटघाट बुकिङ दाबी गर्दैन।')}>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{services.map((service) => <article className={`${surface} flex flex-col p-5`} key={service.href}><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-900"><MapPin size={19} aria-hidden="true" /></span><div><h2 className="font-bold text-slate-950">{lang === 'en' ? service.en : service.ne}</h2><p className="mt-1 text-sm leading-5 text-slate-600">{lang === 'en' ? service.kindEn : service.kindNe}</p></div></div><a href={service.href} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-emerald-900 underline underline-offset-2">{service.label}<ExternalLink size={14} aria-hidden="true" /></a>{service.local && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-700"><a className="inline-flex items-center gap-2 hover:underline" href={`tel:${office.phone.replaceAll('-', '')}`}><Phone size={15} aria-hidden="true" />{office.phone}</a><br /><a className="inline-flex items-center gap-2 hover:underline" href={`mailto:${office.email}`}><Mail size={15} aria-hidden="true" />{office.email}</a></div>}</article>)}</div>
    <p className="mt-6 text-xs text-slate-500">{copy(lang, `Source list: ${usefulLinks.length} government and public-agency links maintained by this website. Confirm current services and office hours directly with each provider.`, `स्रोत सूची: यस वेबसाइटमा राखिएका ${usefulLinks.length} सरकारी तथा सार्वजनिक निकायका लिङ्क। हालको सेवा र कार्यालय समय सम्बन्धित निकायसँग पुष्टि गर्नुहोस्।`)}</p>
  </PublicPage>;
}
