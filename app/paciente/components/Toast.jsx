"use client";

import styles from "./Toast.module.css";

/**
 * Toast — Phase 1a wrapper around the legacy `.toast` element. Always renders
 * with id="toast" so E2E selectors (#toast) keep working. Visibility is
 * controlled by the presence of `message` (drives the `.show` class).
 */
export default function Toast({ message }) {
  const visible = Boolean(message);
  return (
    <div
      className={`toast ${visible ? "show" : ""} ${styles.host}`.trim()}
      id="toast"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
