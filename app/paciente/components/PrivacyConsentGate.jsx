"use client";

import styles from "./PrivacyConsentGate.module.css";

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

/**
 * LGPD consent panel. E2E asserts:
 *   #privacy-consent-panel contains "Privacidade e LGPD"
 *   pre-consent: "Autorizar uso dos dados"
 *   post-consent: "Consentimento registrado"
 *   button[type=submit] inside accepts the consent.
 */
export default function PrivacyConsentGate({ patient, busy, onSubmit }) {
  const accepted = Boolean(patient?.privacyConsentAt);
  return (
    <section
      id="privacy-consent-panel"
      className={`${styles["px-consent"]} ${accepted ? styles["good"] : styles["warn"]}`}
    >
      {accepted ? (
        <>
          <span className="overline">Privacidade e LGPD</span>
          <h3>Consentimento registrado</h3>
          <p className="muted">
            Versao {patient?.privacyConsentVersion || "lgpd-2026-05"} aceita em{" "}
            {formatDateTime(patient?.privacyConsentAt)}.
          </p>
        </>
      ) : (
        <form onSubmit={onSubmit}>
          <span className="overline">Privacidade e LGPD</span>
          <h3>Autorizar uso dos dados para atendimento</h3>
          <p className="muted">
            Usamos cadastro, receita, pedidos e mensagens apenas para elegibilidade, preparo,
            pagamento, envio e suporte da associacao.
          </p>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            Aceitar e continuar
          </button>
        </form>
      )}
    </section>
  );
}
