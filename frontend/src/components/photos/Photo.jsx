import { altOf, fallbackSrc, srcset } from '../../utils/photos';

export default function Photo({ p, lang, sizes = '100vw', className = 'block', imgClass = '', eager = false }) {
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={srcset(p, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcset(p, 'webp')} sizes={sizes} />
      <img src={fallbackSrc(p)} alt={altOf(p, lang)} width={p.width} height={p.height} loading={eager ? 'eager' : 'lazy'} decoding="async" className={imgClass} style={{ objectPosition: `${p.focal[0]}% ${p.focal[1]}%` }} />
    </picture>
  );
}
