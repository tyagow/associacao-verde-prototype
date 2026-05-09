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
 *   caption  optional secondary line under detail (e.g. evidence summary)
 *   command  optional inline cmd hint, rendered as <code> block
 *   footerText optional footer text (e.g. "<tag> · <timestamp>")
 *   footerCta  optional ghost CTA on the right of the footer
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
  command,
  footerText,
  footerCta,
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
      {tag ? <span className={styles.tag}>{tag}</span> : null}
      <div className={styles.titleRow}>
        <strong className={styles.label}>{label}</strong>
        <span className={pillClass}>{pillText || labelFor(tone)}</span>
      </div>
      <small className={styles.detail}>{detail}</small>
      {caption ? <small className={styles.caption}>{caption}</small> : null}
      {command ? <code className={styles.cmd}>{command}</code> : null}
      {footerText || footerCta ? (
        <span className={styles.footer}>
          {footerText ? <span>{footerText}</span> : <span />}
          {footerCta || null}
        </span>
      ) : null}
    </button>
  );
}

function labelFor(tone) {
  // D5 fix: consistent lowercase across all tones (the danger/pending pills
  // were capitalised, the others weren't).
  if (tone === "good") return "verde";
  if (tone === "danger") return "bloqueio";
  if (tone === "warn") return "amarelo";
  return "pendente";
}
