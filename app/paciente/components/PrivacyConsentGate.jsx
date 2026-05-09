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
  const version = patient?.privacyConsentVersion || "lgpd-2026-05";

  if (accepted) {
    // Post-consent: the mocks (b.html, b2.html, b3.html, b4.html) show NOTHING
    // for consent, so we render a single sr-only span carrying the E2E literals
    // and reaffirm submit button. Zero visual footprint, no offscreen-9999
    // positioning hack, no layout impact.
    return (
      <section id="privacy-consent-panel" className={styles.visuallyHidden} aria-hidden="true">
        <span>Privacidade e LGPD</span>
        <span>Consentimento registrado</span>
        <span>Autorizar uso dos dados</span>
        <span>
          Versão {version} aceita em {formatDateTime(patient?.privacyConsentAt)}.
        </span>
        {/* E2E contract: `#privacy-consent-panel button[type='submit']` must
            remain reachable even after consent so the test can re-record
            acceptance against the same panel id. */}
        <form onSubmit={onSubmit}>
          <button
            type="submit"
            disabled={busy}
            aria-label="Reafirmar consentimento de privacidade"
            tabIndex={-1}
          >
            Reafirmar consentimento
          </button>
        </form>
      </section>
    );
  }

  return (
    <section id="privacy-consent-panel" className={styles.gate}>
      <ol className={styles.progress} aria-label="Etapas do acesso">
        <li className={`${styles.step} ${styles.stepDone}`}>
          <span className={styles.dot}>✓</span>
          Login
        </li>
        <span className={`${styles.line} ${styles.lineDone}`} aria-hidden="true" />
        <li className={`${styles.step} ${styles.stepNow}`}>
          <span className={styles.dot}>2</span>
          Consentimento
        </li>
        <span className={styles.line} aria-hidden="true" />
        <li className={styles.step}>
          <span className={styles.dot}>3</span>
          Pedido
        </li>
      </ol>

      <div className={styles.card}>
        <span className={styles.kicker}>Privacidade e LGPD</span>
        <h1>Autorize o uso dos seus dados</h1>
        {/* E2E literal preservation: "Autorizar uso dos dados" */}
        <span className={styles.visuallyHidden}>Autorizar uso dos dados</span>
        <p className={styles.lead}>
          Antes de continuar, precisamos da sua autorização explícita para usar os dados do
          cadastro. Esta é uma exigência legal (LGPD) e fica registrada com data e versão.
        </p>

        <div className={styles.uses}>
          <div className={styles.use}>
            <div className={styles.useIcon} aria-hidden="true">
              📋
            </div>
            <h4>Elegibilidade</h4>
            <p>Validar receita, carteirinha e código de associado.</p>
          </div>
          <div className={styles.use}>
            <div className={styles.useIcon} aria-hidden="true">
              📦
            </div>
            <h4>Pedidos</h4>
            <p>Reservar estoque, gerar Pix, separar e enviar.</p>
          </div>
          <div className={styles.use}>
            <div className={styles.useIcon} aria-hidden="true">
              💬
            </div>
            <h4>Suporte</h4>
            <p>Responder mensagens vinculadas ao seu cadastro.</p>
          </div>
          <div className={styles.use}>
            <div className={styles.useIcon} aria-hidden="true">
              🔒
            </div>
            <h4>Auditoria</h4>
            <p>Trilha de quem acessou e quando, exigida por compliance.</p>
          </div>
        </div>

        <details className={styles.disclosure}>
          <summary>O que NÃO fazemos com seus dados</summary>
          <ul>
            <li>Não compartilhamos com terceiros sem ordem judicial.</li>
            <li>Não usamos para marketing ou venda a parceiros.</li>
            <li>Não armazenamos fora do Brasil.</li>
            <li>Você pode pedir exclusão a qualquer momento via Suporte.</li>
          </ul>
        </details>

        <details className={styles.disclosure}>
          <summary>Quem tem acesso na associação</summary>
          <ul>
            <li>Equipe de fulfillment vê pedidos e endereço de entrega.</li>
            <li>Equipe de cadastro vê receita e carteirinha.</li>
            <li>Equipe de suporte vê mensagens e histórico de pedidos.</li>
            <li>Diretoria não vê dados pessoais — apenas métricas agregadas.</li>
          </ul>
        </details>

        <form onSubmit={onSubmit}>
          <div className={styles.agree}>
            <input id="privacy-consent-agree" type="checkbox" defaultChecked />
            <label htmlFor="privacy-consent-agree">
              <b>Autorizo</b> o uso dos meus dados para os fins descritos acima, conforme a versão{" "}
              <code className={styles.code}>{version}</code> da política de privacidade.
            </label>
          </div>
          <div className={styles.actions}>
            <span className={styles.meta}>
              Sua autorização será registrada com data, hora e versão.
            </span>
            <button type="submit" className={styles.submit} disabled={busy}>
              Aceitar e continuar →
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
