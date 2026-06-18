import { useState } from 'react';

// Ticker → domain for Clearbit logo CDN (US stocks)
const DOMAIN_MAP: Record<string, string> = {
  AAPL: 'apple.com',        MSFT: 'microsoft.com',    AMZN: 'amazon.com',
  GOOGL: 'google.com',      GOOG: 'google.com',        META: 'meta.com',
  NVDA: 'nvidia.com',       TSLA: 'tesla.com',         BRK: 'berkshirehathaway.com',
  BRKB: 'berkshirehathaway.com', BRKA: 'berkshirehathaway.com',
  JPM: 'jpmorganchase.com', V: 'visa.com',             MA: 'mastercard.com',
  UNH: 'unitedhealthgroup.com', JNJ: 'jnj.com',        WMT: 'walmart.com',
  PG: 'pg.com',             HD: 'homedepot.com',       DIS: 'disney.com',
  BAC: 'bankofamerica.com', XOM: 'exxonmobil.com',     CVX: 'chevron.com',
  ABBV: 'abbvie.com',       KO: 'coca-cola.com',       PEP: 'pepsico.com',
  MRK: 'merck.com',         LLY: 'lilly.com',          AVGO: 'broadcom.com',
  COST: 'costco.com',       TMO: 'thermofisher.com',   CSCO: 'cisco.com',
  ACN: 'accenture.com',     VZ: 'verizon.com',         NFLX: 'netflix.com',
  ADBE: 'adobe.com',        CRM: 'salesforce.com',     INTC: 'intel.com',
  AMD: 'amd.com',           QCOM: 'qualcomm.com',      TXN: 'ti.com',
  NKE: 'nike.com',          SBUX: 'starbucks.com',     MCD: 'mcdonalds.com',
  PYPL: 'paypal.com',       UBER: 'uber.com',          LYFT: 'lyft.com',
  SPOT: 'spotify.com',      SNAP: 'snap.com',          TWTR: 'twitter.com',
  SQ: 'block.xyz',          SHOP: 'shopify.com',       ETSY: 'etsy.com',
  ZM: 'zoom.us',            DOCU: 'docusign.com',      ROKU: 'roku.com',
  ABNB: 'airbnb.com',       DASH: 'doordash.com',      RIVN: 'rivian.com',
  LCID: 'lucidmotors.com',  F: 'ford.com',             GM: 'gm.com',
  GS: 'goldmansachs.com',   MS: 'morganstanley.com',   C: 'citi.com',
  WFC: 'wellsfargo.com',    USB: 'usbank.com',          PNC: 'pnc.com',
  AXP: 'americanexpress.com', COF: 'capitalone.com',   SCHW: 'schwab.com',
  BLK: 'blackrock.com',     SPGI: 'spglobal.com',      MCO: 'moodys.com',
  BA: 'boeing.com',         GE: 'ge.com',              RTX: 'rtx.com',
  LMT: 'lockheedmartin.com', NOC: 'northropgrumman.com', DE: 'deere.com',
  CAT: 'caterpillar.com',   MMM: '3m.com',             HON: 'honeywell.com',
  UPS: 'ups.com',           FDX: 'fedex.com',          AMGN: 'amgen.com',
  GILD: 'gilead.com',       BMY: 'bms.com',            PFE: 'pfizer.com',
  MRNA: 'modernatx.com',    CVS: 'cvshealth.com',      CI: 'cigna.com',
  NEE: 'nexteraenergy.com', DUK: 'duke-energy.com',    SO: 'southerncompany.com',
  T: 'att.com',             CMCSA: 'comcast.com',      CHTR: 'charter.com',
};

// Palette for JSE initials avatars — consistent, not performance-based
const PALETTES = [
  { bg: 'rgba(59,130,246,.15)',  border: 'rgba(59,130,246,.3)',  text: '#60a5fa' },  // blue
  { bg: 'rgba(168,85,247,.15)', border: 'rgba(168,85,247,.3)',  text: '#c084fc' },  // purple
  { bg: 'rgba(20,184,166,.15)', border: 'rgba(20,184,166,.3)',  text: '#2dd4bf' },  // teal
  { bg: 'rgba(245,158,11,.15)', border: 'rgba(245,158,11,.3)',  text: '#fbbf24' },  // amber
  { bg: 'rgba(239,68,68,.12)',  border: 'rgba(239,68,68,.25)',  text: '#f87171' },  // red
  { bg: 'rgba(16,185,129,.15)', border: 'rgba(16,185,129,.3)',  text: '#34d399' },  // emerald
  { bg: 'rgba(249,115,22,.12)', border: 'rgba(249,115,22,.25)', text: '#fb923c' },  // orange
  { bg: 'rgba(236,72,153,.12)', border: 'rgba(236,72,153,.25)', text: '#f472b6' },  // pink
];

function paletteFor(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) & 0xffff;
  return PALETTES[hash % PALETTES.length];
}

interface Props {
  symbol: string;
  isUS?: boolean;
  size?: number;
  radius?: number;
}

export default function StockLogo({ symbol, isUS = false, size = 36, radius = 10 }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const domain = DOMAIN_MAP[symbol.toUpperCase()];
  const showImg = isUS && !!domain && !imgFailed;
  const palette = paletteFor(symbol);

  const initial = symbol.replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase();
  const fontSize = size <= 28 ? 9 : size <= 36 ? 11 : 13;

  if (showImg) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        background: '#fff',
        border: '1px solid rgba(var(--fg),.1)',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img
          src={`https://logo.clearbit.com/${domain}`}
          alt={symbol}
          onError={() => setImgFailed(true)}
          style={{ width: '72%', height: '72%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontSize, fontWeight: 800,
        color: palette.text,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '-0.03em',
        lineHeight: 1,
      }}>
        {initial}
      </span>
    </div>
  );
}
