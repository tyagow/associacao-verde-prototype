"use client";

import { useEffect, useState } from "react";
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

export default function PixHero({ order, onMarkPaid, onCopyPix }) {
  const expiresAt = order?.paymentExpiresAt;
  const [secondsLeft, setSecondsLeft] = useState(() => computeSecondsLeft(expiresAt));
  const reduce = useReducedMotion();

  useEffect(() => {
    setSecondsLeft(computeSecondsLeft(expiresAt));
    if (!expiresAt) return undefined;
    const id = window.setInterval(() => {
      setSecondsLeft(computeSecondsLeft(expiresAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const expired = secondsLeft != null && secondsLeft <= 0;
  const copia = order?.pix?.copiaECola || "";
  const items = order?.items || [];
  const delivery = order?.deliveryMethod || "Entrega a combinar";
  const totalCents = order?.totalCents || 0;

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

  return (
    <section
      className={styles["px-hero"]}
      data-expired={expired ? "true" : "false"}
      data-reduce-motion={reduce ? "true" : "false"}
      aria-label="Pagamento Pix"
    >
      <header className={styles["px-hero__bar"]}>
        <strong>Proxima acao: pagar Pix</strong>
        <span>·</span>
        <span>{order?.id || "novo pedido"}</span>
        <span aria-hidden="true" style={{ flex: 1 }} />
        <span className={styles["px-hero__pill"]}>{expired ? "Pix expirado" : "Pix pendente"}</span>
      </header>

      <div className={styles["px-hero__headline"]}>
        <p className={styles["px-hero__amount"]}>
          {money.format(totalCents / 100)}
          <sup>BRL</sup>
        </p>
        <div className={styles["px-hero__countdown"]} aria-live="polite">
          <span>{expired ? "Vencido" : "Vence em"}</span>
          <strong>{formatCountdown(secondsLeft)}</strong>
        </div>
      </div>

      {expired ? (
        <p className={styles["px-hero__expired-note"]}>
          Pagamento expirado. Solicite um novo Pix para reservar estoque novamente.
        </p>
      ) : null}

      {items.length ? (
        <div className={styles["px-hero__section"]}>
          <p className={styles["px-hero__section-title"]}>Produtos reservados</p>
          {items.map((item, index) => (
            <div
              className={styles["px-hero__product"]}
              key={`${item.productId || item.name}-${index}`}
            >
              <div className={styles["px-hero__product-thumb"]} aria-hidden="true">
                AV
              </div>
              <div>
                <p className={styles["px-hero__product-name"]}>{item.name}</p>
                <p className={styles["px-hero__product-meta"]}>
                  {item.quantity} {item.unit || "un"}
                </p>
              </div>
              <span className={styles["px-hero__product-price"]}>
                {money.format(
                  (item.subtotalCents != null
                    ? item.subtotalCents
                    : (item.unitPriceCents || 0) * item.quantity) / 100,
                )}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles["px-hero__section"]}>
        <p className={styles["px-hero__section-title"]}>Entrega</p>
        <div className={styles["px-hero__frete"]}>
          <div>
            <span>Metodo</span>
            <strong>{delivery}</strong>
          </div>
          <div>
            <span>Reserva</span>
            <strong>{expired ? "Encerrada" : "Ativa ate o vencimento"}</strong>
          </div>
          <div>
            <span>Vencimento</span>
            <strong>
              {expiresAt
                ? new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Sao_Paulo",
                  }).format(new Date(expiresAt))
                : "sem data"}
            </strong>
          </div>
        </div>
      </div>

      <div className={styles["px-hero__section"]}>
        <p className={styles["px-hero__section-title"]}>Linha do tempo</p>
        <OrderTimeline current="awaiting-payment" />
      </div>

      <div className={styles["px-hero__section"]}>
        <p className={styles["px-hero__section-title"]}>Pague pelo Pix</p>
        <div className={styles["px-hero__qr-block"]}>
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
                aria-label="QR code Pix indisponivel"
              />
            )}
          </div>
          <p className={styles["px-hero__qr-hint"]}>
            Aponte a camera do app do banco ou copie o codigo abaixo.
          </p>
        </div>

        <div className={styles["px-hero__copy"]}>
          <textarea readOnly aria-label="Pix copia e cola" value={copia} />
        </div>

        <div className={styles["px-hero__actions"]}>
          <button
            className={styles["px-hero__btn"]}
            type="button"
            onClick={handleCopy}
            disabled={!copia}
          >
            Copiar Pix
          </button>
          <button
            className={`${styles["px-hero__btn"]} ${styles["px-hero__btn--primary"]}`}
            type="button"
            onClick={onMarkPaid}
            disabled={expired}
          >
            {expired ? "Solicitar novo Pix" : "Ja paguei, atualizar"}
          </button>
        </div>
      </div>
    </section>
  );
}
