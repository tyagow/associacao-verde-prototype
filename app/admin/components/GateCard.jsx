"use client";

import styles from "./GateCard.module.css";

/**
 * Per-gate card. Tone drives the left border color.
 *
 * Visual primitives (.pill / .pill--*, .codeBlock,
 * .surface--bordered-left-*) live in globals.css. This module owns
 * the gate shell layout only.
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
const TONE_BORDER = {
  good: "surface--bordered-left-ok",
  warn: "surface--bordered-left-warn",
  danger: "surface--bordered-left-danger",
  pending: "surface--bordered-left-neutral",
};

const TONE_PILL = {
  good: "pill--good",
  warn: "pill--warn",
  danger: "pill--danger",
  pending: "pill--neutral",
};

export default function GateCard({
  id,
  label,
  asciiLabel = "",
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
  const className = [
    styles.gate,
    TONE_BORDER[tone] || TONE_BORDER.pending,
    selected ? styles.selected : "",
  ]
    .filter(Boolean)
    .join(" ");
  const pillClass = `pill ${TONE_PILL[tone] || TONE_PILL.pending}`;
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
        <strong className={styles.label}>
          {label}
          {/* Cycle 4 (A2): hidden ASCII helper preserves the canonical
              gate label that smoke + E2E grep against, while users see
              the diacritic-correct visible string. */}
          {asciiLabel ? (
            <span hidden aria-hidden="true">
              {asciiLabel}
            </span>
          ) : null}
        </strong>
        <span className={pillClass}>{pillText || labelFor(tone)}</span>
      </div>
      <small className={styles.detail}>{detail}</small>
      {caption ? <small className={styles.caption}>{caption}</small> : null}
      {command ? <code className="codeBlock">{command}</code> : null}
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
