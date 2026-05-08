"use client";

import UserRow from "./UserRow";
import styles from "./TeamUsersTable.module.css";

/**
 * Single table for the team users section. Replaces the prior wide-card
 * grid with a clinical table (avatar · role · status · last login · actions).
 *
 * Props:
 *   users            list of team users
 *   onCreateUser     submit handler for the create form
 *   onStatusChange   (userId, status) => void   — wired to UserRow buttons
 *   onPasswordReset  (event, userId) => void
 */
export default function TeamUsersTable({
  users = [],
  onCreateUser,
  onStatusChange,
  onPasswordReset,
}) {
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
        <button className={styles.formSubmit} type="submit">
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
