"use client";

/* Cultivo — its own route.
   Owns the full cultivation funnel: planting → advance week → harvest →
   drying → stock. Hosts #cultivation-form, #cultivation-update-form, and
   the [data-cultivation-action] buttons (E2E selectors). StockRoute now
   only owns product + stock entry forms. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import TeamShell from "../components/TeamShell";
import PageHead from "../components/PageHead";
import StatusStrip from "../components/StatusStrip";
import CultivoPanel from "./components/CultivoPanel.jsx";
import { pluralize, pluralWord } from "../components/pluralize.js";

export default function CultivoRoute() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isTeam = session?.role === "team";

  const loadAll = useCallback(async () => {
    setError("");
    const [sessionPayload, dashboardPayload, ledgerPayload] = await Promise.all([
      api("/api/session"),
      api("/api/team/dashboard").catch(() => null),
      api("/api/team/inventory-ledger").catch(() => null),
    ]);
    setSession(sessionPayload.session || null);
    setDashboard(dashboardPayload || null);
    setLedger(ledgerPayload || null);
  }, []);

  useEffect(() => {
    let active = true;
    loadAll().catch((nextError) => {
      if (active) setError(nextError.message);
    });
    return () => {
      active = false;
    };
  }, [loadAll]);

  async function logout() {
    setBusy("logout");
    try {
      await api("/api/logout", { method: "POST" });
      setSession(null);
      setDashboard(null);
      setLedger(null);
    } finally {
      setBusy("");
    }
  }

  const products = useMemo(() => ledger?.products || [], [ledger]);
  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.name} (${p.availableStock} ${p.unit})`,
      })),
    [products],
  );
  // Action drawer can only act on non-stocked batches (stocked = funnel
  // complete; advance/harvest/dry/stock all reject). Filter the select
  // to actionable batches so the operator never picks a dead one and
  // hits an API rejection.
  const batchOptions = useMemo(
    () =>
      (dashboard?.cultivationBatches || [])
        .filter((batch) => batch.status !== "stocked")
        .map((batch) => ({
          value: batch.id,
          label: `${batch.strain} · semana ${batch.week} · ${stageLabel(batch.status)}`,
        })),
    [dashboard],
  );

  async function run(action, success, callback) {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      await callback();
      await loadAll();
      setMessage(success);
      return true;
    } catch (nextError) {
      setError(nextError.message);
      return false;
    } finally {
      setBusy("");
    }
  }

  async function submitCultivationCreate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    payload.plants = Number(payload.plants);
    payload.week = Number(payload.week);
    const ok = await run("cultivation-create", "Lote de cultivo criado.", async () => {
      await api("/api/team/cultivation-batches", { method: "POST", body: payload });
      form.reset();
    });
    // After a SUCCESSFUL create, pivot drawers so the operator lands on
    // the routine action with the batch they just made. On failure (api
    // error, validation), keep the create drawer open so they can fix
    // the form and retry.
    if (ok) {
      if (detailsCreateRef.current) detailsCreateRef.current.open = false;
      if (detailsActionRef.current) detailsActionRef.current.open = true;
    }
  }

  async function submitCultivationAction(action) {
    const form = document.querySelector("#cultivation-update-form");
    const data = Object.fromEntries(new FormData(form));
    const requestBody = { batchId: data.batchId };
    let path = "/api/team/cultivation-batches/advance";
    if (action === "harvest") {
      path = "/api/team/cultivation-batches/harvest";
      requestBody.harvested = Number(data.amount);
    }
    if (action === "dry") {
      path = "/api/team/cultivation-batches/dry";
      requestBody.dried = Number(data.amount);
    }
    if (action === "stock") {
      path = "/api/team/cultivation-batches/stock";
      requestBody.productId = data.productId;
    }
    await run(`cultivation-${action}`, "Lote de cultivo atualizado.", async () => {
      await api(path, { method: "POST", body: requestBody });
    });
  }

  const batches = useMemo(() => dashboard?.cultivationBatches || [], [dashboard]);
  const totals = useMemo(() => {
    const all = batches;
    const growing = all.filter((b) => b.status === "growing").length;
    const harvested = all.filter((b) => b.status === "harvested").length;
    const dried = all.filter((b) => b.status === "dried").length;
    const stocked = all.filter((b) => b.status === "stocked").length;
    return {
      total: all.length,
      growing,
      harvested,
      dried,
      stocked,
      active: growing + harvested + dried,
    };
  }, [batches]);

  // Smart-default for the management drawers: open the create form when
  // there are zero batches (the only useful action), open the
  // advance/harvest/dry/stock form when batches exist (the routine
  // action). Apply imperatively via refs ONCE when dashboard data first
  // arrives so React doesn't keep re-applying the `open` prop and
  // overriding the user's manual toggles on later re-renders.
  const detailsCreateRef = useRef(null);
  const detailsActionRef = useRef(null);
  const smartDefaultAppliedRef = useRef(false);
  useEffect(() => {
    if (smartDefaultAppliedRef.current) return;
    if (dashboard == null) return;
    smartDefaultAppliedRef.current = true;
    const hasBatches = batchOptions.length > 0;
    if (detailsCreateRef.current) detailsCreateRef.current.open = !hasBatches;
    if (detailsActionRef.current) detailsActionRef.current.open = hasBatches;
  }, [dashboard, batchOptions.length]);

  if (!isTeam) {
    return (
      <main>
        <div className="app-layout">
          <section className="surface-stack">
            <article className="panel">
              <div className="section-heading">
                <p className="kicker">Entrada e cultivo</p>
                <h2>Acesso restrito</h2>
                <p className="muted">Entre como equipe para abrir o cultivo privado.</p>
              </div>
              {error ? <p className="pill danger">{error}</p> : null}
            </article>
          </section>
        </div>
      </main>
    );
  }

  return (
    <TeamShell
      session={session}
      dashboard={dashboard}
      currentRoute="/equipe/cultivo"
      onLogout={logout}
      busy={busy}
    >
      <PageHead
        title="Entrada e cultivo"
        meta={`${pluralize(totals.active, "lote", "lotes")} em curso · ${totals.total} no histórico`}
        actions={
          <a className="btn ghost mini" href="/equipe/estoque">
            Ir para estoque
          </a>
        }
      />

      <StatusStrip
        chips={[
          {
            label: pluralWord(totals.active, "lote ativo", "lotes ativos"),
            count: totals.active,
            tone: totals.active ? "ok" : undefined,
          },
          {
            label: "vegetativo",
            count: totals.growing,
            tone: totals.growing ? "warn" : undefined,
          },
          {
            label: pluralWord(totals.harvested, "colhido", "colhidos"),
            count: totals.harvested,
            tone: totals.harvested ? "warn" : undefined,
          },
          {
            label: pluralWord(totals.dried, "seco", "secos"),
            count: totals.dried,
            tone: totals.dried ? "ok" : undefined,
          },
          {
            label: pluralWord(totals.stocked, "estocado", "estocados"),
            count: totals.stocked,
          },
        ]}
        onRefresh={() => loadAll().catch((nextError) => setError(nextError.message))}
      />

      {message ? <p className="status">{message}</p> : null}
      {error ? <p className="pill danger">{error}</p> : null}

      <div className="stack">
        {!dashboard ? (
          <div className="adm-stack-2" style={{ padding: "var(--sp-4)" }}>
            <span className="adm-skeleton adm-skeleton--row" aria-hidden />
            <span className="adm-skeleton adm-skeleton--row" aria-hidden />
            <span className="adm-skeleton adm-skeleton--row" aria-hidden />
            <span className="sr-only">Carregando lotes de cultivo...</span>
          </div>
        ) : (
          <CultivoPanel batches={batches} />
        )}

        <section className="management-drawers" aria-label="Ações de gestão de cultivo">
          <details ref={detailsCreateRef}>
            <summary>Criar lote de cultivo</summary>
            <form
              id="cultivation-form"
              className="inline-form compact-management-form"
              onSubmit={submitCultivationCreate}
            >
              <label>
                Cultivar
                <input
                  name="strain"
                  placeholder="24k"
                  required
                  disabled={!isTeam || busy === "cultivation-create"}
                />
              </label>
              <label>
                Produto vinculado
                <select
                  name="productId"
                  id="cultivation-product"
                  disabled={!isTeam || !products.length || busy === "cultivation-create"}
                >
                  {productOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Plantas
                <input
                  name="plants"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                  disabled={!isTeam || busy === "cultivation-create"}
                />
              </label>
              <label>
                Semana
                <input
                  name="week"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                  disabled={!isTeam || busy === "cultivation-create"}
                />
              </label>
              <button
                className="btn btn--primary btn--mini"
                type="submit"
                disabled={!isTeam || busy === "cultivation-create"}
              >
                {busy === "cultivation-create" ? "Criando..." : "Criar lote"}
              </button>
            </form>
          </details>

          <details ref={detailsActionRef}>
            <summary>Avançar, colher, secar ou estocar</summary>
            {batchOptions.length === 0 ? (
              <div className="adm-empty-state adm-empty-state--inset">
                <span className="adm-empty-state__title">
                  Nenhum lote ativo para acionar
                </span>
                <span className="adm-empty-state__hint">
                  Quando um cultivo entrar em vegetativo, ele aparece aqui.
                </span>
              </div>
            ) : null}
            <form
              id="cultivation-update-form"
              className="inline-form compact-management-form action-form"
              hidden={batchOptions.length === 0}
            >
              <label>
                Lote
                <select
                  name="batchId"
                  id="cultivation-batch"
                  disabled={!isTeam || !batchOptions.length || busy.startsWith("cultivation-")}
                >
                  {batchOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Peso g
                <input
                  name="amount"
                  type="number"
                  min="1"
                  defaultValue="1"
                  disabled={!isTeam || busy.startsWith("cultivation-")}
                />
              </label>
              <label>
                Produto para estoque
                <select
                  name="productId"
                  id="cultivation-stock-product"
                  disabled={!isTeam || !products.length || busy.startsWith("cultivation-")}
                >
                  {productOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn--ghost btn--mini"
                type="button"
                data-cultivation-action="advance"
                disabled={!isTeam || !batchOptions.length || busy === "cultivation-advance"}
                onClick={() => submitCultivationAction("advance")}
              >
                Avançar semana
              </button>
              <button
                className="btn btn--ghost btn--mini"
                type="button"
                data-cultivation-action="harvest"
                disabled={!isTeam || !batchOptions.length || busy === "cultivation-harvest"}
                onClick={() => submitCultivationAction("harvest")}
              >
                Colheita
              </button>
              <button
                className="btn btn--ghost btn--mini"
                type="button"
                data-cultivation-action="dry"
                disabled={!isTeam || !batchOptions.length || busy === "cultivation-dry"}
                onClick={() => submitCultivationAction("dry")}
              >
                Peso seco
              </button>
              <button
                className="btn btn--ghost btn--mini"
                type="button"
                data-cultivation-action="stock"
                disabled={
                  !isTeam ||
                  !batchOptions.length ||
                  !products.length ||
                  busy === "cultivation-stock"
                }
                onClick={() => submitCultivationAction("stock")}
              >
                Mover para estoque
              </button>
            </form>
          </details>
        </section>

        <p className="muted cultivo-help">
          Para gerenciar produtos, lotes de estoque e limites de alerta, abra{" "}
          <a href="/equipe/estoque">/equipe/estoque</a>.
        </p>
      </div>
    </TeamShell>
  );
}

function stageLabel(status) {
  return (
    {
      growing: "vegetativo",
      harvested: "colhido",
      dried: "seco",
      stocked: "estocado",
    }[status] || status
  );
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Erro na requisição.");
  }
  return payload;
}
