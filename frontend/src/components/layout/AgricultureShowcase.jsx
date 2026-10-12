import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useLang from '../../utils/useLang';

const CAPTIONS = {
  header: [
    ['Fresh work begins in the fields', 'खेतबारीमा सुरु हुन्छ नयाँ मेहनत'],
    ['Farms beneath the high Himalaya', 'हिमालको काखमा हरिया खेत'],
    ['A quiet morning by the lake', 'तालछेउको शान्त बिहान'],
    ['Care that keeps livestock thriving', 'पशुपालन फस्टाउने दैनिक स्याहार'],
    ['Color grown with patient hands', 'धैर्यिला हातले फुलाएको रंग'],
    ['Flower fields brighten the valley', 'फूलबारीले सजिएको उपत्यका'],
    ['Rich earth, ready for planting', 'रोपाइँका लागि तयार उर्वर माटो'],
    ['Green farms beneath the mountains', 'पहाडको काखमा हरिया खेत'],
    ['Life and work across the hills', 'पहाडमा फैलिएको जीवन र खेती'],
    ['Fresh catch beside the farmland', 'खेतबारीछेउको ताजा माछा'],
    ['A landscape shaped by farming', 'खेतीले सजिएको सुन्दर भू-दृश्य'],
    ['Sweet citrus from hillside trees', 'पहाडी बगैँचाका गुलिया सुन्तला'],
    ['A bright harvest from local orchards', 'स्थानीय बगैँचाको सुनौलो उत्पादन'],
    ['Rice fields glowing in the rain', 'वर्षामा चम्किएका धानका खेत'],
    ['Farms in the heart of Pokhara', 'पोखराको काखमा फस्टाएका खेत'],
    ['Village life rooted in the land', 'माटोसँग जोडिएको गाउँले जीवन'],
    ['A glimpse of local farm life', 'स्थानीय खेती जीवनको एक झलक']
  ],
  featured: [
    ['A closer look at local farm life', 'स्थानीय खेती जीवनको नजिकबाट झलक'],
    ['Everyday work across the fields', 'खेतबारीमा दैनिक मेहनत'],
    ['Protected growing for healthy crops', 'स्वस्थ बालीका लागि सुरक्षित खेती'],
    ['Local knowledge carried forward', 'अगाडि बढ्दै गरेको स्थानीय खेती ज्ञान']
  ],
  modern: [
    ['A smoother harvest with modern tools', 'आधुनिक औजारले सहज फसल'],
    ['A bird’s-eye view of crop health', 'माथिबाट बालीको स्वास्थ्य अनुगमन'],
    ['Steady growth in a controlled climate', 'नियन्त्रित वातावरणमा निरन्तर वृद्धि'],
    ['Fresh greens grown with water-smart care', 'पानीको सदुपयोगले हुर्केका ताजा साग'],
    ['Local materials, protected young crops', 'स्थानीय सामग्रीले सुरक्षित बिरुवा'],
    ['Research that helps farmers grow better', 'किसानको उन्नतिका लागि उपयोगी अनुसन्धान'],
    ['Neat rows planted with care', 'मायाले रोपिएका मिल्दा हरफ'],
    ['A greener, more efficient farm', 'अझ हरियो र प्रभावकारी खेती'],
    ['Automation lending a hand in the field', 'खेतमा साथ दिँदै स्वचालन']
  ],
  traditional: [
    ['A shared harvest, the time-honored way', 'परम्परागत तरिकाले सँगै भित्र्याएको बाली'],
    ['Hands at work in the rice paddy', 'धानखेतमा व्यस्त किसानका हात'],
    ['Golden mustard brightens the fields', 'तोरीले पहेँलिएका सुन्दर खेत'],
    ['Young rice brings a fresh promise', 'नयाँ धानले ल्याएको आशा'],
    ['Preparing the earth for potatoes', 'आलु खेतीका लागि तयार जमिन']
  ],
  products: [
    ['A local favorite, made with care', 'मायाले बनेको स्थानीय परिकार'],
    ['Nutritious millet from nearby farms', 'नजिकैका खेतको पोषिलो कागुनो'],
    ['A heritage grain for wholesome meals', 'स्वस्थ खानाका लागि पुरानो अन्न'],
    ['Sweet kiwi from the green hills', 'हरिया पहाडका गुलिया किवी'],
    ['Hearty millet bread, made at home', 'घरमै बनेको पोषिलो कोदोको रोटी'],
    ['Fresh vegetables from village gardens', 'गाउँका बारीबाट ताजा तरकारी'],
    ['Warm roasted corn, straight from the field', 'खेतबाट आएको तातो पोलेको मकै'],
    ['Crisp produce picked at its best', 'ठिक्क पाकेको ताजा कृषि उपज'],
    ['Fresh milk from local dairy farms', 'स्थानीय डेरी फार्मको ताजा दूध'],
    ['Bright, sweet berries at harvest', 'फसलमा पाकेका गुलिया स्ट्रबेरी']
  ]
};

