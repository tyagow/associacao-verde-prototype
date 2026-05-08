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
 *   selected whether this card is currently expanded
 *   onSelect click handler (id)
 */
export default function GateCard({
  id,
  label,
  detail,
  tone = "pending",
  pillText,
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
        <strong className={styles.label}>{label}</strong>
        <small className={styles.detail}>{detail}</small>
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
