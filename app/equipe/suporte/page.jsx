"use client";

import { useCallback, useEffect, useState } from "react";
import TeamShell from "../components/TeamShell";
import Workbench from "./components/Workbench";

/**
 * Phase 7 — Support workbench route.
 *
 * Mounts TeamShell (Phase 3 shell — sidebar with badges, topbar with role
 * chip + Cmd-K hint, footer with logout/profile) around the new Workbench
 * component.
 *
 * E2E preserves: visible body texts "Suporte ao paciente", "Ultimo login",
 * "Reserva", "Duvida sobre renovacao", "Revisao de acesso";
 * #support-status, #support-surface, [data-filter='supportQuery'],
 * [data-filter='supportStatus'].
 */
export default function SupportPage() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("carregando");
  const [busy, setBusy] = useState(false);

  const loadSession = useCallback(async () => {
    const payload = await api("/api/session");
    setSession(payload.session || null);
    return payload.session || null;
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const payload = await api("/api/team/dashboard");
      setDashboard(payload);
      setStatus("equipe autenticada");
      setError("");
    } catch (loadError) {
      setStatus("acesso restrito");
      setError(loadError.message);
      setDashboard(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadSession()
      .then((nextSession) => {
        if (!active) return null;
        if (nextSession?.role !== "team") {
          setStatus("acesso restrito");
          return null;
        }
        return loadDashboard();
      })
      .catch((nextError) => {
        if (active) setError(nextError.message);
      });
    return () => {
      active = false;
    };
  }, [loadSession, loadDashboard]);

  async function onLogout() {
    setBusy(true);
    try {
      await fetch("/api/team/logout", { method: "POST" });
    } catch {
      /* noop */
    } finally {
      setBusy(false);
      window.location.href = "/equipe";
    }
  }

  return (
    <TeamShell
      session={session}
      dashboard={dashboard}
      currentRoute="/equipe/suporte"
      onLogout={session?.role === "team" ? onLogout : undefined}
      busy={busy}
    >
      <Workbench
        dashboard={dashboard}
        onDashboardRefresh={loadDashboard}
        error={error}
        status={status}
        session={session}
      />
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
  if (!response.ok) throw new Error(payload?.error || "Erro na requisicao.");
  return payload;
}
