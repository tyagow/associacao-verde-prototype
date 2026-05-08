"use client";

import styles from "./GateCard.module.css";

/**
 * Per-gate card. Tone drives the left border color.
 *
 * Props:
 *   id       unique gate id (label)
 *   label    short title
 *   detail   one-liner describing current evidence
 *   tone     "good" | "warn" | "danger" | "pending"
 *   pillText label for the right-side pill
 *   tag      optional lowercase descriptor (e.g. "webhook drill") rendered as a small overline
 *   caption  optional secondary line under detail (e.g. evidence summary). Always rendered when
 *            provided so E2E and a11y can reach the text without expanding the card.
 *   selected whether this card is currently expanded
 *   onSelect click handler (id)
 */
export default function GateCard({
  id,
  label,
  detail,
  tone = "pending",
  pillText,
  tag,
  caption,
  selected,
  onSelect,
}) {
  const className = [styles.gate, styles[tone] || styles.pending, selected ? styles.selected : ""]
    .filter(Boolean)
    .join(" ");
  const pillClass = [styles.pill, styles[`pill_${tone}`] || ""].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      className={className}
      onClick={() => onSelect && onSelect(id)}
      aria-pressed={selected ? "true" : "false"}
      data-tone={tone}
      data-gate={id}
    >
      <div className={styles.body}>
        {tag ? <span className={styles.tag}>{tag}</span> : null}
        <strong className={styles.label}>{label}</strong>
        <small className={styles.detail}>{detail}</small>
        {caption ? <small className={styles.caption}>{caption}</small> : null}
      </div>
      <span className={pillClass}>{pillText || labelFor(tone)}</span>
    </button>
  );
}

function labelFor(tone) {
  if (tone === "good") return "Passa";
  if (tone === "danger") return "Bloqueio";
  if (tone === "warn") return "Pendente";
  return "Pendente";
}
