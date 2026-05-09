"use client";

/* Cultivo — its own route.
   Split out from /equipe/estoque per the U2 directive: cultivo gets its own
   page so the estoque ledger stays focused on inventory and lots, while the
   cultivation funnel (planting -> harvest -> drying -> stocked) lives here.
   The legacy management forms (#cultivation-form / #cultivation-update-form)
   continue to live inside StockRoute's <details> drawers so old E2E
   selectors stay reachable. New entries should be added here. */

import { useCallback, useEffect, useMemo, useState } from "react";

import TeamShell from "../components/TeamShell";
import PageHead from "../components/PageHead";
import StatusStrip from "../components/StatusStrip";
import CultivoPanel from "../estoque/components/CultivoPanel.jsx";
import { pluralize } from "../components/pluralize.js";

export default function CultivoRoute() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isTeam = session?.role === "team";

  const loadAll = useCallback(async () => {
    setError("");
    const [sessionPayload, dashboardPayload] = await Promise.all([
      api("/api/session"),
      api("/api/team/dashboard").catch(() => null),
    ]);
    setSession(sessionPayload.session || null);
    setDashboard(dashboardPayload || null);
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
    setBusy(true);
    try {
      await api("/api/logout", { method: "POST" });
      setSession(null);
      setDashboard(null);
    } finally {
      setBusy(false);
    }
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
          { label: "lotes ativos", count: totals.active, tone: totals.active ? "ok" : undefined },
          {
            label: "em crescimento",
            count: totals.growing,
            tone: totals.growing ? "warn" : undefined,
          },
          {
            label: "colhidos",
            count: totals.harvested,
            tone: totals.harvested ? "warn" : undefined,
          },
          { label: "secos", count: totals.dried, tone: totals.dried ? "ok" : undefined },
          { label: "estocados", count: totals.stocked },
        ]}
        onRefresh={() => loadAll().catch((nextError) => setError(nextError.message))}
      />

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
        <p className="muted cultivo-help">
          Para criar lotes, avançar semana, registrar colheita, secagem ou mover para o estoque, use
          o painel "Entrada e cultivo" em <a href="/equipe/estoque">/equipe/estoque</a>.
        </p>
      </div>
    </TeamShell>
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
