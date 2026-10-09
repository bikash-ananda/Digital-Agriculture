import { Phone, Mail } from 'lucide-react';
import useLang from '../../utils/useLang';
import PageHeader from '../../components/layout/PageHeader';
import { staff } from '../../data/office';

const TONES = ['bg-terrace-800', 'bg-gov-blue', 'bg-[#7a3b1d]', 'bg-[#5a3e85]', 'bg-[#0e6b73]', 'bg-[#8a5a00]'];
const ascii = (s) => s.replace(/[०-९]/g, (d) => '०१२३४५६७८९'.indexOf(d));

export default function Staff() {
  const { t } = useLang();
  const groups = Array.from(new Set(staff.map((s) => s.group)));
  return (
    <>
      <PageHeader title={t('कर्मचारी विवरण', 'Staff directory')} intro={t('कार्यालयका कर्मचारीको नाम, पद र सम्पर्क विवरण।', 'Names, positions and contact details of the office staff.')} />
      <div className="max-w-7xl mx-auto px-4 py-10">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          {staff.map((s) => (
            <li key={s.name} className="flex gap-4 py-5 border-b border-terrace-100">
              <span className={`shrink-0 w-14 h-14 rounded-full text-white grid place-items-center text-xl font-display font-bold ${TONES[groups.indexOf(s.group) % TONES.length]}`} aria-hidden="true">{[...s.name][0]}</span>
              <div className="min-w-0">
                <p className="font-display font-semibold text-terrace-900 text-lg leading-snug">{s.name}</p>
                <p className="text-sm text-gray-700">{s.post}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.group}</p>
                {s.phone && <p className="mt-2 text-sm flex items-center gap-2"><Phone size={14} aria-hidden="true" /><a className="text-gov-blue hover:underline" href={`tel:+977${ascii(s.phone)}`}>{s.phone}</a></p>}
                {s.email && <p className="text-sm flex items-center gap-2 break-all"><Mail size={14} aria-hidden="true" /><a className="text-gov-blue hover:underline" href={`mailto:${s.email}`}>{s.email}</a></p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
