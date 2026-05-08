"use client";

import { useEffect, useMemo, useState } from "react";
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

// Deterministic placeholder QR pattern. Hashes the input to a 21x21 grid of
// modules with the standard three finder patterns. Visually evokes a QR for
// the hero; real QR encoding can be swapped in via qrcode.react later without
// touching the consumer.
function PixQrPlaceholder({ value }) {
  const SIZE = 21;
  const grid = useMemo(() => buildPattern(value, SIZE), [value]);
  const cell = 100 / SIZE;
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="QR code Pix (representacao visual)"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" fill="#fff" />
      {grid.flatMap((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              key={`${x}-${y}`}
              x={x * cell}
              y={y * cell}
              width={cell}
              height={cell}
              fill="#0d1f17"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

function buildPattern(seed, size) {
  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  // Seeded pseudo-random fill
  let h = 2166136261;
  const src = String(seed || "PIX");
  for (let i = 0; i < src.length; i += 1) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  function rand() {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      grid[y][x] = rand() > 0.55;
    }
  }
  // Three finder patterns at top-left, top-right, bottom-left (7x7).
  const corners = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
  for (const [cx, cy] of corners) {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const onBorder = x === 0 || x === 6 || y === 0 || y === 6;
        const inCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[cy + y][cx + x] = onBorder || inCenter;
      }
    }
    // separator
    for (let i = 0; i < 8; i += 1) {
      if (cy + 7 < size && cx + i < size) grid[cy + 7][cx + i] = false;
      if (cx + 7 < size && cy + i < size) grid[cy + i][cx + 7] = false;
      if (cy - 1 >= 0 && cx + i < size) grid[cy - 1][cx + i] = false;
      if (cx - 1 >= 0 && cy + i < size) grid[cy + i][cx - 1] = false;
    }
  }
  return grid;
}

export default function PixHero({ order, onMarkPaid, onCopyPix }) {
  const expiresAt = order?.paymentExpiresAt;
  const [secondsLeft, setSecondsLeft] = useState(() => computeSecondsLeft(expiresAt));

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
                {money.format(((item.priceCents || 0) * item.quantity) / 100)}
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
            <PixQrPlaceholder value={copia || order?.id || "pix"} />
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
