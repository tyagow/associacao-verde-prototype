"use client";

/**
 * Friendly basket-with-product silhouettes for the empty cart state.
 * Replaces the prior generic 🛒 emoji with an inline SVG that uses brand
 * tokens (--green-tint background, --green strokes) so the cart rail
 * reads as designed-in rather than placeholder.
 */
export default function CartEmptyIllustration({ size = 120 }) {
  return (
    <svg
      width={size}
      height={size * 0.78}
      viewBox="0 0 120 94"
      fill="none"
      aria-hidden="true"
      role="img"
    >
      {/* tint ground */}
      <ellipse cx="60" cy="84" rx="46" ry="6" fill="var(--green-tint)" opacity="0.7" />
      {/* basket back curve */}
      <path
        d="M16 36 H104 L92 78 Q90 84 84 84 H36 Q30 84 28 78 Z"
        fill="var(--paper-warm)"
        stroke="var(--green)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* basket weave hints */}
      <line
        x1="36"
        y1="42"
        x2="34"
        y2="78"
        stroke="var(--green)"
        strokeWidth="1"
        strokeOpacity="0.45"
        strokeDasharray="2 3"
      />
      <line
        x1="50"
        y1="42"
        x2="50"
        y2="78"
        stroke="var(--green)"
        strokeWidth="1"
        strokeOpacity="0.45"
        strokeDasharray="2 3"
      />
      <line
        x1="64"
        y1="42"
        x2="66"
        y2="78"
        stroke="var(--green)"
        strokeWidth="1"
        strokeOpacity="0.45"
        strokeDasharray="2 3"
      />
      <line
        x1="78"
        y1="42"
        x2="80"
        y2="78"
        stroke="var(--green)"
        strokeWidth="1"
        strokeOpacity="0.45"
        strokeDasharray="2 3"
      />
      <line
        x1="92"
        y1="42"
        x2="94"
        y2="78"
        stroke="var(--green)"
        strokeWidth="1"
        strokeOpacity="0.45"
        strokeDasharray="2 3"
      />
      {/* basket handle */}
      <path
        d="M30 36 Q60 4 90 36"
        stroke="var(--green-deep)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* dotted product silhouettes inside */}
      <circle
        cx="46"
        cy="50"
        r="9"
        fill="none"
        stroke="var(--green-deep)"
        strokeWidth="1.2"
        strokeDasharray="2 3"
        opacity="0.7"
      />
      <rect
        x="64"
        y="44"
        width="20"
        height="14"
        rx="3"
        fill="none"
        stroke="var(--green-deep)"
        strokeWidth="1.2"
        strokeDasharray="2 3"
        opacity="0.7"
      />
      {/* sparkle */}
      <g stroke="var(--gold-deep)" strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
        <line x1="100" y1="14" x2="100" y2="22" />
        <line x1="96" y1="18" x2="104" y2="18" />
      </g>
    </svg>
  );
}
