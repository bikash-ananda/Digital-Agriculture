import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ExternalLink, FilterX, Play, Search, X } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import useLang from '../../utils/useLang';
import { FARMER_PLAYABLE_VIDEOS, FARMER_VIDEO_CATEGORIES, FARMER_VIDEOS, OFFICIAL_VIDEO_COLLECTIONS } from '../../data/farmerVideos';

const PAGE_SIZE = 12;
const VIDEO_LIBRARY = [...FARMER_PLAYABLE_VIDEOS, ...FARMER_VIDEOS];

function youtubeSearchUrl(video) {
  const query = `${video.title} agriculture Nepal`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function youtubeEmbedUrl(video) {
  return `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`;
}

function VideoCard({ video, category, onPlay, t }) {
  const cardClass = 'group flex min-h-60 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-950/5';
  const content = <>
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50"><Play size={13} fill="currentColor" aria-hidden="true" /></span>{t(category.ne, category.en)}</span>
      {video.youtubeId
        ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-800">{t('भिडियो चल्छ', 'Ready to play')}</span>
        : <span className="font-mono text-xs text-slate-400">{String(video.number).padStart(2, '0')}</span>}
    </div>
    <div className="flex flex-1 flex-col p-5">
      <h3 className="text-left text-lg font-bold leading-snug text-slate-950">{video.title}</h3>
      <p className="mt-2 flex-1 text-left text-sm leading-6 text-slate-600">{video.description}</p>
      {video.youtubeId
        ? <span className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white transition group-hover:bg-emerald-800 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-emerald-900"><Play size={16} fill="currentColor" aria-hidden="true" />{t('अहिले हेर्नुहोस्', 'Play video')}<ArrowUpRight size={15} aria-hidden="true" /></span>
        : <a href={youtubeSearchUrl(video)} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900"><Search size={16} aria-hidden="true" />{t('YouTube मा खोज्नुहोस्', 'Search on YouTube')}<ArrowUpRight size={15} aria-hidden="true" /></a>}
    </div>
  </>;

  if (video.youtubeId) {
    return <button type="button" onClick={() => onPlay(video)} aria-label={`${t('भिडियो चलाउनुहोस्', 'Play video')}: ${video.title}`} className={`${cardClass} w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900`}>
      {content}
    </button>;
  }

  return <article className={cardClass}>{content}</article>;
}

export default function VideoGallery() {
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [activeVideo, setActiveVideo] = useState(null);
  const playerDialogRef = useRef(null);

  useEffect(() => {
    const dialog = playerDialogRef.current;
    if (!dialog) return;
    if (activeVideo && !dialog.open) dialog.showModal();
    if (!activeVideo && dialog.open) dialog.close();
  }, [activeVideo]);

  const filteredVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return VIDEO_LIBRARY.filter((video) => {
      const category = FARMER_VIDEO_CATEGORIES.find((item) => item.id === video.categoryId);
      const matchesCategory = activeCategory === 'all' || video.categoryId === activeCategory;
      const searchableText = `${video.title} ${video.description} ${category?.en ?? ''} ${category?.ne ?? ''}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [activeCategory, query]);

  const pageCount = Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleVideos = filteredVideos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstResult = filteredVideos.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastResult = Math.min(currentPage * PAGE_SIZE, filteredVideos.length);

  const clearFilters = () => {
    setQuery('');
    setActiveCategory('all');
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title={t('कृषि भिडियो ग्यालरी', 'Agriculture Video Gallery')}
        intro={t('कास्कीका किसानका लागि खेती, पशुपालन, प्रविधि र बजारसम्बन्धी भिडियो विषयहरू खोज्नुहोस्।', 'Explore practical video topics on crops, livestock, farming technology and markets for farmers in Kaski.')}
      />

      <main className="mx-auto max-w-7xl px-4 py-7 md:py-9">
        <section className="rounded-2xl border border-terrace-100 bg-white p-4 shadow-sm md:p-5" aria-label={t('खोज र वर्ग फिल्टर', 'Search and category filters')}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-terrace-100 pb-4">
            <p className="font-semibold text-terrace-900">{t('आफ्नो खेतीसँग मिल्ने विषय छान्नुहोस्', 'Find a video topic that fits your farm')}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600"><span><strong className="text-terrace-900">{FARMER_PLAYABLE_VIDEOS.length}</strong> {t('चल्ने भिडियो', 'play in gallery')}</span><span><strong className="text-terrace-900">{FARMER_VIDEOS.length}</strong> {t('खोज्न मिल्ने विषय', 'searchable topics')}</span></div>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full lg:max-w-md">
              <span className="sr-only">{t('कृषि भिडियो विषय खोज्नुहोस्', 'Search agriculture video topics')}</span>
              <Search size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder={t('बाली, पशुपालन वा विषय खोज्नुहोस्…', 'Search crops, livestock or topics…')}
                className="min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-emerald-700 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <p aria-live="polite" className="shrink-0 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{firstResult}–{lastResult}</span> {t('मध्ये', 'of')} <span className="font-semibold text-slate-900">{filteredVideos.length}</span> {t('भिडियो तथा विषय', 'videos and topics')}
            </p>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('विषय वर्ग छान्नुहोस्', 'Filter by topic category')}>
            <button type="button" onClick={() => { setActiveCategory('all'); setPage(1); }} aria-pressed={activeCategory === 'all'} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 ${activeCategory === 'all' ? 'border-emerald-900 bg-emerald-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-700 hover:text-emerald-900'}`}>
              {t('सबै विषय', 'All topics')} <span className="ml-1 opacity-75">{VIDEO_LIBRARY.length}</span>
            </button>
            {FARMER_VIDEO_CATEGORIES.map((category) => {
              const selected = activeCategory === category.id;
              const categoryCount = VIDEO_LIBRARY.filter((video) => video.categoryId === category.id).length;
              return <button key={category.id} type="button" onClick={() => { setActiveCategory(category.id); setPage(1); }} aria-pressed={selected} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 ${selected ? 'border-emerald-900 bg-emerald-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-700 hover:text-emerald-900'}`}>
                {t(category.ne, category.en)} <span className="ml-1 opacity-75">{categoryCount}</span>
              </button>;
            })}
          </div>
        </section>

        {visibleVideos.length ? <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleVideos.map((video) => {
              const category = FARMER_VIDEO_CATEGORIES.find((item) => item.id === video.categoryId);
              return <VideoCard key={video.id} video={video} category={category} onPlay={setActiveVideo} t={t} />;
            })}
          </div>

          {pageCount > 1 && <nav aria-label={t('ग्यालरी पृष्ठहरू', 'Gallery pages')} className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"><ArrowLeft size={16} aria-hidden="true" />{t('अघिल्लो', 'Previous')}</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} type="button" aria-current={currentPage === pageNumber ? 'page' : undefined} aria-label={`${t('पृष्ठ', 'Page')} ${pageNumber}`} onClick={() => setPage(pageNumber)} className={`grid min-h-11 min-w-11 place-items-center rounded-xl border px-3 text-sm font-semibold ${currentPage === pageNumber ? 'border-emerald-900 bg-emerald-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-700'}`}>{pageNumber}</button>)}
            <button type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-emerald-700 disabled:cursor-not-allowed disabled:opacity-45">{t('अर्को', 'Next')}<ArrowRight size={16} aria-hidden="true" /></button>
          </nav>}
        </> : <section className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><FilterX size={25} aria-hidden="true" /></span>
          <h2 className="mt-4 text-xl font-bold text-slate-900">{t('मिल्ने विषय भेटिएन', 'No matching topics found')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('खोज शब्द परिवर्तन गर्नुहोस् वा सबै फिल्टर हटाउनुहोस्।', 'Try another search term or clear the filters.')}</p>
          <button type="button" onClick={clearFilters} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white hover:bg-emerald-800">{t('फिल्टर हटाउनुहोस्', 'Clear filters')}</button>
        </section>}

        <section className="mt-10" aria-labelledby="official-video-collections">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800">{t('थप आधिकारिक स्रोत', 'MORE OFFICIAL SOURCES')}</p><h2 id="official-video-collections" className="mt-1 text-2xl font-bold text-slate-950">{t('कृषि निकायका भिडियो संग्रह', 'Agriculture video collections')}</h2></div>
            <p className="max-w-xl text-sm text-slate-600">{t('थप प्राविधिक भिडियोका लागि सम्बन्धित निकायको ग्यालरी खोल्नुहोस्।', 'Open these agriculture institutions’ galleries to explore more technical videos.')}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {OFFICIAL_VIDEO_COLLECTIONS.map((collection) => <a key={collection.url} href={collection.url} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-900"><ExternalLink size={18} aria-hidden="true" /></span>
              <span className="mt-3 block font-bold leading-snug text-slate-900 group-hover:text-emerald-900">{collection.name}</span>
              <span className="mt-2 block text-sm leading-5 text-slate-600">{collection.description}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-900">{t('ग्यालरी खोल्नुहोस्', 'Open gallery')}<ArrowUpRight size={14} aria-hidden="true" /></span>
            </a>)}
          </div>
        </section>

        <aside className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 md:flex md:items-start md:gap-3 md:p-5">
          <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-900 md:grid"><BookOpen size={18} aria-hidden="true" /></span>
          <div><h2 className="font-bold text-amber-950">{t('भिडियो र प्राविधिक सल्लाह', 'About these videos')}</h2><p className="mt-1 text-sm leading-6 text-amber-950/80">{t('चल्ने भिडियो कार्ड थिच्दा ग्यालरीमै खुल्छ। अन्य विषयले YouTube खोजी खोल्छन्। खेतीसम्बन्धी निर्णय गर्दा स्थानीय कृषि प्राविधिकको सल्लाह लिनुहोस्।', 'Cards marked “Ready to play” open an embedded player here. Other topic cards open a YouTube search. Consult a local agriculture technician before making farm decisions.')}</p></div>
        </aside>
      </main>

      <dialog
        ref={playerDialogRef}
        onClose={() => setActiveVideo(null)}
        onClick={(event) => { if (event.target === event.currentTarget) playerDialogRef.current?.close(); }}
        aria-labelledby="video-player-title"
        aria-describedby="video-player-description"
        className="w-[calc(100%-2rem)] max-w-4xl rounded-2xl border-0 bg-slate-950 p-0 text-white shadow-2xl backdrop:bg-slate-950/80"
      >
        {activeVideo && <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-300">{t('कृषि भिडियो', 'FARMER VIDEO')}</p><h2 id="video-player-title" className="mt-1 text-xl font-bold text-white sm:text-2xl">{activeVideo.title}</h2><p id="video-player-description" className="mt-1 text-sm text-slate-300">{activeVideo.description}</p></div>
            <button type="button" onClick={() => playerDialogRef.current?.close()} aria-label={t('भिडियो बन्द गर्नुहोस्', 'Close video')} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><X size={20} aria-hidden="true" /></button>
          </div>
          <div className="aspect-video overflow-hidden rounded-xl bg-black">
            <iframe key={activeVideo.youtubeId} src={youtubeEmbedUrl(activeVideo)} title={activeVideo.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-5 text-slate-300">{t('प्ले गर्न YouTube मा अनुमति आवश्यक पर्न सक्छ।', 'YouTube may require playback permission in your browser.')}</p>
            <a href={`https://www.youtube.com/watch?v=${activeVideo.youtubeId}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm font-semibold text-white hover:bg-white/10">{t('YouTube मा खोल्नुहोस्', 'Open on YouTube')}<ExternalLink size={14} aria-hidden="true" /></a>
          </div>
        </div>}
      </dialog>
    </>
  );
}
