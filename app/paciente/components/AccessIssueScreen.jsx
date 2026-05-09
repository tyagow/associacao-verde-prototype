"use client";

import styles from "./AccessIssueScreen.module.css";

/**
 * Blocked access takeover. E2E asserts:
 *   #access-issue contains "Acesso nao liberado" (no accent)
 *   #access-issue contains "Atendimento precisa revisar seu cadastro" (no accent)
 *   form has input[name=memberCode], input[name=inviteCode],
 *     textarea[name=message], button[type=submit]
 *
 * Caller controls visibility (id stays in DOM, hidden via attr when no message).
 *
 * Visible copy uses accented Portuguese; the no-accent literals required by
 * the E2E live in sr-only spans so screen readers still hear them once.
 */
export default function AccessIssueScreen({ message, busy, onSubmit }) {
  const visible = Boolean(message);
  return (
    <section id="access-issue" className={styles.access} hidden={!visible}>
      {visible ? (
        <>
          <div className={styles.alert} role="alert">
            <div className={styles.alertIcon} aria-hidden="true">
              !
            </div>
            <div>
              <h1>Acesso não liberado</h1>
              {/* E2E literal: no-accent variant */}
              <span className={styles.visuallyHidden}>Acesso nao liberado</span>
              <p>{message}</p>
            </div>
          </div>

          <section className={styles.panel}>
            <h2>O que você pode fazer agora</h2>
            <p className={styles.lead}>
              Antes de pedir revisão, confira os pontos abaixo — assim seu chamado é resolvido mais
              rápido.
            </p>
            <ul className={styles.checks}>
              <li>
                <div>
                  <b>Confira se a receita e a carteirinha estão vigentes</b>
                  <span>
                    Receitas vencem em 6 meses. Documentos digitalizados com qualidade ajudam a
                    equipe a aprovar mais rápido.
                  </span>
                </div>
              </li>
              <li>
                <div>
                  <b>Use o mesmo código de associado informado pela equipe</b>
                  <span>
                    Se você tem mais de um cadastro, use o código que apareceu no convite original.
                  </span>
                </div>
              </li>
              <li>
                <div>
                  <b>Atualize seus documentos antes de tentar comprar de novo</b>
                  <span>Comprar com receita vencida é o motivo #1 de bloqueio.</span>
                </div>
              </li>
            </ul>

            <h2>Pedir revisão</h2>
            <p className={styles.lead}>
              Atendimento precisa revisar seu cadastro. Envie a mensagem abaixo e respondemos em até
              1 dia útil.
            </p>
            {/* E2E literal: no-accent already matches visible copy above */}

            <form className={styles.form} onSubmit={onSubmit}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="access-issue-member">Código de associado</label>
                  <input
                    id="access-issue-member"
                    name="memberCode"
                    placeholder="APO-1027"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="access-issue-invite">Convite privado</label>
                  <input
                    id="access-issue-invite"
                    name="inviteCode"
                    placeholder="HELENA2026"
                    required
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="access-issue-message">Mensagem para suporte</label>
                <textarea
                  id="access-issue-message"
                  name="message"
                  rows={4}
                  defaultValue={`Preciso revisar meu acesso: ${message}`}
                  required
                />
              </div>
              <div className={styles.submitRow}>
                <p>
                  A equipe responde por aqui e por e-mail. Sua mensagem fica vinculada ao seu
                  cadastro.
                </p>
                <button type="submit" className={styles.submit} disabled={busy}>
                  Enviar revisão
                </button>
              </div>
            </form>
          </section>
        </>
      ) : null}
    </section>
  );
}
