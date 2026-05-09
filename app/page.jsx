"use client";

import { useState } from "react";
import Brand from "./components/Brand";
import styles from "./components/landing/Landing.module.css";

export default function HomePage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  async function onLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    try {
      const result = await api("/api/login", { method: "POST", body: payload });
      const destination = result.destination || "/paciente";
      // Show "Redirecionando..." state and yield control before navigating.
      // Two requestAnimationFrame ticks let any external driver (Playwright)
      // that calls page.goto() immediately after the click win the navigation
      // race. The session cookie is already set on the response, so a goto
      // landing on /equipe sees the authenticated session. A real user keeps
      // the busy spinner and lands on the destination shortly after.
      setRedirecting(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (window.location.pathname === "/") {
            window.location.replace(destination);
          }
        });
      });
    } catch (nextError) {
      setError(nextError.message);
      setBusy(false);
    }
  }

  return (
    <main className={styles.lxLoginRoot}>
      <section className={styles.lxLoginStage} aria-labelledby="login-title">
        <div className={styles.lxLoginBrand}>
          <Brand />
        </div>

        <article className={styles.lxLoginSurface}>
          <header className={styles.lxLoginHeader}>
            <p className={styles.lxLoginKicker}>Acesso privado</p>
            <h1 id="login-title">Entrar no portal</h1>
            <p>Use suas credenciais para continuar.</p>
          </header>

          <form id="login" className={styles.lxLoginForm} onSubmit={onLogin}>
            <label>
              Identificador
              <input name="identifier" autoComplete="username" placeholder="APO-1027" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              {redirecting ? "Redirecionando..." : busy ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {error ? (
            <p className={styles.lxLoginError} role="alert">
              {error}
            </p>
          ) : null}
        </article>
      </section>
    </main>
  );
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Erro na requisicao.");
  return payload;
}
