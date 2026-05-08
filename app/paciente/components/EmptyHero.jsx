"use client";

import styles from "./EmptyHero.module.css";

/**
 * Empty pedido state. Renders the hero shown when the patient is logged in
 * with privacy consent but has nothing in cart and no open order.
 *
 * Pure presentational. Click handlers come from PatientPortal.
 */
export default function EmptyHero({ patientName, onOpenCatalog, onOpenProfile, disabled }) {
  return (
    <section className={`frame ${styles["px-empty"]}`} aria-label="Pedido vazio">
      <div className={styles["px-empty__head"]}>
        <span className="overline">Proxima acao</span>
        <h2>Monte seu pedido autorizado</h2>
        <p className="muted">
          {patientName ? `${patientName}, escolha ` : "Escolha "}
          somente produtos liberados pela associacao. A reserva no estoque acontece no servidor
          quando o Pix e gerado.
        </p>
      </div>
      <div className={styles["px-empty__actions"]}>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onOpenCatalog}
          disabled={disabled}
        >
          Abrir catalogo autorizado
        </button>
        <button type="button" className="btn btn--ghost" onClick={onOpenProfile}>
          Meu perfil
        </button>
      </div>
    </section>
  );
}
