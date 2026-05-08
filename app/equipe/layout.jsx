// Phase 3 introduces a passthrough layout so future phases can mount
// <TeamShell> here once each child route migrates off its own legacy
// topbar/side-nav. Today only /equipe (TeamCommand) renders the shell
// directly to avoid double-shell with the not-yet-rebuilt sibling routes
// (/equipe/pacientes, /equipe/estoque, /equipe/pedidos, /equipe/fulfillment,
// /equipe/suporte). Phases 4-7 own that migration.
export default function TeamLayout({ children }) {
  return children;
}
