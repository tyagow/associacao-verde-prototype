"use client";

import { useState } from "react";
import UserRow from "./UserRow";
import styles from "./TeamUsersTable.module.css";

export default function TeamUsersTable({
  users = [],
  onCreateUser,
  onStatusChange,
  onPasswordReset,
  compact = false,
}) {
  const [inviteOpen, setInviteOpen] = useState(false);

  if (compact) {
    return (
      <div className={styles.shellCompact}>
        <div className={styles.tableWrap}>
          <table className={styles.tableCompact} aria-label="Usuarios da equipe">
            <thead>
              <tr>
                <th scope="col">Usuário</th>
                <th scope="col">Papel</th>
                <th scope="col" className={styles.rightCol}>
                  Último
                </th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={3} className={styles.empty}>
                    Nenhum usuario da equipe cadastrado ainda.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <UserRow
                    key={user.id || user.email}
                    user={user}
                    onStatusChange={onStatusChange}
                    onPasswordReset={onPasswordReset}
                    compact
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.compactFooter}>
          {/* B3: "Trocar papel" was a permanently disabled stub copied from
              the mockup. Removed until a real /api/team/users/role endpoint
              exists; per-user actions live inline in the row. */}
          <button
            type="button"
            className="primary mini"
            onClick={() => setInviteOpen((v) => !v)}
            aria-expanded={inviteOpen ? "true" : "false"}
          >
            {inviteOpen ? "Fechar convite" : "+ Convidar"}
          </button>
        </div>

        <details className={styles.inviteDrawer} open={inviteOpen}>
          <summary className={styles.srOnly}>Formulário de convite</summary>
          <form id="team-user-form" className={styles.form} onSubmit={onCreateUser}>
            <label>
              Nome
              <input name="name" placeholder="Nome completo" required />
            </label>
            <label>
              Email
              <input name="email" type="email" placeholder="pessoa@associacao.org" required />
            </label>
            <label>
              Senha temporaria
              <input name="password" type="password" placeholder="Senha inicial" required />
            </label>
            <label>
              Papel
              <select name="role" defaultValue="support">
                <option value="admin">Admin</option>
                <option value="operations">Operacoes</option>
                <option value="support">Suporte</option>
              </select>
            </label>
            <button className="btn btn--primary" type="submit">
              Criar usuario
            </button>
          </form>
        </details>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <form id="team-user-form" className={styles.form} onSubmit={onCreateUser}>
        <label>
          Nome
          <input name="name" placeholder="Nome completo" required />
        </label>
        <label>
          Email
          <input name="email" type="email" placeholder="pessoa@associacao.org" required />
        </label>
        <label>
          Senha temporaria
          <input name="password" type="password" placeholder="Senha inicial" required />
        </label>
        <label>
          Papel
          <select name="role" defaultValue="support">
            <option value="admin">Admin</option>
            <option value="operations">Operacoes</option>
            <option value="support">Suporte</option>
          </select>
        </label>
        <button className="btn btn--primary" type="submit">
          Criar usuario
        </button>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="Usuarios da equipe">
          <thead>
            <tr>
              <th scope="col">Usuario</th>
              <th scope="col">Papel</th>
              <th scope="col">Status</th>
              <th scope="col">Ultimo login</th>
              <th scope="col" className={styles.thActions}>
                Acoes
              </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  Nenhum usuario da equipe cadastrado ainda.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <UserRow
                  key={user.id || user.email}
                  user={user}
                  onStatusChange={onStatusChange}
                  onPasswordReset={onPasswordReset}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
