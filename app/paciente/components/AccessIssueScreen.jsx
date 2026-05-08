"use client";

import styles from "./AccessIssueScreen.module.css";

/**
 * Blocked access takeover. E2E asserts:
 *   #access-issue contains "Acesso nao liberado"
 *   #access-issue contains "Atendimento precisa revisar seu cadastro"
 *   form has input[name=memberCode], input[name=inviteCode],
 *     textarea[name=message], button[type=submit]
 *
 * Caller controls visibility (id remains in DOM, hidden via attr when no message).
 */
export default function AccessIssueScreen({ message, busy, onSubmit }) {
  const visible = Boolean(message);
  return (
    <section id="access-issue" className={styles["px-access"]} hidden={!visible}>
      {visible ? (
        <>
          <span className={`pill danger ${styles["px-access__pill"]}`}>Acesso nao liberado</span>
          <h3>Atendimento precisa revisar seu cadastro</h3>
          <p>{message}</p>
          <ul>
            <li>Confira se a receita e a carteirinha estao vigentes.</li>
            <li>Use o mesmo codigo de associado informado pela equipe.</li>
            <li>
              Procure o suporte da associacao para atualizar documentos antes de tentar comprar.
            </li>
          </ul>
          <form className={styles["px-access__form"]} onSubmit={onSubmit}>
            <label>
              Codigo de associado
              <input name="memberCode" placeholder="APO-1027" required />
            </label>
            <label>
              Convite privado
              <input name="inviteCode" placeholder="HELENA2026" required />
            </label>
            <label className={styles["wide"]}>
              Mensagem para suporte
              <textarea
                name="message"
                rows={3}
                defaultValue={`Preciso revisar meu acesso: ${message}`}
                required
              />
            </label>
            <button className="btn btn--primary" type="submit" disabled={busy}>
              Enviar revisao
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}
