"use client";

import styles from "./SupportThread.module.css";

/**
 * Suporte tab content. Preserves E2E selectors:
 *   #support-request-form, input[name=subject], textarea[name=message],
 *   button[type=submit]
 */
export default function SupportThread({ busy, hasPrivacyConsent, latestOrder, onSubmit }) {
  return (
    <section className={styles["px-support"]} hidden={!hasPrivacyConsent}>
      <form
        id="support-request-form"
        className={`panel ${styles["px-support__form"]}`}
        onSubmit={onSubmit}
      >
        <div className={styles["px-support__head"]}>
          <span className="overline">Solicitar atendimento</span>
          <h3>Fale com a equipe sobre cadastro, Pix, receita ou entrega</h3>
          <p className="muted">
            Use este canal quando a proxima acao do pedido ou a elegibilidade precisar de revisao
            humana.
          </p>
        </div>
        <label className={styles["px-support__field"]}>
          Assunto
          <input name="subject" placeholder="Renovar receita, duvida sobre Pix..." required />
        </label>
        <label className={styles["px-support__field"]}>
          Prioridade
          <select name="priority" defaultValue="normal">
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </label>
        <label className={`${styles["px-support__field"]} ${styles["wide"]}`}>
          Mensagem
          <textarea
            name="message"
            rows={4}
            placeholder="Descreva o que precisa ser revisado pela equipe."
            required
          />
        </label>
        {latestOrder ? <input type="hidden" name="relatedOrderId" value={latestOrder.id} /> : null}
        <button className="btn btn--primary" type="submit" disabled={busy}>
          Enviar ao suporte
        </button>
      </form>
    </section>
  );
}
