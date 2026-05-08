"use client";

import { useState } from "react";
import styles from "./UserRow.module.css";

/**
 * One row of the team users table. Renders avatar (initials), name+email,
 * role pill, status dot, last-login text, and action buttons.
 *
 * Inline drawers (revealed via the row's action buttons):
 *   - "Editar" toggles the password reset form (Phase 9 left password reset
 *     in place; Phase 10 simply moves it inline under the row).
 *   - "Reativar" appears for inactive users; clicking opens an inline
 *     confirmation that calls onStatusChange(user.id, "active").
 *   - "Desativar" for active users (immediate; backend revokes sessions).
 *
 * Props:
 *   user             {id, name, email, role, status, lastLoginAt}
 *   onStatusChange   (userId, status) => void
 *   onPasswordReset  (event, userId) => void
 */
export default function UserRow({ user, onStatusChange, onPasswordReset }) {
  const [openDrawer, setOpenDrawer] = useState(null);
  const isActive = user.status === "active";

  function toggleDrawer(name) {
    setOpenDrawer((current) => (current === name ? null : name));
  }

  function onPasswordSubmit(event) {
    onPasswordReset(event, user.id);
    setOpenDrawer(null);
  }

  function confirmReactivate() {
    onStatusChange(user.id, "active");
    setOpenDrawer(null);
  }

  return (
    <>
      <tr className={styles.row}>
        <td className={styles.cellUser}>
          <span className={styles.avatar} aria-hidden="true">
            {initialsFor(user.name || user.email || "?")}
          </span>
          <div className={styles.identity}>
            <strong>{user.name || "Sem nome"}</strong>
            <span className={styles.email}>{user.email}</span>
          </div>
        </td>
        <td>
          <span className={`${styles.rolePill} ${styles[`role_${user.role}`] || ""}`.trim()}>
            {roleLabel(user.role)}
          </span>
        </td>
        <td>
          <span
            className={`${styles.statusPill} ${isActive ? styles.statusActive : styles.statusInactive}`}
          >
            <span className={styles.statusDot} aria-hidden="true" />
            {isActive ? "Ativo" : "Inativo"}
          </span>
        </td>
        <td className={styles.cellTime}>{formatDateTime(user.lastLoginAt)}</td>
        <td className={styles.cellActions}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => toggleDrawer("password")}
            aria-expanded={openDrawer === "password" ? "true" : "false"}
          >
            Editar
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => toggleDrawer("password")}
            aria-expanded={openDrawer === "password" ? "true" : "false"}
          >
            Senha
          </button>
          {isActive ? (
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionDanger}`}
              onClick={() => onStatusChange(user.id, "inactive")}
            >
              Desativar
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionPrimary}`}
              onClick={() => toggleDrawer("reactivate")}
              aria-expanded={openDrawer === "reactivate" ? "true" : "false"}
            >
              Reativar
            </button>
          )}
        </td>
      </tr>
      {openDrawer === "password" ? (
        <tr className={styles.drawerRow}>
          <td colSpan={5}>
            <form className={styles.drawer} onSubmit={onPasswordSubmit}>
              <label>
                Nova senha temporaria
                <input
                  name="password"
                  type="password"
                  placeholder="Minimo 10 caracteres"
                  minLength={10}
                  required
                />
              </label>
              <div className={styles.drawerActions}>
                <button type="submit" className={styles.drawerPrimary}>
                  Redefinir senha
                </button>
                <button
                  type="button"
                  className={styles.drawerGhost}
                  onClick={() => setOpenDrawer(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </td>
        </tr>
      ) : null}
      {openDrawer === "reactivate" ? (
        <tr className={styles.drawerRow}>
          <td colSpan={5}>
            <div className={styles.drawer}>
              <p className={styles.drawerCopy}>
                Reativar {user.name || user.email}? O usuario podera fazer login novamente
                imediatamente.
              </p>
              <div className={styles.drawerActions}>
                <button type="button" className={styles.drawerPrimary} onClick={confirmReactivate}>
                  Confirmar reativacao
                </button>
                <button
                  type="button"
                  className={styles.drawerGhost}
                  onClick={() => setOpenDrawer(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function initialsFor(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "operations") return "Operacoes";
  if (role === "support") return "Suporte";
  return role || "—";
}

function formatDateTime(value) {
  if (!value) return "Nunca";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(value));
  } catch (error) {
    return String(value);
  }
}
