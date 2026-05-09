"use client";

import Brand from "../../components/Brand";
import AccessIssueScreen from "./AccessIssueScreen";
import styles from "./LoginScreen.module.css";

/**
 * Split-screen login for /paciente.
 *
 * Preserves the E2E contract:
 *   - <form id="patient-login"> with input[name=memberCode],
 *     input[name=inviteCode], button[type=submit].
 *   - When `accessIssueMessage` is set, the AccessIssueScreen renders
 *     below the login form with its own #access-issue selectors.
 */
export default function LoginScreen({ onSubmit, busy, accessIssueMessage = "", onAccessRecovery }) {
  // When the patient is blocked (access issue), the entire screen swaps to
  // the recovery flow per the b-blocked.html mockup. The login form is
  // suppressed but the AccessIssueScreen still renders the inline credentials
  // input, so the patient can submit a revisao request without re-typing.
  if (accessIssueMessage) {
    return (
      <div className={styles.shell}>
        <header className={styles.top}>
          <Brand />
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 99,
                background: "var(--paper-warm, #f7f1e6)",
                color: "var(--danger, #b8442f)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span aria-hidden="true">⚠</span> Acesso bloqueado
            </span>
            <a href="mailto:suporte@apoiarbrasil.org">Sair</a>
          </div>
        </header>
        <main style={{ padding: "32px 64px", maxWidth: 980, margin: "0 auto" }}>
          <AccessIssueScreen message={accessIssueMessage} busy={busy} onSubmit={onAccessRecovery} />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Brand />
        <a href="mailto:suporte@apoiarbrasil.org">Suporte da associação ↗</a>
      </header>

      <main className={styles.split}>
        <section className={styles.pitch} aria-label="Por que usar o portal">
          <div>
            <span className={styles.kicker}>Portal do Paciente</span>
            <h1>Sua receita, seus pedidos, em um só lugar</h1>
            <p>
              Acesse o catálogo autorizado pela associação, gere Pix com reserva de estoque e
              acompanhe a entrega — tudo com cadastro privado.
            </p>
            <ul className={styles.trust}>
              <li>
                <div>
                  <b>Estoque reservado quando o Pix é gerado</b>
                  Sem cobrança em duplicidade.
                </div>
              </li>
              <li>
                <div>
                  <b>Receita e carteirinha sempre visíveis</b>
                  Você sabe quando renovar antes que vença.
                </div>
              </li>
              <li>
                <div>
                  <b>Histórico privado e auditado</b>
                  Apenas a equipe da associação tem acesso.
                </div>
              </li>
            </ul>
          </div>
          <div className={styles.pitchFooter}>
            <span>© Apoiar Brasil 2026</span>
            <span>·</span>
            <span>LGPD-compliant</span>
            <span>·</span>
            <span>Operação privada</span>
          </div>
        </section>

        <section className={styles.formWrap}>
          <div className={styles.formStack}>
            <div className={styles.card}>
              <h2>Entrar com segurança</h2>
              <p className={styles.lead}>
                Use o código de associado e o convite privado enviados pela equipe.
              </p>

              <form id="patient-login" onSubmit={onSubmit}>
                <div className={styles.field}>
                  <label htmlFor="patient-login-member">Código de associado</label>
                  <input
                    id="patient-login-member"
                    name="memberCode"
                    autoComplete="username"
                    placeholder="APO-1027"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="patient-login-invite">
                    Convite privado
                    <span className={styles.hint}>enviado por e-mail/WhatsApp</span>
                  </label>
                  <input
                    id="patient-login-invite"
                    name="inviteCode"
                    autoComplete="one-time-code"
                    placeholder="HELENA2026"
                    required
                  />
                </div>
                <button type="submit" className={styles.submit} disabled={busy}>
                  Entrar →
                </button>
              </form>

              <div className={styles.bot}>
                <span>Não recebeu seu convite?</span>
                <a href="mailto:suporte@apoiarbrasil.org">Falar com a equipe</a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
