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

        <section
          id="programas"
          className={`${styles.lxSection} ${styles.lxSectionAlt}`}
          aria-labelledby="lx-programas-title"
        >
          <header className={styles.lxSectionHead}>
            <div>
              <p className={styles.lxSectionEyebrow}>Programas</p>
              <h2 id="lx-programas-title" className={styles.lxSectionTitle}>
                O que oferecemos a quem chega ate nos.
              </h2>
            </div>
            <p className={styles.lxSectionLead}>
              Cada programa parte do mesmo principio: cuidar de pessoas reais, com tempo e
              responsabilidade. Conheca os caminhos pelos quais a associacao acompanha pacientes e
              familias.
            </p>
          </header>

          <div className={styles.lxProgramsGrid}>
            <article className={styles.lxProgramCard}>
              <span className={styles.lxProgramTag}>Acolhimento</span>
              <h3 className={styles.lxProgramTitle}>Primeira escuta, sem pressa</h3>
              <p className={styles.lxProgramText}>
                Toda jornada comeca por uma conversa com a equipe de acolhimento, que entende a
                indicacao terapeutica, o contexto da familia e os proximos passos.
              </p>
              <ul className={styles.lxProgramDetails}>
                <li>Atendimento humano por telefone, e-mail ou presencial.</li>
                <li>Orientacao sobre receita medica e documentos.</li>
                <li>Encaminhamento a profissionais quando faz sentido clinico.</li>
              </ul>
            </article>

            <article className={styles.lxProgramCard}>
              <span className={styles.lxProgramTag}>Acesso autorizado</span>
              <h3 className={styles.lxProgramTitle}>Tratamento legal, com qualidade rastreavel</h3>
              <p className={styles.lxProgramText}>
                Para quem ja possui prescricao medica, viabilizamos o acesso regular ao medicamento
                dentro do enquadramento autorizado pelas autoridades sanitarias.
              </p>
              <ul className={styles.lxProgramDetails}>
                <li>Cadastro do paciente vinculado a receita e a documentos medicos.</li>
                <li>Pedido com pagamento seguro via Pix.</li>
                <li>Entrega rastreada e sigilosa.</li>
              </ul>
            </article>

            <article className={styles.lxProgramCard}>
              <span className={styles.lxProgramTag}>Plano de cuidado</span>
              <h3 className={styles.lxProgramTitle}>Continuidade ao longo do tratamento</h3>
              <p className={styles.lxProgramText}>
                Acompanhamos a jornada completa, do primeiro pedido a renovacao de receita, com um
                plano de cuidado pensado para que o tratamento nao seja interrompido.
              </p>
              <ul className={styles.lxProgramDetails}>
                <li>Lembretes para renovacao de receita e dosagem.</li>
                <li>Suporte dedicado em caso de duvidas terapeuticas.</li>
                <li>Acompanhamento clinico em parceria com a familia.</li>
              </ul>
            </article>

            <article className={styles.lxProgramCard}>
              <span className={styles.lxProgramTag}>Atendimento</span>
              <h3 className={styles.lxProgramTitle}>Suporte humano em cada etapa</h3>
              <p className={styles.lxProgramText}>
                Quando algo foge do roteiro, uma pessoa da equipe esta disponivel para conversar,
                retomar o caso e encaminhar o que for preciso, com sigilo e respeito.
              </p>
              <ul className={styles.lxProgramDetails}>
                <li>Canal direto para pacientes e familiares.</li>
                <li>Apoio em casos de urgencia clinica.</li>
                <li>Escuta tambem para profissionais de referencia.</li>
              </ul>
            </article>
          </div>
        </section>

        <section
          id="como-acessar"
          className={styles.lxSection}
          aria-labelledby="lx-como-acessar-title"
        >
          <header className={styles.lxSectionHead}>
            <div>
              <p className={styles.lxSectionEyebrow}>Como acessar</p>
              <h2 id="lx-como-acessar-title" className={styles.lxSectionTitle}>
                Tres passos para iniciar o cuidado.
              </h2>
            </div>
            <p className={styles.lxSectionLead}>
              Tornamos a entrada simples para quem ja recebeu indicacao medica e acolhedora para
              quem esta no comeco da jornada. A equipe caminha com voce em cada etapa.
            </p>
          </header>

          <div className={styles.lxStepsGrid}>
            <article className={styles.lxStepCard}>
              <span className={styles.lxStepKicker}>Conversa inicial</span>
              <h3 className={styles.lxStepTitle}>Fale com a equipe de acolhimento</h3>
              <p className={styles.lxStepText}>
                Por e-mail ou telefone, uma pessoa da equipe ouve sua situacao, entende o quadro e
                orienta os documentos medicos necessarios.
              </p>
            </article>

            <article className={styles.lxStepCard}>
              <span className={styles.lxStepKicker}>Cadastro clinico</span>
              <h3 className={styles.lxStepTitle}>Receita medica e documentos</h3>
              <p className={styles.lxStepText}>
                Com a receita medica em maos, fazemos o cadastro do paciente associado, validamos os
                documentos e construimos o plano de cuidado em conjunto.
              </p>
            </article>

            <article className={styles.lxStepCard}>
              <span className={styles.lxStepKicker}>Acompanhamento</span>
              <h3 className={styles.lxStepTitle}>Tratamento continuo, com suporte</h3>
              <p className={styles.lxStepText}>
                A partir dai, cada pedido e cada renovacao acontece dentro do portal do paciente,
                com pagamento seguro, entrega rastreada e contato humano sempre que precisar.
              </p>
            </article>
          </div>
        </section>

        <section
          id="parceiros"
          className={`${styles.lxSection} ${styles.lxSectionAlt}`}
          aria-labelledby="lx-parceiros-title"
        >
          <header className={styles.lxSectionHead}>
            <div>
              <p className={styles.lxSectionEyebrow}>Profissionais e parceiros</p>
              <h2 id="lx-parceiros-title" className={styles.lxSectionTitle}>
                Trabalhamos em rede com quem cuida.
              </h2>
            </div>
            <p className={styles.lxSectionLead}>
              Medicos, equipes multiprofissionais e organizacoes parceiras encontram aqui um caminho
              claro para encaminhar pacientes e construir cuidado junto com a associacao.
            </p>
          </header>

          <div className={styles.lxStakeholderGrid}>
            <article className={styles.lxStakeholderCard}>
              <span className={styles.lxStakeholderTag}>Para profissionais de saude</span>
              <h3 className={styles.lxStakeholderTitle}>Encaminhe um paciente com seguranca</h3>
              <p className={styles.lxStakeholderText}>
                Recebemos prescricoes de medicos cadastrados e mantemos um canal tecnico aberto para
                esclarecer duvidas sobre o medicamento, a titulacao e o acompanhamento conjunto do
                paciente.
              </p>
              <a className={styles.lxStakeholderLink} href="mailto:profissionais@apoiarbrasil.org">
                Falar com a equipe clinica
              </a>
            </article>

            <article className={styles.lxStakeholderCard}>
              <span className={styles.lxStakeholderTag}>Para parceiros</span>
              <h3 className={styles.lxStakeholderTitle}>Construa um programa em conjunto</h3>
              <p className={styles.lxStakeholderText}>
                Instituicoes, clinicas e organizacoes da sociedade civil podem desenhar com a
                associacao programas de acolhimento, formacao e acesso ampliado em suas comunidades.
              </p>
              <a className={styles.lxStakeholderLink} href="mailto:parcerias@apoiarbrasil.org">
                Propor uma parceria
              </a>
            </article>
          </div>
        </section>

        <section
          id="transparencia"
          className={styles.lxSection}
          aria-labelledby="lx-transparencia-title"
        >
          <header className={styles.lxSectionHead}>
            <div>
              <p className={styles.lxSectionEyebrow}>Transparencia</p>
              <h2 id="lx-transparencia-title" className={styles.lxSectionTitle}>
                Prestamos contas a quem confia na associacao.
              </h2>
            </div>
            <p className={styles.lxSectionLead}>
              Somos uma organizacao sem fins lucrativos. Nossa governanca, nosso estatuto e os
              relatorios anuais ficam disponiveis para associados, parceiros e qualquer pessoa que
              queira nos conhecer.
            </p>
          </header>

          <div className={styles.lxTransparencyRow}>
            <article className={styles.lxStat}>
              <span className={styles.lxStatLabel}>Natureza juridica</span>
              <span className={styles.lxStatValue}>Sem fins lucrativos</span>
              <span className={styles.lxStatNote}>
                Associacao civil de pacientes, regida por estatuto e assembleia de associados.
              </span>
            </article>
            <article className={styles.lxStat}>
              <span className={styles.lxStatLabel}>Cuidado clinico</span>
              <span className={styles.lxStatValue}>Receita medica</span>
              <span className={styles.lxStatNote}>
                Atendimento apenas para pacientes com indicacao terapeutica e prescricao em vigor.
              </span>
            </article>
            <article className={styles.lxStat}>
              <span className={styles.lxStatLabel}>Sigilo</span>
              <span className={styles.lxStatValue}>Dados protegidos</span>
              <span className={styles.lxStatNote}>
                Tratamos as informacoes do paciente conforme a LGPD, com acesso restrito a equipe
                clinica.
              </span>
            </article>
            <article className={styles.lxStat}>
              <span className={styles.lxStatLabel}>Governanca</span>
              <span className={styles.lxStatValue}>Aberta</span>
              <span className={styles.lxStatNote}>
                Estatuto, atas e prestacao de contas disponiveis sob solicitacao aos associados.
              </span>
            </article>
          </div>
        </section>

        <section
          id="contato"
          className={`${styles.lxSection} ${styles.lxSectionAlt}`}
          aria-labelledby="lx-contato-title"
        >
          <header className={styles.lxSectionHead}>
            <div>
              <p className={styles.lxSectionEyebrow}>Contato</p>
              <h2 id="lx-contato-title" className={styles.lxSectionTitle}>
                Fale com a gente.
              </h2>
            </div>
            <p className={styles.lxSectionLead}>
              Escolha o canal mais confortavel. Toda mensagem chega a uma pessoa da equipe e tem
              retorno em ate dois dias uteis.
            </p>
          </header>

          <div className={styles.lxContactGrid}>
            <article className={styles.lxContactCard}>
              <span className={styles.lxContactKicker}>Acolhimento</span>
              <h3 className={styles.lxContactTitle}>Quero comecar um tratamento</h3>
              <p className={styles.lxContactDetail}>
                Para pacientes e familias que querem entender como ser acolhidos.
              </p>
              <p className={styles.lxContactDetail}>
                <strong>acolhimento@apoiarbrasil.org</strong>
              </p>
            </article>

            <article className={styles.lxContactCard}>
              <span className={styles.lxContactKicker}>Atendimento</span>
              <h3 className={styles.lxContactTitle}>Sou paciente associado</h3>
              <p className={styles.lxContactDetail}>
                Duvidas sobre receita, pedido ou plano de cuidado em andamento.
              </p>
              <p className={styles.lxContactDetail}>
                <strong>atendimento@apoiarbrasil.org</strong>
              </p>
            </article>

            <article className={styles.lxContactCard}>
              <span className={styles.lxContactKicker}>Imprensa e parceiros</span>
              <h3 className={styles.lxContactTitle}>Outros assuntos</h3>
              <p className={styles.lxContactDetail}>
                Imprensa, pesquisa academica, parcerias institucionais e voluntariado.
              </p>
              <p className={styles.lxContactDetail}>
                <strong>contato@apoiarbrasil.org</strong>
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className={styles.lxFooter}>
        <div className={styles.lxFooterTop}>
          <div className={styles.lxFooterIntro}>
            <h3>Apoiar Brasil Associacao Verde</h3>
            <p>
              Cannabis medicinal com acolhimento e ciencia. Acompanhamos pacientes, familias e
              profissionais de saude no acesso ao tratamento autorizado, com plano de cuidado e
              atendimento humano.
            </p>
          </div>

          <div className={styles.lxFooterDoors}>
            <span className={styles.lxFooterDoorLabel}>Acessos para associados e equipe</span>
            <a className={styles.lxFooterDoor} href="/paciente">
              <span className={styles.lxFooterDoorIcon} aria-hidden="true">
                P
              </span>
              <span className={styles.lxFooterDoorBody}>
                <strong>Paciente associado</strong>
                <span>Entrar no portal de cuidado</span>
              </span>
              <span className={styles.lxFooterDoorArrow} aria-hidden="true"></span>
            </a>
            <a className={styles.lxFooterDoor} href="/equipe">
              <span
                className={`${styles.lxFooterDoorIcon} ${styles.lxFooterDoorIconAlt}`}
                aria-hidden="true"
              >
                E
              </span>
              <span className={styles.lxFooterDoorBody}>
                <strong>Equipe da associacao</strong>
                <span>Entrar na area interna</span>
              </span>
              <span className={styles.lxFooterDoorArrow} aria-hidden="true"></span>
            </a>
          </div>
        </div>

        <div className={styles.lxFooterBottom}>
          <span>(c) Apoiar Brasil Associacao Verde</span>
          <nav aria-label="Links institucionais">
            <a href="#quem-somos">Quem somos</a>
            <a href="#transparencia">Transparencia</a>
            <a href="#contato">Contato</a>
            <a href="mailto:contato@apoiarbrasil.org">contato@apoiarbrasil.org</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
