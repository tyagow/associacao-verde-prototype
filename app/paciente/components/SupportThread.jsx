"use client";

import { useState } from "react";
import styles from "./SupportThread.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const ORDER_STATUS_SHORT = {
  awaiting_payment: "Pix pendente",
  paid_pending_fulfillment: "pago",
  separating: "em separacao",
  ready_to_ship: "pronto para envio",
  sent: "enviado",
  payment_expired: "Pix expirado",
};

/**
 * Quick reasons. Each chip seeds Assunto + Prioridade. Defaults align with the
 * triage SLA (renovacao/Pix → alta; atrasado/cancelar → urgente; default → normal).
 */
const QUICK_REASONS = [
  { label: "Renovar receita", subject: "Renovar receita", priority: "high" },
  { label: "Pix nao confirmou", subject: "Pix nao confirmou", priority: "high" },
  { label: "Pedido atrasado", subject: "Pedido atrasado", priority: "urgent" },
  { label: "Trocar endereco", subject: "Trocar endereco de entrega", priority: "normal" },
  { label: "Cancelar pedido", subject: "Cancelar pedido", priority: "urgent" },
  { label: "Outro", subject: "", priority: "normal" },
];

const FAQ_LINKS = [
  "Pix expirou — o que fazer?",
  "Como renovar minha receita",
  "Posso retirar pessoalmente?",
  "Mudar forma de entrega",
  "Cancelar um pedido pago",
];

/**
 * Suporte tab content. Preserves E2E selectors:
 *   #support-request-form, input[name=subject], textarea[name=message],
 *   select[name=priority], hidden input[name=relatedOrderId], button[type=submit].
 */
export default function SupportThread({ busy, hasPrivacyConsent, latestOrder, onSubmit }) {
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");

  function applyReason(reason) {
    setSubject(reason.subject);
    setPriority(reason.priority);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit?.(event);
    // Keep parent in charge of resetting the form — it does so on success
    // via form.reset(), which also resets controlled inputs through their
    // default values. We reset local state defensively here too.
    setSubject("");
    setPriority("normal");
    setMessage("");
  }

  return (
    <section className={styles.support} hidden={!hasPrivacyConsent}>
      <header className={styles.pagehead}>
        <h1>Falar com a equipe</h1>
        <p className={styles.lead}>
          Use este canal para revisao de cadastro, problemas com Pix, renovacao de receita ou
          duvidas sobre entrega. Resposta em ate 1 dia util.
        </p>
      </header>

      <div className={styles.body}>
        <form
          id="support-request-form"
          className={styles.formCard}
          onSubmit={handleSubmit}
          noValidate
        >
          <h2 className={styles.formTitle}>Solicitar atendimento</h2>
          <p className={styles.formSub}>Escolha um motivo comum ou descreva o problema:</p>

          <div className={styles.quick} role="group" aria-label="Motivos comuns">
            {QUICK_REASONS.map((reason) => (
              <button
                key={reason.label}
                type="button"
                className={styles.quickBtn}
                onClick={() => applyReason(reason)}
              >
                {reason.label}
              </button>
            ))}
          </div>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Assunto</span>
              <input
                name="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Renovar receita, duvida sobre Pix..."
                required
              />
            </label>
            <label className={`${styles.field} ${styles.fieldNarrow}`}>
              <span className={styles.label}>Prioridade</span>
              <select
                name="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Mensagem</span>
            <textarea
              name="message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Descreva o que precisa ser revisado pela equipe."
              required
            />
            <span className={styles.hint}>
              Inclua datas, numeros de pedido (AV-…) e prints quando possivel.
            </span>
          </label>

          {latestOrder ? (
            <input type="hidden" name="relatedOrderId" value={latestOrder.id} />
          ) : null}

          <div className={styles.submitRow}>
            <p className={styles.submitMeta}>
              Resposta por aqui e por e-mail. A conversa fica vinculada ao seu cadastro.
            </p>
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              Enviar ao suporte
            </button>
          </div>
        </form>

        <aside className={styles.side}>
          {latestOrder ? (
            <div className={styles.sideCard}>
              <h3 className={styles.sideTitle}>Pedido recente</h3>
              <div className={styles.orderMini}>
                <b>
                  {latestOrder.id}
                  {ORDER_STATUS_SHORT[latestOrder.status]
                    ? ` · ${ORDER_STATUS_SHORT[latestOrder.status]}`
                    : ""}
                </b>
                <span className={styles.orderMiniSmall}>
                  {(latestOrder.items?.length || 0) + " "}
                  {latestOrder.items?.length === 1 ? "produto" : "produtos"} ·{" "}
                  <span className={styles.tabular}>
                    {money.format((latestOrder.totalCents || 0) / 100)}
                  </span>
                </span>
              </div>
              <p className={styles.orderMiniHint}>
                A mensagem sera vinculada automaticamente a este pedido.
              </p>
            </div>
          ) : null}

          <div className={styles.sideCard}>
            <h3 className={styles.sideTitle}>Perguntas frequentes</h3>
            <div className={styles.faq}>
              {FAQ_LINKS.map((label) => (
                <a key={label} href="#" className={styles.faqLink}>
                  <span>{label}</span>
                  <span aria-hidden="true" className={styles.faqArrow}>
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
