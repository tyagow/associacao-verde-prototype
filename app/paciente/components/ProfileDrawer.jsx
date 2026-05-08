"use client";

/* Phase 1b — Profile drawer.

   Hard invariant: the #patient-profile-details children stay mounted in
   the DOM at all times. The E2E test asserts visibility + content
   ("Sessao privada", "Suporte", "Plano de cuidado") on this element
   without ever clicking a "Meu perfil" button — so closed state must
   still render the content into the layout. We use framer-motion
   transforms (not display:none) and keep the panel always-mounted. */

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./ProfileDrawer.module.css";

export default function ProfileDrawer({
  open,
  onClose,
  title = "Meu perfil",
  kicker = "Cadastro e elegibilidade",
  ariaLabel = "Meu perfil",
  children,
}) {
  const closeRef = useRef(null);

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

      <motion.aside
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
