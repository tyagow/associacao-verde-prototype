import Brand from "./components/Brand";

export default function HomePage() {
  return (
    <>
      <header className="topbar">
        <Brand />
        <nav aria-label="Entradas seguras">
          <a className="ghost" href="/paciente">
            Paciente
          </a>
          <a className="ghost" href="/equipe">
            Equipe
          </a>
        </nav>
      </header>

      <main className="home-entry">
        <section className="home-hero home-console" aria-labelledby="home-title">
          <div className="home-console-copy">
            <p className="kicker">Sistema privado da associacao</p>
            <h1 id="home-title">Apoiar Brasil Operacao Privada</h1>
            <p>
              Acesso controlado para pacientes autorizados e equipe interna: elegibilidade, receita,
              estoque, Pix, pedidos, envio, suporte e auditoria no servidor.
            </p>
          </div>

          <div className="home-entry-actions" aria-label="Entradas principais">
            <a className="home-entry-action patient" href="/paciente">
              <span>Paciente</span>
              <strong>Entrar no portal autorizado</strong>
              <p>Ver elegibilidade, pedido atual, catalogo privado e Pix.</p>
            </a>
            <a className="home-entry-action team" href="/equipe">
              <span>Equipe</span>
              <strong>Abrir comando operacional</strong>
              <p>Gerenciar pacientes, estoque, pedidos, fulfillment e readiness.</p>
            </a>
          </div>

          <aside className="home-console-status" aria-label="Controles do sistema">
            <div>
              <span>Autenticacao</span>
              <strong>Sessoes assinadas</strong>
            </div>
            <div>
              <span>Catalogo</span>
              <strong>Fechado por elegibilidade</strong>
            </div>
            <div>
              <span>Pix</span>
              <strong>Reserva antes da baixa</strong>
            </div>
            <div>
              <span>Auditoria</span>
              <strong>Operacoes rastreadas</strong>
            </div>
          </aside>
        </section>

        <section
          className="home-system-strip home-proof-strip"
          aria-label="Capacidades do sistema privado"
        >
          {[
            ["Paciente", "Cadastro ativo, convite, receita e carteirinha antes do catalogo."],
            ["Equipe", "Rotas internas exigem sessao de equipe antes de renderizar."],
            ["Estoque", "Reserva no checkout; baixa definitiva so no Pix confirmado."],
            ["Readiness", "Provider, dominio, cookie, backup e deploy seguem gates."],
          ].map(([label, text]) => (
            <article key={label}>
              <span>{label}</span>
              <p>{text}</p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
