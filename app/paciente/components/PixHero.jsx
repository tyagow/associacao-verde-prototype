"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import OrderTimeline from "./OrderTimeline";
import styles from "./PixHero.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function computeSecondsLeft(expiresAt) {
  if (!expiresAt) return null;
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.floor((target - Date.now()) / 1000));
}

function formatCountdown(seconds) {
  if (seconds == null) return "--:--";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function monogram(name) {
  if (!name) return "AV";
  const trimmed = String(name).trim();
  if (!trimmed) return "AV";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || trimmed[1] || "";
  return (first + second).toUpperCase().slice(0, 2);
}

export default function PixHero({ order, onMarkPaid, onCopyPix, onCancel, onRetry }) {
  const expiresAt = order?.paymentExpiresAt;
  const [secondsLeft, setSecondsLeft] = useState(() => computeSecondsLeft(expiresAt));
  const [announcement, setAnnouncement] = useState("");
  const prevSecondsRef = useRef(null);
  const reduce = useReducedMotion();

  // UX3: "Ja paguei" verification feedback.
  // verifying: button is showing the spinner / waiting on confirmation.
  // verifyAttempt: how many round-trips so far (max 2 before we surface
  // the suporte fallback hint).
  // verifyState: idle | pending | success | retry | exhausted
  const [verifyState, setVerifyState] = useState("idle");
  const [verifyAttempt, setVerifyAttempt] = useState(0);
  const verifyTimerRef = useRef(null);
  const prevStatusRef = useRef(order?.status);

  useEffect(() => {
    return () => {
      if (verifyTimerRef.current) window.clearTimeout(verifyTimerRef.current);
    };
  }, []);

  // When the parent re-renders with a different order.status while we are
  // verifying, treat any move out of awaiting_payment as success.
  useEffect(() => {
    const prev = prevStatusRef.current;
    const next = order?.status;
    prevStatusRef.current = next;
    if (
      (verifyState === "pending" || verifyState === "retry") &&
      prev === "awaiting_payment" &&
      next &&
      next !== "awaiting_payment"
    ) {
      if (verifyTimerRef.current) {
        window.clearTimeout(verifyTimerRef.current);
        verifyTimerRef.current = null;
      }
      setVerifyState("success");
    }
  }, [order?.status, verifyState]);

  useEffect(() => {
    setSecondsLeft(computeSecondsLeft(expiresAt));
    if (!expiresAt) return undefined;
    const id = window.setInterval(() => {
      setSecondsLeft(computeSecondsLeft(expiresAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  // Threshold-crossing announcer: only updates aria-live text when the
  // countdown passes a meaningful boundary (10min, 5min, 1min, 30s, 0).
  // The visible countdown still ticks every second, but it is aria-hidden
  // so screen readers do not narrate it on every tick.
  useEffect(() => {
    const prev = prevSecondsRef.current;
    prevSecondsRef.current = secondsLeft;
    if (secondsLeft == null || prev == null) return;
    const crossed = (boundary) => prev > boundary && secondsLeft <= boundary;
    let next = "";
    if (crossed(0)) next = "Tempo expirado";
    else if (crossed(30)) next = "30 segundos restantes para o pagamento";
    else if (crossed(60)) next = "1 minuto restante para o pagamento";
    else if (crossed(300)) next = "5 minutos restantes para o pagamento";
    else if (crossed(600)) next = "10 minutos restantes para o pagamento";
    if (next) setAnnouncement(next);
  }, [secondsLeft]);

  const expired = secondsLeft != null && secondsLeft <= 0;
  const copia = order?.pix?.copiaECola || "";
  const items = order?.items || [];
  const delivery = order?.deliveryMethod || "Entrega a combinar";
  const totalCents = order?.totalCents || 0;
  const orderId = order?.id || "novo pedido";
  const expiresAtLabel = expiresAt
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(expiresAt))
    : "sem data";

  const runVerify = async () => {
    if (typeof onMarkPaid === "function") {
      try {
        await onMarkPaid();
      } catch {
        /* parent already toasts */
      }
    }
    // Give the parent a tick to swap order.status if the webhook landed.
    verifyTimerRef.current = window.setTimeout(() => {
      // If the prevStatus effect already moved us to success, do nothing.
      setVerifyState((current) => {
        if (current === "success") return current;
        // Re-evaluate against the latest order prop via closure: if the
        // prop has been updated, the prevStatus effect would have flipped
        // us to success already.
        if (order?.status && order.status !== "awaiting_payment") {
          return "success";
        }
        // Determine retry vs exhausted from attempt count.
        return verifyAttempt >= 2 ? "exhausted" : "retry";
      });
    }, 2500);
  };

  const handleVerify = async () => {
    if (verifyState === "pending") return;
    setVerifyAttempt((n) => n + 1);
    setVerifyState("pending");
    await runVerify();
  };

  // After landing in "retry", auto-attempt one more time after 10s
  // (caps at attempt count 2; after that we surface the suporte hint).
  useEffect(() => {
    if (verifyState !== "retry") return undefined;
    const id = window.setTimeout(() => {
      if (verifyAttempt >= 2) {
        setVerifyState("exhausted");
        return;
      }
      setVerifyAttempt((n) => n + 1);
      setVerifyState("pending");
      runVerify();
    }, 10000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyState]);

  const verifying = verifyState === "pending";
  const markPaidLabel = expired
    ? "Solicitar novo Pix"
    : verifying
      ? "Verificando pagamento..."
      : verifyState === "success"
        ? "Pagamento confirmado!"
        : "Ja paguei, atualizar";

  const handleCopy = async () => {
    if (!copia) return;
    if (onCopyPix) {
      onCopyPix(copia);
      return;
    }
    try {
      await navigator.clipboard.writeText(copia);
    } catch {
      /* clipboard unavailable */
    }
  };

  const stripCopy = expired
    ? "Pix expirado · estoque liberado"
    : "Pix gerado · estoque reservado até o vencimento";

  const subtitles = expired
    ? {}
    : { "awaiting-payment": `${formatCountdown(secondsLeft)} restantes` };

  return (
    <section
      className={styles["px-hero"]}
      data-expired={expired ? "true" : "false"}
      data-reduce-motion={reduce ? "true" : "false"}
      aria-label="Pagamento Pix"
    >
      <header className={styles["px-hero__bar"]}>
        <span className={styles["px-hero__pulse"]} aria-hidden="true" />
        <strong>{stripCopy}</strong>
        <span className={styles["px-hero__order-id"]}>{orderId}</span>
      </header>

      <div className={styles["px-hero__grid"]}>
        <div className={styles["px-hero__left"]}>
          <div className={styles["px-hero__amount-row"]}>
            <div>
              <span className={styles["px-hero__kicker"]}>Total a pagar</span>
              <p className={styles["px-hero__amount"]}>
                {money.format(totalCents / 100)}
                <sup>BRL</sup>
              </p>
            </div>
            <div className={styles["px-hero__countdown"]} aria-hidden="true">
              <span>{expired ? "Vencido" : "Vence em"}</span>
              <strong>{formatCountdown(secondsLeft)}</strong>
            </div>
            <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
              {announcement}
            </span>
          </div>

          <div className={styles["px-hero__meta-row"]}>
            <div className={styles["px-hero__meta-item"]}>
              <label>Método</label>
              <b>Pix copia-e-cola</b>
            </div>
            <div className={styles["px-hero__meta-item"]}>
              <label>Vencimento</label>
              <b>{expiresAtLabel}</b>
            </div>
            <div className={styles["px-hero__meta-item"]}>
              <label>Entrega</label>
              <b>{delivery}</b>
            </div>
          </div>

          {expired ? (
            <p className={styles["px-hero__expired-note"]}>
              Pagamento expirado. Solicite um novo Pix para reservar estoque novamente.
            </p>
          ) : null}

          <div className={styles["px-hero__qr-section"]}>
            <div className={styles["px-hero__qr"]}>
              {copia ? (
                <QRCodeSVG
                  value={copia}
                  size={180}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0d1f17"
                  aria-label="QR code Pix"
                />
              ) : (
                <div
                  className={styles["px-hero__qr-empty"]}
                  role="img"
                  aria-label="QR code Pix indisponível"
                />
              )}
            </div>
            <div className={styles["px-hero__qr-text"]}>
              <h3>Aponte a câmera do seu app do banco</h3>
              <p>
                Ou copie o código abaixo e cole na opção <b>Pix copia-e-cola</b> do seu banco.
              </p>
              <div className={styles["px-hero__copy"]}>
                <textarea readOnly aria-label="Pix copia e cola" value={copia} rows={2} />
                <button
                  type="button"
                  className={styles["px-hero__copy-btn"]}
                  onClick={handleCopy}
                  disabled={!copia}
                >
                  Copiar
                </button>
              </div>
              <div className={styles["px-hero__actions"]}>
                {expired ? (
                  <>
                    <button
                      type="button"
                      className={styles["px-hero__btn-primary"]}
                      onClick={() => onRetry?.(items, "regenerate")}
                    >
                      Gerar novo Pix
                    </button>
                    <button
                      type="button"
                      className={styles["px-hero__btn-ghost"]}
                      onClick={() => onRetry?.(items, "edit")}
                    >
                      Editar pedido antes
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles["px-hero__btn-primary"]}
                    data-pix-verify
                    onClick={handleVerify}
                    disabled={verifying}
                    aria-busy={verifying ? "true" : undefined}
                  >
                    {verifying ? (
                      <>
                        <span className={styles["px-hero__spinner"]} aria-hidden="true" />
                        {markPaidLabel}
                      </>
                    ) : (
                      markPaidLabel
                    )}
                  </button>
                )}
                {onCancel && !expired ? (
                  <button
                    type="button"
                    className={styles["px-hero__btn-ghost"]}
                    onClick={onCancel}
                    aria-label="Cancelar pedido em andamento e abrir suporte"
                  >
                    Cancelar pedido
                  </button>
                ) : null}
              </div>
              {!expired && verifyState === "retry" ? (
                <p className={styles["px-hero__verify-note"]} role="status" aria-live="polite">
                  Ainda nao recebemos a confirmacao do banco. Pix pode levar ate 1 minuto. Vamos
                  tentar de novo.
                </p>
              ) : null}
              {!expired && verifyState === "exhausted" ? (
                <p
                  className={`${styles["px-hero__verify-note"]} ${styles["px-hero__verify-note--danger"]}`}
                  role="status"
                  aria-live="polite"
                >
                  Nao localizamos o pagamento ainda. Se o debito ja saiu, fale com o suporte.
                </p>
              ) : null}
              {!expired && verifyState === "success" ? (
                <p
                  className={`${styles["px-hero__verify-note"]} ${styles["px-hero__verify-note--ok"]}`}
                  role="status"
                  aria-live="polite"
                >
                  Pagamento confirmado!
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <aside className={styles["px-hero__right"]}>
          <h4 className={styles["px-hero__rh"]}>
            {items.length} {items.length === 1 ? "produto reservado" : "produtos reservados"}
          </h4>
          {items.map((item, index) => {
            const subtotal =
              item.subtotalCents != null
                ? item.subtotalCents
                : (item.unitPriceCents || 0) * item.quantity;
            return (
              <div
                className={styles["px-hero__item-line"]}
                key={`${item.productId || item.name}-${index}`}
              >
                <div className={styles["px-hero__sq"]} aria-hidden="true">
                  {monogram(item.name)}
                </div>
                <div className={styles["px-hero__item-text"]}>
                  <div className={styles["px-hero__item-name"]}>{item.name}</div>
                  <div className={styles["px-hero__item-qty"]}>
                    {item.quantity} {item.unit || "un"}
                  </div>
                </div>
                <div className={styles["px-hero__item-price"]}>{money.format(subtotal / 100)}</div>
              </div>
            );
          })}
          <div className={styles["px-hero__right-total"]}>
            <span>Total</span>
            <b>{money.format(totalCents / 100)}</b>
          </div>

          <h4 className={`${styles["px-hero__rh"]} ${styles["px-hero__rh--mt"]}`}>
            Linha do tempo
          </h4>
          <OrderTimeline current="awaiting-payment" subtitles={subtitles} />
        </aside>
      </div>
    </section>
  );
}
