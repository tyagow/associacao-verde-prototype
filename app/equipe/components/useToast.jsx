"use client";

/* Cycle 4 (B1): Single toast primitive.
 *
 * Cycle 3 found that admin/page.jsx and fulfillment/page.jsx duplicated
 * the same toast implementation byte-for-byte (state, clearTimeout
 * stash, 3200ms timer, DOM markup). This hook + surface fold them into
 * one place. New routes that need a toast import { useToast } and
 * render the returned <ToastSurface /> at the bottom of the route.
 *
 *   const { showToast, ToastSurface } = useToast();
 *   ...
 *   showToast("Pedido salvo.");
 *   ...
 *   <ToastSurface />
 *
 * The toast keeps the existing `id="toast"` + `role="status"` +
 * `aria-live="polite"` markup so any external code (E2E, a11y audits)
 * targeting the legacy markup keeps working.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_TIMEOUT_MS = 3200;
const DEFAULT_FALLBACK = "Erro na requisição.";

export function useToast({ timeoutMs = DEFAULT_TIMEOUT_MS, fallback = DEFAULT_FALLBACK } = {}) {
  const [toast, setToast] = useState("");
  const timerRef = useRef(null);

  const showToast = useCallback(
    (message) => {
      setToast(message || fallback);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setToast(""), timeoutMs);
    },
    [fallback, timeoutMs],
  );

  // Clear pending timeout if the consumer unmounts mid-toast so we don't
  // queue a setState into an unmounted tree.
  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const ToastSurface = useCallback(
    () => (
      <div className={`toast ${toast ? "show" : ""}`} id="toast" role="status" aria-live="polite">
        {toast}
      </div>
    ),
    [toast],
  );

  return { toast, showToast, ToastSurface };
}
