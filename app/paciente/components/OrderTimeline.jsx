"use client";

import styles from "./OrderTimeline.module.css";

const STAGES = [
  { key: "pix-generated", label: "Pix gerado" },
  { key: "awaiting-payment", label: "Aguardando pagamento" },
  { key: "confirmed", label: "Pagamento confirmado" },
  { key: "picking", label: "Em separacao" },
  { key: "shipped", label: "Enviado" },
];

export default function OrderTimeline({ current = "awaiting-payment" }) {
  const currentIndex = Math.max(
    0,
    STAGES.findIndex((stage) => stage.key === current),
  );

  return (
    <ol className={styles["px-timeline"]} aria-label="Linha do tempo do pedido">
      {STAGES.map((stage, index) => {
        const cls = [styles["px-stage"]];
        if (index < currentIndex) cls.push(styles["px-stage--done"]);
        else if (index === currentIndex) cls.push(styles["px-stage--current"]);
        return (
          <li
            key={stage.key}
            className={cls.join(" ")}
            aria-current={index === currentIndex ? "step" : undefined}
          >
            <strong>{stage.label}</strong>
          </li>
        );
      })}
    </ol>
  );
}
