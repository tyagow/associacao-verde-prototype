"use client";

import { useEffect, useRef } from "react";
import styles from "./AuditEventModal.module.css";

/**
 * Drawer (right-side rail) that renders a full audit event payload.
 *
 * Spec 2026-05-09 §8: read-only detail belongs in a drawer, not a centered
 * modal — keeps the audit list visible as stable left context. Visual
 * primitives (.drawer / .drawer__head / .drawer__body / .drawer__overlay,
 * .btn--icon) live in app/globals.css; this module owns the local payload
 * + meta layout only.
 *
 * Closes on overlay click, the close button, or Escape. Restores focus
 * to the previously focused element on close.
 *
 * Props:
 *   event   the audit event to display (or null/undefined to render nothing)
 *   onClose () => void
 */
export default function AuditEventModal({ event, onClose }) {
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!event) return undefined;
    previouslyFocusedRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose && onClose();
      } else if (e.key === "Tab" && drawerRef.current) {
        // Cycle 4 (A5): keep Tab/Shift-Tab focus inside the drawer while
        // the modal is open. Without this, Tab silently leaks back into
        // the audit timeline behind the dialog — a common drawer-pattern
        // regression after converting from a centered modal.
        const focusables = drawerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      try {
        previouslyFocusedRef.current?.focus?.();
      } catch (focusError) {
        /* ignore */
      }
    };
  }, [event, onClose]);

  if (!event) return null;

  const detailsJson = (() => {
    try {
      return JSON.stringify(event.details ?? {}, null, 2);
    } catch (error) {
      return String(event.details);
    }
  })();

  return (
    <>
      <div className="drawer__overlay" role="presentation" onClick={onClose} />
      <aside
        ref={drawerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do evento de auditoria"
      >
        <header className="drawer__head">
          <div>
            <p className={styles.kicker}>Evento de auditoria</p>
            <h3>{event.action}</h3>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="btn btn--icon"
            onClick={onClose}
            aria-label="Fechar detalhes"
          >
            ×
          </button>
        </header>
        <div className="drawer__body">
          <dl className={styles.meta}>
            <div>
              <dt>Quando</dt>
              <dd>{formatDateTime(event.at)}</dd>
            </div>
            <div>
              <dt>Ator</dt>
              <dd>{event.actor || "desconhecido"}</dd>
            </div>
            <div>
              <dt>Ação</dt>
              <dd>{event.action}</dd>
            </div>
          </dl>
          <section className={styles.payload} aria-label="Payload completo">
            <pre>{detailsJson}</pre>
          </section>
        </div>
      </aside>
    </>
  );
}

function formatDateTime(value) {
  if (!value) return "data não registrada";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(value));
  } catch (error) {
    return String(value);
  }
}
