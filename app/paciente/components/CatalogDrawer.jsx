"use client";

/* Phase 1b — Catalog drawer.

   Hard invariant: the children passed in (the existing #catalog,
   #catalog-tools, [data-catalog-query], [data-catalog-filter='*'],
   [data-add='*'] DOM) MUST remain mounted in the document at all times.
   Playwright's existing selectors in scripts/e2e-production-app.py
   reference these IDs/attributes and we MUST NOT modify the E2E script
   in this phase. Visual openness is driven via framer-motion transforms
   plus a pointer-events toggle — never via display:none, never via
   conditional unmounting of children. */

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./CatalogDrawer.module.css";

export default function CatalogDrawer({
  open,
  onClose,
  title = "Catalogo autorizado",
  kicker = "Produtos liberados",
  ariaLabel = "Catalogo autorizado",
  children,
}) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);

  // Esc-to-close, focus the close button when opened.
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`${styles.root} ${open ? styles.rootOpen : ""}`.trim()} aria-hidden={!open}>
      <AnimatePresence>
        {open ? (
          <motion.button
            type="button"
            key="backdrop"
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-label="Fechar"
            tabIndex={-1}
          />
        ) : null}
      </AnimatePresence>

      {/* Panel is ALWAYS rendered (not gated by AnimatePresence) so that
          the children inside it remain in the DOM whether the drawer is
          open or closed. We animate the transform of the panel itself. */}
      <motion.aside
        ref={panelRef}
        className={`${styles.panel} ${open ? "" : styles.panelClosed}`.trim()}
        role="dialog"
        aria-modal={open ? "true" : "false"}
        aria-label={ariaLabel}
        initial={false}
        animate={{ x: open ? 0 : "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 240 }}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.kicker}>{kicker}</span>
            <h2 className={styles.title}>{title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Fechar drawer"
          >
            ×
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </motion.aside>
    </div>
  );
}
