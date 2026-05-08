import Brand from "./components/Brand";
import styles from "./components/landing/Landing.module.css";

export default function HomePage() {
  return (
    <div className={styles.lxRoot}>
      <header className={styles.lxTopbar}>
        <Brand />
        <nav className={styles.lxNavPrimary} aria-label="Navegacao institucional">
          <a href="#quem-somos">Quem somos</a>
          <a href="#programas">Programas</a>
          <a href="#como-acessar">Como acessar</a>
          <a href="#transparencia">Transparencia</a>
          <a href="#contato">Contato</a>
        </nav>
        <div className={styles.lxNavSecondary} aria-label="Acessos rapidos">
          <a className={styles.lxDoorMini} href="/paciente">
            Sou paciente
          </a>
          <a className={`${styles.lxDoorMini} ${styles.lxDoorMiniSolid}`} href="#contato">
            Quero acolhimento
          </a>
        </div>
      </header>

      <main>
        <section className={styles.lxHero} aria-labelledby="lx-hero-title">
          <div className={styles.lxHeroCopy}>
            <span className={styles.lxOverline}>Associacao sem fins lucrativos</span>
            <h1 id="lx-hero-title" className={styles.lxHeroTitle}>
              Cannabis medicinal com <em>acolhimento</em> e ciencia, lado a lado de quem precisa.
            </h1>
            <p className={styles.lxHeroLead}>
              Acompanhamos pacientes, familias e profissionais de saude no acesso ao tratamento
              autorizado, com plano de cuidado, atendimento humano e acompanhamento ao longo de toda
              a jornada.
            </p>
            <div className={styles.lxHeroActions}>
              <a className={styles.lxBtnPrimary} href="#como-acessar">
                Quero ser acolhido
              </a>
              <a className={styles.lxBtnGhost} href="#programas">
                Conhecer os programas
              </a>
            </div>
          </div>

          <aside className={styles.lxHeroAside} aria-label="Compromisso da associacao">
            <h2 className={styles.lxHeroAsideTitle}>O que nos move</h2>
            <ul className={styles.lxValueList}>
              <li>
                <span className={styles.lxValueDot} aria-hidden="true" />
                <div>
                  <span className={styles.lxValueLabel}>Acolhimento</span>
                  <span className={styles.lxValueText}>
                    Cada paciente e ouvido por uma pessoa real, antes de qualquer documento ou
                    processo.
                  </span>
                </div>
              </li>
              <li>
                <span className={styles.lxValueDot} aria-hidden="true" />
                <div>
                  <span className={styles.lxValueLabel}>Ciencia</span>
                  <span className={styles.lxValueText}>
                    Trabalhamos com prescricao medica, evidencia clinica e medicamentos com
                    qualidade rastreavel.
                  </span>
                </div>
              </li>
              <li>
                <span className={styles.lxValueDot} aria-hidden="true" />
                <div>
                  <span className={styles.lxValueLabel}>Acesso</span>
                  <span className={styles.lxValueText}>
                    Tornamos o tratamento mais proximo, simples e sustentavel para quem ja tem
                    indicacao terapeutica.
                  </span>
                </div>
              </li>
            </ul>
          </aside>
        </section>

        <section id="quem-somos" className={styles.lxSection} aria-labelledby="lx-quem-somos-title">
          <header className={styles.lxSectionHead}>
            <div>
              <p className={styles.lxSectionEyebrow}>Quem somos</p>
              <h2 id="lx-quem-somos-title" className={styles.lxSectionTitle}>
                Uma associacao construida ao redor das pessoas que cuida.
              </h2>
            </div>
            <p className={styles.lxSectionLead}>
              Somos uma associacao de pacientes que organiza, em conjunto com medicos, equipe
              tecnica e familias, o acesso seguro a cannabis medicinal no Brasil. Nosso compromisso
              e tratar cada caso com tempo, escuta e responsabilidade clinica, do primeiro contato a
              continuidade do tratamento.
            </p>
          </header>

          <div className={styles.lxValuesGrid}>
            <article className={styles.lxValueCard}>
              <span className={styles.lxValueCardKicker}>Missao</span>
              <h3 className={styles.lxValueCardTitle}>
                Cuidar de quem precisa de cannabis medicinal
              </h3>
              <p className={styles.lxValueCardText}>
                Existimos para que pacientes com indicacao medica tenham acolhimento, acompanhamento
                e acesso continuado, sem burocratizar o que ja e dificil para quem esta em
                tratamento.
              </p>
            </article>

            <article className={styles.lxValueCard}>
              <span className={styles.lxValueCardKicker}>Visao</span>
              <h3 className={styles.lxValueCardTitle}>
                Tratamento como direito, nao como privilegio
              </h3>
              <p className={styles.lxValueCardText}>
                Acreditamos que ciencia e cuidado humano podem caminhar juntos. Trabalhamos para que
                mais familias encontrem informacao clara, profissionais preparados e medicamento de
                qualidade.
              </p>
            </article>

            <article className={styles.lxValueCard}>
              <span className={styles.lxValueCardKicker}>Valores</span>
              <h3 className={styles.lxValueCardTitle}>Etica clinica, transparencia e respeito</h3>
              <p className={styles.lxValueCardText}>
                Todo acolhimento comeca pela escuta. Toda decisao terapeutica e do medico. Toda
                nossa operacao e prestada de contas com clareza para associados e parceiros.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className={styles.lxFooter} id="contato">
        <div className={styles.lxFooterBottom}>
          <span>(c) Apoiar Brasil Associacao Verde</span>
          <nav aria-label="Links institucionais">
            <a href="#quem-somos">Quem somos</a>
            <a href="mailto:contato@apoiarbrasil.org">contato@apoiarbrasil.org</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
