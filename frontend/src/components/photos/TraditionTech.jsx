import { Link } from 'react-router-dom';
import useLang from '../../utils/useLang';
import useReveal from '../../utils/useReveal';
import Photo from './Photo';
import { pickOne } from '../../utils/photos';

export default function TraditionTech() {
  const { lang, t } = useLang();
  const a = pickOne('traditional');
  const b = pickOne('modern');
  const [ref, shown] = useReveal();
  if (!a || !b) return null;
  const card = (p, title, text, delay) => (
    <figure className={`reveal ${shown ? 'reveal-in' : ''} group relative overflow-hidden rounded-xl bg-terrace-900`} style={{ transitionDelay: `${delay}ms`, aspectRatio: '4 / 3' }}>
      <Photo p={p} lang={lang} sizes="(min-width: 1024px) 50vw, 100vw" className="block h-full" imgClass="h-full w-full object-cover transition-transform duration-[2500ms] ease-out group-hover:scale-105" />
      <figcaption className="absolute inset-x-0 bottom-0 p-5 text-white" style={{ background: 'linear-gradient(0deg, rgba(8,20,13,.88), rgba(8,20,13,0))' }}>
        <p className="font-display font-bold text-xl">{title}</p>
        <p className="text-sm text-white/90 max-w-md">{text}</p>
      </figcaption>
    </figure>
  );
  return (
    <section className="max-w-7xl mx-auto px-4 py-16" ref={ref}>
      <h2 className="text-2xl md:text-3xl font-bold text-terrace-900">{t('परम्पराबाट प्रविधितिर', 'From tradition to technology')}</h2>
      <p className="mt-2 text-gray-700 max-w-2xl">{t('कास्कीका किसानले पुस्तौँदेखि जोगाएको ज्ञानमा आधुनिक प्रविधि जोडिँदैछ।', 'Knowledge that Kaski’s farmers have kept for generations, joined by modern technology.')}</p>
      <div className="mt-8 grid md:grid-cols-2 gap-6">
        {card(a, t('परम्परागत कृषि', 'Traditional farming'), t('पुस्ता–पुस्ताको ज्ञान, पाखा बारी र मौसमी बाली।', 'Knowledge handed down through generations, terraces and seasonal crops.'), 0)}
        {card(b, t('आधुनिक कृषि', 'Modern farming'), t('ग्रीनहाउस, थोपा सिँचाइ र सेन्सरले खेतीलाई सजिलो र भरपर्दो बनाउँछ।', 'Greenhouses, drip irrigation and sensors make farming easier to manage.'), 150)}
      </div>
      <p className="mt-3 text-xs text-gray-500"><Link to="/photo-credits" className="underline">{t('फोटो श्रेय हेर्नुहोस्', 'View photo credits')}</Link></p>
    </section>
  );
}
