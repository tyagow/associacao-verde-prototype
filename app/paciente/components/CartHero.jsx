"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CartHero.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const DEFAULT_DELIVERY_OPTIONS = [
  "GED Log via Melhor Envio",
  "Correios via Melhor Envio",
  "Retirada combinada",
];

function lineMonogram(name) {
  const tokens = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length >= 2) return `${tokens[0][0] || ""}${tokens[1][0] || ""}`.toUpperCase();
  return String(name || "AB")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Right-rail cart summary. Owns the #cart-summary container.
 *
 * Always renders the kicker "Resumo antes do Pix" (visually hidden in the
 * filled state) so the E2E selector remains green in both states.
 *
 * - count === 0  -> empty layout with disabled gold-soft CTA.
 * - count > 0    -> line items, totals, ink "Gerar Pix" CTA.
 */
export default function CartHero({
  items = [],
  total = 0,
  count = 0,
  onRemove,
  onIncrement,
  onDecrement,
  onGenerate,
  deliveryMethod,
  deliveryOptions = DEFAULT_DELIVERY_OPTIONS,
  onDeliveryChange,
  shippingAddress,
  onShippingAddressChange,
  addressMissing = false,
  sticky = true,
  busy = false,
}) {
  const isEmpty = count === 0 || items.length === 0;
  const requiresAddress = !/Retirada/i.test(deliveryMethod || "");
  const addr = shippingAddress || {};
  const setAddrField = (field) => (event) =>
    onShippingAddressChange?.({ ...addr, [field]: event.target.value });

  // Hard validation: which required address fields are still empty? The
  // submit button is disabled until all of these are filled, AND we surface
  // an aria-live error pointing at the first missing field. This replaces
  // the prior "click → toast" soft block.
  const REQUIRED_ADDRESS_FIELDS = [
    { key: "cep", label: "CEP" },
    { key: "street", label: "logradouro" },
    { key: "number", label: "numero" },
    { key: "neighborhood", label: "bairro" },
    { key: "city", label: "cidade" },
    { key: "state", label: "UF" },
  ];
  const missingAddressFields = requiresAddress
    ? REQUIRED_ADDRESS_FIELDS.filter((field) => !String(addr[field.key] || "").trim())
    : [];
  const firstMissing = missingAddressFields[0] || null;
  const canGeneratePix = !isEmpty && !busy && missingAddressFields.length === 0;

  // Address fieldset is collapsed by default to match the b2.html mock, which
  // shows only the entrega <select> in the right rail. We auto-open the
  // <details> when the parent flags `addressMissing` (i.e. the user clicked
  // Gerar Pix and a required field was empty). User can also toggle manually.
  const [addressOpen, setAddressOpen] = useState(false);
  const [cepLookupState, setCepLookupState] = useState("idle"); // idle | loading | ok | error
  useEffect(() => {
    if (addressMissing) setAddressOpen(true);
  }, [addressMissing]);

  // Pin latest addr + handler in refs so the CEP effect can depend solely
  // on the CEP string. Without this we'd either suppress react-hooks/
  // exhaustive-deps or refetch on every keystroke.
  const addrRef = useRef(addr);
  const onShippingAddressChangeRef = useRef(onShippingAddressChange);
  useEffect(() => {
    addrRef.current = addr;
    onShippingAddressChangeRef.current = onShippingAddressChange;
  });

  // CEP autocomplete via viacep.com.br. Debounced 250ms; aborts in-flight
  // requests when the CEP changes again or the component unmounts. Only
  // fills empty fields so we never overwrite typed/saved values.
  useEffect(() => {
    const raw = String(addr.cep || "").replace(/\D/g, "");
    if (raw.length !== 8) {
      setCepLookupState((current) => (current === "idle" ? current : "idle"));
      return undefined;
    }
    const controller = new AbortController();
    const debounceId = window.setTimeout(() => {
      setCepLookupState("loading");
      fetch(`https://viacep.com.br/ws/${raw}/json/`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(response)))
        .then((data) => {
          if (!data || data.erro) {
            setCepLookupState("error");
            return;
          }
          const current = addrRef.current || {};
          const next = { ...current };
          let changed = false;
          const fill = (key, value) => {
            if (!next[key] && value) {
              next[key] = value;
              changed = true;
            }
          };
          fill("street", data.logradouro);
          fill("neighborhood", data.bairro);
          fill("city", data.localidade);
          fill("state", (data.uf || "").toUpperCase());
          if (changed && onShippingAddressChangeRef.current) {
            onShippingAddressChangeRef.current(next);
          }
          setCepLookupState("ok");
        })
        .catch((error) => {
          // AbortError fires on unmount / debounce reset — not user-visible.
          if (error?.name === "AbortError") return;
          setCepLookupState("error");
        });
    }, 250);
    return () => {
      window.clearTimeout(debounceId);
      controller.abort();
    };
  }, [addr.cep]);
  // If the cart has items and the address is incomplete, open the fieldset
  // automatically — the patient cannot generate Pix until they fill it, so
  // there is no value in keeping it collapsed.
  useEffect(() => {
    if (!isEmpty && requiresAddress && missingAddressFields.length > 0) {
      setAddressOpen(true);
    }
  }, [isEmpty, requiresAddress, missingAddressFields.length]);

  return (
    <aside
      id="cart-summary"
      className={`${styles.cart} ${sticky ? styles.sticky : ""}`}
      aria-label="Resumo do pedido"
    >
      {/* Always present so the E2E literal is reachable in both states. */}
      <span className={styles.kicker}>Resumo antes do Pix</span>

      {isEmpty ? (
        <>
          <header className={styles.head}>
            <h3 className={styles.title}>Resumo do pedido</h3>
            <p className={styles.lead}>Reserva so acontece quando o Pix e gerado.</p>
          </header>
          <div className={styles.emptyBlock}>
            <div className={styles.emptyIcon} aria-hidden="true">
              <span>&#128722;</span>
            </div>
            <h3 className={styles.emptyTitle}>Carrinho vazio</h3>
            <p className={styles.emptyHelper}>Adicione itens do catalogo ao lado.</p>
          </div>
        </>
      ) : (
        <>
          <header className={styles.head}>
            <h3 className={styles.title}>
              Resumo do pedido <span className={styles.count}>{count} itens</span>
            </h3>
            <p className={styles.lead}>Reserva de estoque acontece quando o Pix e gerado.</p>
          </header>

          <ul className={styles.lines}>
            {items.map(({ product, quantity, subtotalCents }) => (
              <li key={product.id} className={styles.line}>
                <div
                  className={styles.sq}
                  aria-hidden="true"
                  style={product.thumbStyle ? { background: product.thumbStyle } : undefined}
                >
                  {lineMonogram(product.name)}
                </div>
                <div className={styles.lineMain}>
                  <div className={styles.nm}>{product.name}</div>
                  <div className={styles.mt}>
                    <span className={styles.mtNums}>
                      {quantity}&times; {money.format(product.priceCents / 100)}
                    </span>
                    {onDecrement ? (
                      <button
                        type="button"
                        className={styles.stepBtn}
                        onClick={() => onDecrement(product.id)}
                        aria-label={`Diminuir ${product.name}`}
                      >
                        &minus;
                      </button>
                    ) : null}
                    {onIncrement ? (
                      <button
                        type="button"
                        className={styles.stepBtn}
                        onClick={() => onIncrement(product.id)}
                        aria-label={`Aumentar ${product.name}`}
                      >
                        +
                      </button>
                    ) : null}
                    {onRemove ? (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => onRemove(product.id)}
                        aria-label={`Remover ${product.name}`}
                      >
                        remover
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className={styles.pr}>{money.format(subtotalCents / 100)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className={styles.ship}>
        <label className={styles.shipLabel} htmlFor="cart-delivery-method">
          Entrega
        </label>
        <select
          id="cart-delivery-method"
          name="deliveryMethod"
          value={deliveryMethod || deliveryOptions[0]}
          onChange={(event) => onDeliveryChange?.(event.target.value)}
          className={styles.shipSelect}
        >
          {deliveryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        {requiresAddress ? (
          <details
            id="shipping-address"
            className={styles.addressDetails}
            open={addressOpen}
            onToggle={(event) => setAddressOpen(event.currentTarget.open)}
          >
            <summary className={styles.addressSummary}>
              <span className={styles.shipLabel}>Endereco de entrega</span>
              <span className={styles.addressSummaryHint} aria-hidden="true">
                {addressOpen ? "fechar" : "abrir"}
              </span>
            </summary>
            <fieldset className={styles.addressFieldset} aria-label="Endereco de entrega">
              <div className={styles.addressGrid}>
                <label className={styles.addressCep}>
                  CEP
                  <input
                    name="cep"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    required={!isEmpty}
                    placeholder="00000-000"
                    aria-describedby="cep-status"
                    value={addr.cep || ""}
                    onChange={setAddrField("cep")}
                  />
                  <span id="cep-status" className={styles.cepStatus} aria-live="polite">
                    {cepLookupState === "loading"
                      ? "Buscando endereco..."
                      : cepLookupState === "error"
                        ? "CEP nao encontrado. Preencha manualmente."
                        : cepLookupState === "ok"
                          ? "Endereco preenchido pelo CEP."
                          : ""}
                  </span>
                </label>
                <label className={styles.addressStreet}>
                  Logradouro
                  <input
                    name="street"
                    autoComplete="address-line1"
                    required={!isEmpty}
                    placeholder="Rua, Avenida"
                    value={addr.street || ""}
                    onChange={setAddrField("street")}
                  />
                </label>
                <label className={styles.addressNumber}>
                  Numero
                  <input
                    name="number"
                    required={!isEmpty}
                    placeholder="123"
                    value={addr.number || ""}
                    onChange={setAddrField("number")}
                  />
                </label>
                <label className={styles.addressComplement}>
                  Complemento
                  <input
                    name="complement"
                    placeholder="Apto, bloco (opcional)"
                    value={addr.complement || ""}
                    onChange={setAddrField("complement")}
                  />
                </label>
                <label className={styles.addressNeighborhood}>
                  Bairro
                  <input
                    name="neighborhood"
                    required={!isEmpty}
                    value={addr.neighborhood || ""}
                    onChange={setAddrField("neighborhood")}
                  />
                </label>
                <label className={styles.addressCity}>
                  Cidade
                  <input
                    name="city"
                    autoComplete="address-level2"
                    required={!isEmpty}
                    value={addr.city || ""}
                    onChange={setAddrField("city")}
                  />
                </label>
                <label className={styles.addressState}>
                  UF
                  <input
                    name="state"
                    autoComplete="address-level1"
                    maxLength={2}
                    required={!isEmpty}
                    placeholder="SP"
                    value={addr.state || ""}
                    onChange={setAddrField("state")}
                  />
                </label>
                <label className={styles.addressNotes}>
                  Observacoes
                  <input
                    name="notes"
                    placeholder="Ponto de referencia (opcional)"
                    value={addr.notes || ""}
                    onChange={setAddrField("notes")}
                  />
                </label>
              </div>
            </fieldset>
          </details>
        ) : null}
      </div>

      {isEmpty ? (
        <>
          <div className={styles.totalsEmpty}>
            <span>Total</span>
            <strong>{money.format(0)}</strong>
          </div>
          <button
            type="button"
            className={styles.ctaDisabled}
            disabled
            aria-disabled="true"
            aria-describedby="cart-hint"
          >
            Selecione produtos no catálogo
          </button>
          <p id="cart-hint" className={styles.cartHint}>
            Adicione itens no catálogo.
          </p>
        </>
      ) : (
        <>
          <div className={styles.totals}>
            <div className={styles.totalsRow}>
              <span>Subtotal</span>
              <span>{money.format(total / 100)}</span>
            </div>
            <div className={styles.totalsRow}>
              <span>Frete</span>
              <span>calculado no Pix</span>
            </div>
            <div className={`${styles.totalsRow} ${styles.totalsTotal}`}>
              <span>Total estimado</span>
              <strong>{money.format(total / 100)}</strong>
            </div>
          </div>
          {/* aria-live error region: announces the first missing required
              address field so screen readers + sighted users get the same
              hint. The wrapper is always rendered (empty when ok) so SR
              users on iOS/VoiceOver pick up updates without re-render glitches. */}
          <div
            id="cart-address-error"
            className={styles.addressError}
            role="status"
            aria-live="polite"
          >
            {firstMissing ? `Preencha ${firstMissing.label} antes de gerar o Pix.` : ""}
          </div>
          <button
            type="submit"
            className={styles.cta}
            onClick={onGenerate}
            disabled={!canGeneratePix}
            aria-describedby={firstMissing ? "cart-address-error" : undefined}
          >
            Gerar Pix{" "}
            <span className={styles.ctaArrow} aria-hidden="true">
              &rarr;
            </span>
          </button>
          <p className={styles.reassure}>
            Ao gerar Pix, <b>o estoque e reservado</b> ate o vencimento do pagamento. Sem cobranca
            em duplicidade.
          </p>
        </>
      )}
    </aside>
  );
}
