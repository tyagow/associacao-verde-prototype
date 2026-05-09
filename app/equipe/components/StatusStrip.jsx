"use client";

import { useRef } from "react";
import styles from "./StatusStrip.module.css";

/**
 * Phase 0 — shared status strip primitive (Direction B).
 *
 * Lives directly under PageHead on every internal page. Per spec §3.3:
 *
 *   [chips ...]                       [segmented]  [filters]  [Atualizar]
 *
 * Props are intentionally generic so each route can wire its own
 * data-filter selectors verbatim (preserving the E2E contract):
 *
 *   chips:    [{ label, count, tone? }]   tone in 'warn' | 'danger' | 'ok'
 *   segments: [{ label, count?, active, onClick? }]
 *   filters:  ReactNode  (rendered as-is — caller owns the data-filter attrs)
 *   onRefresh: () => void  (renders an "↻ Atualizar" ghost button at far right)
 */
export default function StatusStrip({
  chips = [],
  segments = [],
  filters = null,
  onRefresh,
  className,
}) {
  return (
    <div
      className={[styles.statusStrip, className].filter(Boolean).join(" ")}
      role="region"
      aria-label="Status e filtros"
    >
      {chips.length > 0 ? (
        <div className={styles.chips}>
          {chips.map((chip, idx) => (
            <CountChip key={idx} label={chip.label} count={chip.count} tone={chip.tone} />
          ))}
        </div>
      ) : null}

      {/* C2 fix: filters render BEFORE segments so the segmented control's
          margin-left:auto pushes both segments + Atualizar to the right edge,
          matching the mockup chips → filters → segments → Atualizar order. */}
      {filters ? <div className={styles.filters}>{filters}</div> : null}

      {segments.length > 0 ? <Segmented segments={segments} /> : null}

      {onRefresh ? (
        <button type="button" className={styles.refresh} onClick={onRefresh} aria-label="Atualizar">
          <span aria-hidden>↻</span>
          <span>Atualizar</span>
        </button>
      ) : null}
    </div>
  );
}

export function CountChip({ label, count, tone }) {
  const cls = [styles.countChip, tone ? styles[tone] : null].filter(Boolean).join(" ");
  return (
    <span className={cls}>
      <strong>{count}</strong>
      <span>{label}</span>
    </span>
  );
}

export function Segmented({ segments }) {
  /* Cycle 4 (A4): WAI-ARIA tablist pattern requires roving tabindex +
     ArrowLeft/ArrowRight focus-and-activate semantics. Previously every
     segment was in the natural tab order with no arrow handling, which
     announced as a partial-pattern lie to screen readers. */
  const containerRef = useRef(null);
  const activeIndex = Math.max(
    0,
    segments.findIndex((seg) => seg.active),
  );

  function focusByIndex(idx) {
    const root = containerRef.current;
    if (!root) return;
    const buttons = root.querySelectorAll('[role="tab"]');
    const next = buttons[idx];
    if (next) next.focus();
  }

  function handleKeyDown(idx, event) {
    const last = segments.length - 1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIdx = idx === last ? 0 : idx + 1;
      segments[nextIdx]?.onClick?.();
      focusByIndex(nextIdx);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIdx = idx === 0 ? last : idx - 1;
      segments[nextIdx]?.onClick?.();
      focusByIndex(nextIdx);
    } else if (event.key === "Home") {
      event.preventDefault();
      segments[0]?.onClick?.();
      focusByIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      segments[last]?.onClick?.();
      focusByIndex(last);
    }
  }

  return (
    <div className={styles.segmented} role="tablist" ref={containerRef}>
      {segments.map((seg, idx) => (
        <button
          key={idx}
          type="button"
          role="tab"
          aria-selected={seg.active ? "true" : "false"}
          tabIndex={idx === activeIndex ? 0 : -1}
          className={seg.active ? "on" : undefined}
          onClick={seg.onClick}
          onKeyDown={(event) => handleKeyDown(idx, event)}
        >
          <span>{seg.label}</span>
          {typeof seg.count === "number" ? <span className={styles.num}> {seg.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
