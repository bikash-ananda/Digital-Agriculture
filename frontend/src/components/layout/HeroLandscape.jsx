const W = 1200;
const H = 420;

const LAYERS = [
  { y: 262, amp: 14, ph: 0.5, freq: 140, fill: '#86ad92' },
  { y: 288, amp: 12, ph: 1.6, freq: 120, fill: '#5f9470' },
  { y: 314, amp: 12, ph: 2.7, freq: 150, fill: '#3f7c55' },
  { y: 340, amp: 10, ph: 3.9, freq: 130, fill: '#2b6a3b' },
  { y: 366, amp: 8, ph: 5.0, freq: 160, fill: '#1f5230' },
  { y: 392, amp: 6, ph: 0.2, freq: 110, fill: '#173f26' }
];

const built = LAYERS.map((l) => {
  const pts = [];
  for (let x = 0; x <= W; x += 20) pts.push([x, +(l.y + l.amp * Math.sin(x / l.freq + l.ph)).toFixed(1)]);
  const edge = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  return { ...l, edge, area: `${edge} L${W},${H} L0,${H} Z` };
});

const RIBS = [1, 2, 3, 4, 5].map((i) => {
  const x = i * 20;
  const top = 28 - 34 * Math.sqrt(Math.max(0, 1 - ((x - 60) / 60) ** 2));
  return `M${x},28 L${x},${top.toFixed(1)}`;
});

const Layer = ({ l }) => (
  <g>
    <path d={l.area} fill={l.fill} />
    <path d={l.edge} fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.2" />
  </g>
);

export default function HeroLandscape({ className = '', tunnel = true }) {
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="hl-snow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#d3e1ea" />
          <stop offset="1" stopColor="#b7cbd8" />
        </linearGradient>
      </defs>
      <path d="M0,300 L90,262 L170,278 L250,226 L330,252 L410,196 L470,224 L540,170 L600,200 L680,160 L740,196 L800,140 L850,112 L872,76 L890,112 L905,126 L921,70 L945,118 L1000,162 L1060,150 L1120,196 L1200,170 L1200,420 L0,420 Z" fill="url(#hl-snow)" />
      <path d="M872,76 L890,112 L905,126 L921,70 L945,118 L930,160 L890,150 Z" fill="#8fa9bc" opacity="0.35" />
      <path d="M0,305 Q150,236 330,276 T640,258 T930,272 T1200,244 L1200,420 L0,420 Z" fill="#a9c5cd" />
      {built.slice(0, 4).map((l) => <Layer key={l.y} l={l} />)}
      {tunnel && (
        <g transform="translate(228 318)">
          <path d="M0,28 A60,34 0 0 1 120,28 Z" fill="#ffffff" fillOpacity="0.5" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.5" />
          {RIBS.map((d, i) => <path key={i} d={d} stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1" />)}
          <circle className="pulse" cx="60" cy="16" r="3.5" fill="#ffb703" />
        </g>
      )}
      {built.slice(4).map((l) => <Layer key={l.y} l={l} />)}
    </svg>
  );
}
