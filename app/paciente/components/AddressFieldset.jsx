"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AddressFieldset.module.css";

/**
 * AddressFieldset — controlled address form with debounced ViaCEP autocomplete.
 *
 * Extracted from CartHero so the same fieldset can be embedded in the cart
 * (sticky right rail) and in the Perfil tab's "Editar endereço" panel.
 *
 * Field name attributes (cep, street, number, complement, neighborhood, city,
 * state, notes) are preserved verbatim so any E2E selector that matched the
 * cart fieldset keeps working.
 *
 * Props:
 *   value                  current address shape (object)
 *   onChange(next)         called with the merged next address on every edit
 *                          AND when ViaCEP fills empty fields
 *   busy                   disables inputs (used during a parent save)
 *   idPrefix               optional unique prefix for input ids — required
 *                          when two AddressFieldsets share a page (e.g.
 *                          cart + perfil at once) so aria-describedby and
 *                          <label htmlFor> remain unique
 *   autoFocusFirstEmpty    on mount, focus the first empty REQUIRED field
 *   required               whether the fields are required (default true)
 */
export default function AddressFieldset({
  value,
  onChange,
  busy = false,
  idPrefix = "address",
  autoFocusFirstEmpty = false,
  required = true,
}) {
  const addr = value || {};
  const setField = (field) => (event) => onChange?.({ ...addr, [field]: event.target.value });
  const [cepLookupState, setCepLookupState] = useState("idle");

  // Pin the latest value + handler in refs so the CEP-lookup effect can
  // depend solely on the CEP string. Without this we would either suppress
  // exhaustive-deps or refetch on every keystroke in any other field.
  const addrRef = useRef(addr);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    addrRef.current = addr;
    onChangeRef.current = onChange;
  });

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
          const fill = (key, raw2) => {
            if (!next[key] && raw2) {
              next[key] = raw2;
              changed = true;
            }
          };
          fill("street", data.logradouro);
          fill("neighborhood", data.bairro);
          fill("city", data.localidade);
          fill("state", (data.uf || "").toUpperCase());
          if (changed && onChangeRef.current) onChangeRef.current(next);
          setCepLookupState("ok");
        })
        .catch((error) => {
          if (error?.name === "AbortError") return;
          setCepLookupState("error");
        });
    }, 250);
    return () => {
      window.clearTimeout(debounceId);
      controller.abort();
    };
  }, [addr.cep]);

  // Focus the first empty required field on mount, when requested. Used by
  // the Perfil edit panel so opening the panel drops the cursor where the
  // patient most likely needs to start typing (or on CEP for new users).
  const cepRef = useRef(null);
  const streetRef = useRef(null);
  const numberRef = useRef(null);
  const neighborhoodRef = useRef(null);
  const cityRef = useRef(null);
  const stateRef = useRef(null);
  useEffect(() => {
    if (!autoFocusFirstEmpty) return;
    const order = [
      [addr.cep, cepRef],
      [addr.street, streetRef],
      [addr.number, numberRef],
      [addr.neighborhood, neighborhoodRef],
      [addr.city, cityRef],
      [addr.state, stateRef],
    ];
    const target = order.find(([v]) => !String(v || "").trim());
    if (target?.[1]?.current) target[1].current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusFirstEmpty]);

  const cepStatusId = `${idPrefix}-cep-status`;

  return (
    <fieldset className={styles.fieldset} aria-label="Endereco de entrega" disabled={busy}>
      <div className={styles.grid}>
        <label className={styles.cep}>
          CEP
          <input
            ref={cepRef}
            name="cep"
            inputMode="numeric"
            autoComplete="postal-code"
            required={required}
            placeholder="00000-000"
            aria-describedby={cepStatusId}
            value={addr.cep || ""}
            onChange={setField("cep")}
          />
          <span id={cepStatusId} className={styles.cepStatus} aria-live="polite">
            {cepLookupState === "loading"
              ? "Buscando endereco..."
              : cepLookupState === "error"
                ? "CEP nao encontrado. Preencha manualmente."
                : cepLookupState === "ok"
                  ? "Endereco preenchido pelo CEP."
                  : ""}
          </span>
        </label>
        <label className={styles.street}>
          Logradouro
          <input
            ref={streetRef}
            name="street"
            autoComplete="address-line1"
            required={required}
            placeholder="Rua, Avenida"
            value={addr.street || ""}
            onChange={setField("street")}
          />
        </label>
        <label className={styles.number}>
          Numero
          <input
            ref={numberRef}
            name="number"
            required={required}
            placeholder="123"
            value={addr.number || ""}
            onChange={setField("number")}
          />
        </label>
        <label className={styles.complement}>
          Complemento
          <input
            name="complement"
            placeholder="Apto, bloco (opcional)"
            value={addr.complement || ""}
            onChange={setField("complement")}
          />
        </label>
        <label className={styles.neighborhood}>
          Bairro
          <input
            ref={neighborhoodRef}
            name="neighborhood"
            required={required}
            value={addr.neighborhood || ""}
            onChange={setField("neighborhood")}
          />
        </label>
        <label className={styles.city}>
          Cidade
          <input
            ref={cityRef}
            name="city"
            autoComplete="address-level2"
            required={required}
            value={addr.city || ""}
            onChange={setField("city")}
          />
        </label>
        <label className={styles.state}>
          UF
          <input
            ref={stateRef}
            name="state"
            autoComplete="address-level1"
            maxLength={2}
            required={required}
            placeholder="SP"
            value={addr.state || ""}
            onChange={setField("state")}
          />
        </label>
        <label className={styles.notes}>
          Observacoes
          <input
            name="notes"
            placeholder="Ponto de referencia (opcional)"
            value={addr.notes || ""}
            onChange={setField("notes")}
          />
        </label>
      </div>
    </fieldset>
  );
}
