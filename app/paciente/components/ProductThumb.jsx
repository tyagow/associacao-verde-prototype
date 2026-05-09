"use client";

import styles from "./ProductThumb.module.css";

/**
 * Product thumb illustrations for the catalog grid.
 *
 * Replaces the prior letter-monogram block with category-specific SVG
 * compositions. Each category renders a soft inline gradient + a stylized
 * silhouette so the catalog reads as a real storefront, not a wireframe.
 *
 * The gradient palette is selected deterministically from the product id
 * so the three "oleos" don't all look identical — the same product always
 * resolves to the same swatch.
 */

// Three palette swatches per category. Each entry is [bgFromVar, bgToVar, accentVar].
// Tokens only — no raw hex outside the SVG fill (which itself uses currentColor
// or token-driven values via inline style).
const PALETTES = {
  oil: [
    {
      from: "color-mix(in srgb, var(--gold-soft) 92%, white)",
      to: "color-mix(in srgb, var(--gold) 60%, var(--gold-soft))",
      accent: "var(--gold-deep)",
      bottle: "color-mix(in srgb, var(--green-deep) 88%, var(--ink))",
      liquid: "color-mix(in srgb, var(--gold) 75%, var(--green-deep))",
    },
    {
      from: "color-mix(in srgb, var(--green-tint) 95%, white)",
      to: "color-mix(in srgb, var(--green) 38%, var(--green-tint))",
      accent: "var(--green-deep)",
      bottle: "var(--green-deep)",
      liquid: "color-mix(in srgb, var(--gold) 60%, var(--green))",
    },
    {
      from: "color-mix(in srgb, var(--paper-warm) 80%, var(--gold-soft))",
      to: "color-mix(in srgb, var(--gold) 45%, var(--paper-warm))",
      accent: "var(--gold-on)",
      bottle: "color-mix(in srgb, var(--ink) 92%, var(--gold-deep))",
      liquid: "var(--gold-deep)",
    },
  ],
  flower: [
    {
      from: "color-mix(in srgb, var(--green-tint) 90%, white)",
      to: "color-mix(in srgb, var(--green) 55%, var(--green-tint))",
      accent: "var(--green-deep)",
      leaf: "var(--green-deep)",
    },
    {
      from: "color-mix(in srgb, var(--paper-warm) 60%, var(--green-tint))",
      to: "color-mix(in srgb, var(--green-deep) 60%, var(--green))",
      accent: "var(--green-deep)",
      leaf: "color-mix(in srgb, var(--green-deep) 70%, var(--ink))",
    },
    {
      from: "color-mix(in srgb, var(--green-tint) 85%, var(--gold-soft))",
      to: "color-mix(in srgb, var(--green) 45%, var(--gold))",
      accent: "var(--green-deep)",
      leaf: "var(--green-deep)",
    },
  ],
  edible: [
    {
      from: "color-mix(in srgb, var(--gold-soft) 88%, white)",
      to: "color-mix(in srgb, var(--danger-soft) 60%, var(--gold))",
      accent: "var(--danger-ink)",
      gummy: "color-mix(in srgb, var(--danger) 72%, var(--gold))",
      gummy2: "color-mix(in srgb, var(--gold-deep) 75%, var(--danger))",
    },
    {
      from: "color-mix(in srgb, var(--gold-soft) 92%, white)",
      to: "color-mix(in srgb, var(--gold) 55%, var(--gold-soft))",
      accent: "var(--gold-on)",
      gummy: "var(--gold-deep)",
      gummy2: "color-mix(in srgb, var(--green) 50%, var(--gold-deep))",
    },
  ],
  default: [
    {
      from: "color-mix(in srgb, var(--paper-warm) 70%, var(--gold-soft))",
      to: "color-mix(in srgb, var(--gold) 40%, var(--paper-warm))",
      accent: "var(--gold-on)",
      jar: "color-mix(in srgb, var(--ink) 85%, var(--gold-deep))",
    },
  ],
};

function hashIndex(seed, length) {
  if (!length) return 0;
  let h = 0;
  const str = String(seed || "");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % length;
}

function pickPalette(category, productId) {
  const key = PALETTES[category] ? category : "default";
  const list = PALETTES[key];
  return list[hashIndex(productId, list.length)];
}

/* Inline SVG compositions. Each one is sized 200×140 viewBox and stretches
   to the parent container (which clips overflow). The compositions sit
   slightly off-center so the card feels editorial rather than centered-icon. */