const captionFor = (category, index, lang) => {
  const pair = CAPTIONS[category]?.[index] || ['A little more from local farms', 'स्थानीय खेतबारीबाट थप झलक'];
  return pair[lang === 'en' ? 0 : 1];
};

function useAgriculturePhotos() {
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    let live = true;
    fetch('/images/agriculture/manifest.json').then((response) => {
      if (!response.ok) throw new Error('Photo manifest unavailable');
      return response.json();
    }).then((items) => { if (live && Array.isArray(items)) setPhotos(items); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return photos;
}

export function AgricultureHero() {
  const { lang, t } = useLang();
  const photos = useAgriculturePhotos().filter((photo) => photo.category === 'header');
  const [active, setActive] = useState(0);
  const dots = photos.length <= 7 ? photos : Array.from({ length: 7 }, (_, index) => photos[Math.round(index * (photos.length - 1) / 6)]);
  const selectedDot = photos.length <= 7 ? active : Math.round(active * (dots.length - 1) / Math.max(1, photos.length - 1));
  useEffect(() => {
    if (photos.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % photos.length), 6500);
    return () => window.clearInterval(timer);
  }, [photos.length]);

  return (
    <section className="agri-hero relative isolate overflow-hidden min-h-[540px] md:min-h-[650px] flex items-center">
      <div className="agri-hero-scenes" aria-hidden="true">
        {photos.map((photo, index) => <img key={photo.src} src={photo.src} alt="" className={`agri-hero-image ${index === active ? 'is-active' : ''}`} fetchPriority={index === active ? 'high' : 'auto'} />)}
      </div>
      <div className="agri-hero-shade absolute inset-0" aria-hidden="true" />
      <div className="relative z-10 max-w-7xl w-full mx-auto px-4 py-20 md:py-28">
        <div className="max-w-3xl text-white">
          <p className="agri-hero-kicker inline-flex items-center gap-2 rounded-full border border-white/40 bg-black/20 px-4 py-1.5 text-sm font-semibold backdrop-blur-sm">{t('कास्की · गण्डकी प्रदेश', 'Kaski · Gandaki Province')}</p>
          <h1 className="mt-5 text-4xl md:text-6xl font-bold leading-tight drop-shadow-lg">{t('कास्कीका किसानका लागि डिजिटल कृषि सेवा', 'Digital agriculture services for the farmers of Kaski')}</h1>
          <p className="mt-5 max-w-2xl text-lg md:text-xl text-white/95 drop-shadow">{t('सूचना, अनुदान कार्यक्रम, तालिम र स्मार्ट फार्मिङ — एकै ठाउँमा।', 'Notices, grant programs, training and smart farming, in one place.')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/notices" className="rounded-md bg-white px-6 py-3 font-semibold text-terrace-900 shadow hover:bg-terrace-50">{t('नयाँ सूचना हेर्नुहोस्', 'View latest notices')}</Link>
            <Link to="/smart-farming" className="rounded-md border border-white/80 bg-black/20 px-6 py-3 font-semibold text-white backdrop-blur-sm hover:bg-white/15">{t('स्मार्ट फार्मिङ', 'Explore smart farming')}</Link>
          </div>
        </div>
        {photos.length > 0 && <p className="agri-hero-caption absolute left-4 bottom-5 z-10 max-w-[55%] rounded-md bg-black/30 px-3 py-1.5 text-sm text-white/95 backdrop-blur-sm" aria-live="polite">{captionFor('header', active, lang)}</p>}
        {dots.length > 1 && <div className="absolute bottom-6 right-4 z-10 flex gap-2" aria-label={t('पृष्ठभूमि तस्बिर छान्नुहोस्', 'Choose a background photo')}>
          {dots.map((photo, dotIndex) => { const index = photos.findIndex((item) => item.src === photo.src); return <button key={photo.src} type="button" onClick={() => setActive(index)} aria-label={`${t('तस्बिर', 'Photo')} ${index + 1}`} aria-pressed={dotIndex === selectedDot} className={`h-2.5 rounded-full transition-all ${dotIndex === selectedDot ? 'w-8 bg-white' : 'w-2.5 bg-white/55 hover:bg-white/90'}`} />; })}
        </div>}
      </div>
    </section>
  );
}

function PhotoCarouselSection({ group, sectionIndex, lang, t }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (group.photos.length <= 3 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setOffset((index) => (index + 3) % group.photos.length), 6500);
    return () => window.clearInterval(timer);
  }, [group.photos.length]);

  const visible = Array.from({ length: Math.min(3, group.photos.length) }, (_, index) => {
    const photoIndex = (offset + index) % group.photos.length;
    return { photo: group.photos[photoIndex], photoIndex };
  });
  const move = (direction) => setOffset((current) => (current + direction * 3 + group.photos.length * 3) % group.photos.length);

  return <section className={`agri-photo-section ${group.className} ${sectionIndex % 2 ? 'agri-photo-section-tint' : ''}`}>
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-agri-green">{t('कृषि फोटो संग्रह', 'Agriculture photo collection')}</p>
          <h2 className="mt-2 text-2xl md:text-3xl font-bold text-terrace-900">{group.title[lang === 'en' ? 0 : 1]}</h2>
          <p className="mt-2 text-gray-700">{group.desc[lang === 'en' ? 0 : 1]}</p>
        </div>
        {group.photos.length > 3 && <div className="flex gap-2" aria-label={t('तस्बिरहरू बदल्नुहोस्', 'Change photos')}>
          <button type="button" onClick={() => move(-1)} className="agri-gallery-control" aria-label={t('अघिल्ला तीन तस्बिर', 'Previous three photos')}>‹</button>
          <button type="button" onClick={() => move(1)} className="agri-gallery-control" aria-label={t('अर्का तीन तस्बिर', 'Next three photos')}>›</button>
        </div>}
      </div>
      <div className="agri-photo-grid mt-6" aria-live="polite">
        {visible.map(({ photo, photoIndex }) => {
          const description = captionFor(group.key, photoIndex, lang);
          return <figure key={photo.src} className="agri-photo-card">
            <div className="agri-photo-frame"><img src={photo.src} alt={description} loading="lazy" /></div>
            <figcaption>{description}</figcaption>
          </figure>;
        })}
      </div>
      <p className="mt-4 text-xs text-gray-500">{Math.min(3, group.photos.length)} / {group.photos.length} {t('तस्बिरहरू', 'photos')}</p>
    </div>
  </section>;
}

