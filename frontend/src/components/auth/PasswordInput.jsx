import { useState } from 'react';
import useT from '../../utils/useT';
import { passwordHints } from '../../utils/passwordHints';

export default function PasswordInput({ id, label, value, onChange, autoComplete, hints = false, ctx }) {
  const { lang, t } = useT();
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800">{label}</label>
      <div className="relative mt-1">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required
          className="w-full border border-gray-300 rounded-md px-3 py-2.5 pr-20 bg-white" />
        <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 underline" aria-label={show ? t('पासवर्ड लुकाउनुहोस्', 'Hide password') : t('पासवर्ड देखाउनुहोस्', 'Show password')}>
          {show ? t('लुकाउनु', 'Hide') : t('देखाउनु', 'Show')}
        </button>
      </div>
      {hints && value.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs" aria-live="polite">
          {passwordHints(value, ctx).map((h) => <li key={h.en} className={h.ok ? 'text-green-700' : 'text-gray-500'}>{h.ok ? '✓' : '○'} {lang === 'en' ? h.en : h.ne}</li>)}
        </ul>
      )}
    </div>
  );
}