function OilSilhouette({ palette }) {
  // Apothecary-style dropper bottle with liquid line + dropper nub.
  return (
    <svg
      className={styles.svg}
      viewBox="0 0 200 140"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="oil-bottle" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.bottle} stopOpacity="0.92" />
          <stop offset="100%" stopColor={palette.bottle} stopOpacity="0.78" />
        </linearGradient>
      </defs>
      {/* dropper cap */}
      <rect x="86" y="14" width="28" height="10" rx="2" fill={palette.accent} opacity="0.85" />
      <rect x="90" y="22" width="20" height="8" rx="1" fill={palette.bottle} opacity="0.6" />
      {/* neck */}
      <path d="M94 30 H106 V40 H94 Z" fill={palette.bottle} opacity="0.88" />
      {/* body */}
      <path
        d="M82 40 Q72 44 72 56 V120 Q72 130 82 130 H118 Q128 130 128 120 V56 Q128 44 118 40 Z"
        fill="url(#oil-bottle)"
      />
      {/* liquid line */}
      <path
        d="M76 78 Q100 73 124 78 L124 120 Q124 126 118 126 H82 Q76 126 76 120 Z"
        fill={palette.liquid}
        opacity="0.55"
      />
      {/* highlight */}
      <path
        d="M82 50 Q80 60 80 72 L80 110"
        stroke="white"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* dropper line */}
      <line
        x1="100"
        y1="38"
        x2="100"
        y2="92"
        stroke={palette.accent}
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <circle cx="100" cy="94" r="2" fill={palette.accent} opacity="0.6" />
    </svg>
  );
}

function FlowerSilhouette({ palette }) {
  // Stylized 5-leaflet cannabis fan, low detail.
  return (
    <svg
      className={styles.svg}
      viewBox="0 0 200 140"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <g transform="translate(100 78)" fill={palette.leaf} opacity="0.92">
        {/* center leaflet */}
        <path d="M0 -52 Q4 -36 6 -16 Q3 -8 0 -2 Q-3 -8 -6 -16 Q-4 -36 0 -52 Z" />
        {/* upper-side leaflets */}
        <path
          d="M0 -2 Q-12 -22 -28 -38 Q-40 -42 -38 -32 Q-28 -22 -16 -10 Q-6 -4 0 -2 Z"
          opacity="0.95"
        />
        <path d="M0 -2 Q12 -22 28 -38 Q40 -42 38 -32 Q28 -22 16 -10 Q6 -4 0 -2 Z" opacity="0.95" />
        {/* lower-side leaflets */}
        <path d="M-2 0 Q-18 8 -34 16 Q-44 20 -38 26 Q-26 24 -14 16 Q-6 8 -2 0 Z" opacity="0.85" />
        <path d="M2 0 Q18 8 34 16 Q44 20 38 26 Q26 24 14 16 Q6 8 2 0 Z" opacity="0.85" />
      </g>
      {/* stem */}
      <line
        x1="100"
        y1="78"
        x2="100"
        y2="120"
        stroke={palette.leaf}
        strokeWidth="2"
        strokeOpacity="0.6"
      />
      {/* sun-mark accent */}
      <circle cx="158" cy="28" r="14" fill={palette.accent} opacity="0.18" />
    </svg>
  );
}

function EdibleSilhouette({ palette }) {
  // A pair of overlapping rounded gummies.
  return (
    <svg
      className={styles.svg}
      viewBox="0 0 200 140"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="gummy1" cx="0.35" cy="0.35">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor={palette.gummy} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="78" cy="86" rx="36" ry="32" fill={palette.gummy} opacity="0.92" />
      <ellipse cx="78" cy="86" rx="36" ry="32" fill="url(#gummy1)" />
      <ellipse cx="128" cy="68" rx="30" ry="28" fill={palette.gummy2} opacity="0.85" />
      <ellipse cx="128" cy="68" rx="30" ry="28" fill="url(#gummy1)" />
      {/* shimmer dots */}
      <circle cx="62" cy="72" r="3" fill="white" opacity="0.6" />
      <circle cx="120" cy="58" r="2" fill="white" opacity="0.6" />
      <circle cx="92" cy="100" r="2" fill="white" opacity="0.5" />
    </svg>
  );
}

function JarSilhouette({ palette }) {
  return (
    <svg
      className={styles.svg}
      viewBox="0 0 200 140"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect x="74" y="22" width="52" height="10" rx="2" fill={palette.jar} opacity="0.9" />
      <path
        d="M70 34 H130 V124 Q130 132 122 132 H78 Q70 132 70 124 Z"
        fill={palette.jar}
        opacity="0.82"
      />
      <path
        d="M76 50 H124 V120 Q124 124 120 124 H80 Q76 124 76 120 Z"
        fill={palette.accent}
        opacity="0.18"
      />
    </svg>
  );
}

function categoryAria(category, name) {
  const label =
    category === "oil"
      ? "Frasco de óleo"
      : category === "flower"
        ? "Flor"
        : category === "edible"
          ? "Goma"
          : "Produto";
  return `${label} — ${name || ""}`.trim();
}

export default function ProductThumb({ category = "default", productId, name }) {
  const key = PALETTES[category] ? category : "default";
  const palette = pickPalette(key, productId);
  const bg = {
    background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
  };

  let inner = null;
  if (key === "oil") inner = <OilSilhouette palette={palette} />;
  else if (key === "flower") inner = <FlowerSilhouette palette={palette} />;
  else if (key === "edible") inner = <EdibleSilhouette palette={palette} />;
  else inner = <JarSilhouette palette={palette} />;

  return (
    <div
      className={styles.thumb}
      style={bg}
      role="img"
      aria-label={categoryAria(key, name)}
      data-thumb-category={key}
    >
      <span className={styles.glow} aria-hidden="true" />
      {inner}
    </div>
  );
}
