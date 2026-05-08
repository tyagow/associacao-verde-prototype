"use client";

import styles from "./CartHero.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Cart-with-items summary, rendered inside the #cart-summary container.
 * E2E asserts the literal text "Resumo antes do Pix" appears here.
 */
export default function CartHero({ items, total, count, onRemove }) {
  return (
    <section className={`panel ${styles["px-cart"]}`} aria-label="Resumo do pedido">
      <header className={styles["px-cart__head"]}>
        <span className="overline">Resumo antes do Pix</span>
        <h3>{count} item(ns) selecionado(s)</h3>
        <p className="muted">
          Ao gerar Pix, o servidor reserva o estoque ate o vencimento do pagamento.
        </p>
      </header>
      <ul className={styles["px-cart__lines"]}>
        {items.map(({ product, quantity, subtotalCents }) => (
          <li key={product.id} className={styles["px-cart__line"]}>
            <div className={styles["px-cart__line-main"]}>
              <strong>
                {quantity} {product.unit} · {product.name}
              </strong>
              <span className={styles["px-cart__line-price"]}>
                {money.format(subtotalCents / 100)}
              </span>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onRemove(product.id)}
              aria-label={`Remover ${product.name} do pedido`}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      <footer className={styles["px-cart__total"]}>
        <span>Total estimado</span>
        <strong>{money.format(total / 100)}</strong>
      </footer>
    </section>
  );
}