export function AgriculturePhotoSections() {
  const { lang, t } = useLang();
  const photos = useAgriculturePhotos();
  const groups = [
    { key: 'modern', title: ['Modern farming', 'आधुनिक खेती'], desc: ['Smart tools and fresh ideas from the field', 'खेतका नयाँ सोच र आधुनिक औजार'], className: 'agri-gallery-modern' },
    { key: 'traditional', title: ['Traditional farming', 'परम्परागत खेती'], desc: ['Local knowledge and work passed through generations', 'पुस्तौँदेखि आएको स्थानीय सीप र मेहनत'], className: 'agri-gallery-traditional' },
    { key: 'products', title: ['Local harvest', 'स्थानीय उत्पादन'], desc: ['Good food grown and made close to home', 'घरनजिकै उब्जेका र बनेका स्वादिला परिकार'], className: 'agri-gallery-products' },
    { key: 'featured', title: ['Farm life in Gandaki', 'गण्डकीको खेती जीवन'], desc: ['A few scenes from farms across the region', 'क्षेत्रका खेतबारीबाट केही सुन्दर झलक'], className: 'agri-gallery-featured' }
  ];
  const sections = groups.map((group) => ({ ...group, photos: photos.filter((photo) => photo.category === group.key) })).filter((group) => group.photos.length);
  if (!sections.length) return null;

  return <div className="agri-photo-sections">
    {sections.map((group, index) => <PhotoCarouselSection key={group.key} group={group} sectionIndex={index} lang={lang} t={t} />)}
  </div>;
}
