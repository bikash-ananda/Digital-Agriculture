import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Clock3, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import useLang from '../../utils/useLang';

const SOUND_KEY = 'digital-agriculture-ui-sounds';
const THEME_KEY = 'digital-agriculture-theme';
const UiExperienceContext = createContext(null);

function getInitialSoundPreference() {
  try {
    const saved = localStorage.getItem(SOUND_KEY);
    return saved === null ? true : saved === 'on';
  } catch {
    return true;
  }
}

function getInitialThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return ['auto', 'light', 'dark'].includes(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

function getAutomaticTheme() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
}

export function UiExperienceProvider({ children }) {
  const [soundsEnabled, setSoundsEnabled] = useState(getInitialSoundPreference);
  const [themePreference, setThemePreference] = useState(getInitialThemePreference);
  const [resolvedTheme, setResolvedTheme] = useState(() => {
    const preference = getInitialThemePreference();
    return preference === 'auto' ? getAutomaticTheme() : preference;
  });
  const audioContextRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.uiSounds = soundsEnabled ? 'on' : 'off';
    try { localStorage.setItem(SOUND_KEY, soundsEnabled ? 'on' : 'off'); } catch { /* The preference still applies until this page closes. */ }
  }, [soundsEnabled]);

  useEffect(() => {
    const syncTheme = () => setResolvedTheme(themePreference === 'auto' ? getAutomaticTheme() : themePreference);
    syncTheme();
    if (themePreference !== 'auto') return undefined;

    const interval = window.setInterval(syncTheme, 60_000);
    window.addEventListener('focus', syncTheme);
    document.addEventListener('visibilitychange', syncTheme);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncTheme);
      document.removeEventListener('visibilitychange', syncTheme);
    };
  }, [themePreference]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = themePreference;
    root.style.colorScheme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? '#101d15' : '#123221');
    try { localStorage.setItem(THEME_KEY, themePreference); } catch { /* The preference still applies until this page closes. */ }
  }, [resolvedTheme, themePreference]);

  useEffect(() => {
    const playPop = (event) => {
      if (!event.isTrusted || !soundsEnabled || !(event.target instanceof Element)) return;
      const control = event.target.closest('button, a[href], [role="button"], summary, input[type="submit"]');
      if (!control || control.hasAttribute('data-sound-toggle') || control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') return;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      try {
        const audioContext = audioContextRef.current || new AudioContextClass();
        audioContextRef.current = audioContext;
        if (audioContext.state === 'suspended') void audioContext.resume();

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const startAt = audioContext.currentTime;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(620, startAt);
        oscillator.frequency.exponentialRampToValueAtTime(390, startAt + 0.055);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.025, startAt + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.065);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.07);
      } catch { /* Audio feedback is a progressive enhancement. */ }
    };

    document.addEventListener('click', playPop, true);
    return () => document.removeEventListener('click', playPop, true);
  }, [soundsEnabled]);

  return <UiExperienceContext.Provider value={{ soundsEnabled, setSoundsEnabled, themePreference, setThemePreference, resolvedTheme }}>{children}</UiExperienceContext.Provider>;
}

export function UiSoundToggle({ className = '' }) {
  const context = useContext(UiExperienceContext);
  const { t } = useLang();
  if (!context) return null;

  const { soundsEnabled, setSoundsEnabled } = context;
  const label = soundsEnabled ? t('آواز बन्द गर्नुहोस्', 'Turn interface sounds off') : t('आवाज खोल्नुहोस्', 'Turn interface sounds on');
  const Icon = soundsEnabled ? Volume2 : VolumeX;

  return <button
    type="button"
    data-sound-toggle
    aria-label={label}
    aria-pressed={soundsEnabled}
    title={label}
    onClick={() => setSoundsEnabled((enabled) => !enabled)}
    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${className}`}
  ><Icon size={18} aria-hidden="true" /></button>;
}

export function ThemeControl({ className = '', variant = 'light' }) {
  const context = useContext(UiExperienceContext);
  const { lang, t } = useLang();
  if (!context) return null;

  const { themePreference, setThemePreference, resolvedTheme } = context;
  const Icon = themePreference === 'auto' ? Clock3 : themePreference === 'dark' ? Moon : Sun;
  const label = t('रङ्ग मोड', 'Color theme');
  const options = lang === 'ne'
    ? [['auto', 'समयअनुसार'], ['light', 'उज्यालो'], ['dark', 'गाढा']]
    : [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
  const colorClass = variant === 'dark'
    ? 'border-white/20 bg-white/10 text-white focus-visible:outline-white'
    : 'border-terrace-100 bg-white text-terrace-800 focus-visible:outline-gov-blue';

  return <label className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-2 ${colorClass} ${className}`} title={`${label}: ${resolvedTheme}`}>
    <Icon size={16} aria-hidden="true" />
    <span className="sr-only">{label}</span>
    <select
      aria-label={label}
      value={themePreference}
      onChange={(event) => setThemePreference(event.target.value)}
      className="h-9 max-w-[5.8rem] cursor-pointer bg-transparent text-xs font-semibold outline-none sm:max-w-none sm:text-sm"
    >
      {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select>
  </label>;
}
