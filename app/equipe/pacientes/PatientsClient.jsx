"use client";

import Brand from "../../components/Brand";
import { useCallback, useEffect, useMemo, useState } from "react";

const TEAM_ROUTES = [
  ["/equipe", "Comando"],
  ["/equipe/pacientes", "Pacientes"],
  ["/equipe/estoque", "Estoque"],
  ["/equipe/pedidos", "Pedidos"],
  ["/equipe/fulfillment", "Fulfillment"],
  ["/equipe/suporte", "Suporte"],
  ["/admin", "Admin"],
];

export default function PatientsClient() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isTeam = session?.role === "team";

  const loadSession = useCallback(async () => {
    const payload = await api("/api/session");
    setSession(payload.session || null);
    return payload.session || null;
  }, []);

  const loadDashboard = useCallback(async () => {
    const payload = await api("/api/team/dashboard");
    setDashboard(payload);
    return payload;
  }, []);

  const refresh = useCallback(async () => {
    setError("");
    const nextSession = await loadSession();
    if (nextSession?.role === "team") {
      await loadDashboard();
    } else {
      setDashboard(null);
    }
  }, [loadDashboard, loadSession]);

  useEffect(() => {
    let active = true;
    refresh().catch((nextError) => {
      if (active) setError(nextError.message);
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  async function handleLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit("login", "Equipe autenticada. Fila de pacientes atualizada.", async () => {
      await api("/api/team/login", {
        method: "POST",
        body: {
          email: form.get("email"),
          password: form.get("password"),
        },
      });
      await refresh();
    });
  }

  async function handleCreatePatient(event) {
    event.preventDefault();
    const form = event.currentTarget;
    await submit("patient", "Paciente criado com elegibilidade server-side.", async () => {
      await api("/api/team/patients", { method: "POST", body: formPayload(form) });
      form.reset();
      await loadDashboard();
    });
  }

  async function handlePatientAccess(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formPayload(form);
    for (const key of ["prescriptionExpiresAt", "cardExpiresAt"]) {
      if (!payload[key]) delete payload[key];
    }
    if (payload.associationEligible === "") delete payload.associationEligible;
    await submit("access", "Acesso, receita e carteirinha atualizados.", async () => {
      await api("/api/team/patient-access", { method: "POST", body: payload });
      form.reset();
      await loadDashboard();
    });
  }

  async function handleInviteReset(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formPayload(form);
    if (!payload.inviteCode) delete payload.inviteCode;
    await submit(
      "invite",
      "Convite privado reiniciado. Envie o novo codigo ao paciente por canal seguro.",
      async () => {
        const result = await api("/api/team/patient-invite-reset", {
          method: "POST",
          body: payload,
        });
        form.querySelector("[data-reset-result]").textContent =
          `Novo convite: ${result.inviteCode}`;
        await loadDashboard();
      },
    );
  }

  async function handleMemberCard(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formPayload(form);
    if (!payload.cardNumber) delete payload.cardNumber;
    if (!payload.note) delete payload.note;
    await submit("card", "Carteirinha emitida e elegibilidade atualizada.", async () => {
      await api("/api/team/member-cards", { method: "POST", body: payload });
      form.reset();
      await loadDashboard();
    });
  }

  async function handlePrescriptionDocument(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    const payload = Object.fromEntries(formData);
    delete payload.file;
    if (file?.name) {
      payload.fileName = file.name;
      payload.mimeType = file.type || "application/octet-stream";
      payload.fileContentBase64 = await fileToBase64(file);
    }
    if (!payload.note) delete payload.note;

    await submit("document", "Receita registrada com chave segura e hash.", async () => {
      await api("/api/team/prescription-documents", { method: "POST", body: payload });
      form.reset();
      await loadDashboard();
    });
  }

  async function submit(scope, successMessage, action) {
    setBusy(scope);
    setMessage("");
    setError("");
    try {
      await action();
      setMessage(successMessage);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  const worklist = useMemo(
    () => buildPatientWorklist(dashboard, query, status),
    [dashboard, query, status],
  );
  const counts = useMemo(() => patientCounts(dashboard), [dashboard]);

  return (
    <>
      <header className="topbar">
        <Brand />
        <nav aria-label="Areas do sistema">
          <a className="ghost" href="/paciente">
            Paciente
          </a>
          <a className="ghost" href="/equipe">
            Comando
          </a>
          <a className="ghost active" href="/equipe/pacientes" aria-current="page">
            Pacientes
          </a>
          <a className="ghost" href="/equipe/estoque">
            Estoque
          </a>
          <a className="ghost" href="/equipe/pedidos">
            Pedidos
          </a>
          <a className="ghost" href="/equipe/suporte">
            Suporte
          </a>
          <a className="ghost" href="/admin">
            Admin
          </a>
        </nav>
      </header>

      <main>
        <div className="app-layout">
          <aside className="side-nav" aria-label="Rotas da equipe">
            {TEAM_ROUTES.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className={href === "/equipe/pacientes" ? "active" : undefined}
                aria-current={href === "/equipe/pacientes" ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </aside>

          <section className="surface-stack">
            <section className="surface" data-surface="/equipe/pacientes">
              <article className="panel">
                <div className="section-heading">
                  <div>
                    <p className="kicker">Pacientes e documentos</p>
                    <h2>Acesso, receita e carteirinha</h2>
                    <p className="muted">
                      Cadastro, elegibilidade, validade da receita e carteirinha da associacao.
                    </p>
                  </div>
                  <span className="status" id="team-status">
                    {isTeam ? "equipe autenticada" : "acesso restrito"}
                  </span>
                </div>

                {!isTeam ? (
                  <TeamLoginForm busy={busy === "login"} error={error} onSubmit={handleLogin} />
                ) : null}

                <div hidden={!isTeam}>
                  <div className="surface-toolbar" aria-label="Filtro de pacientes">
                    <label>
                      Buscar paciente
                      <input
                        data-filter="patientsQuery"
                        placeholder="Nome, associado ou motivo de bloqueio"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <label>
                      Elegibilidade
                      <select
                        data-filter="patientsStatus"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                      >
                        <option value="all">Todos</option>
                        <option value="allowed">Liberados</option>
                        <option value="blocked">Bloqueados</option>
                        <option value="expiring">Validade em ate 30 dias</option>
                      </select>
                    </label>
                  </div>

                  <div id="patients-surface" className="stack">
                    {!dashboard ? (
                      <p className="muted">Carregando pacientes da equipe...</p>
                    ) : (
                      <PatientsSurface dashboard={dashboard} counts={counts} worklist={worklist} />
                    )}
                  </div>

                  <PatientForms
                    busy={busy}
                    onCreatePatient={handleCreatePatient}
                    onPatientAccess={handlePatientAccess}
                    onInviteReset={handleInviteReset}
                    onMemberCard={handleMemberCard}
                    onPrescriptionDocument={handlePrescriptionDocument}
                  />

                  {message ? <p className="status">{message}</p> : null}
                  {error && isTeam ? <p className="pill danger">{error}</p> : null}
                </div>
              </article>
            </section>
          </section>
        </div>
      </main>
    </>
  );
}

function TeamLoginForm({ busy, error, onSubmit }) {
  return (
    <>
      <form id="team-login" className="inline-form auth-form" onSubmit={onSubmit}>
        <div className="auth-intro">
          <strong>Acesso restrito da equipe</strong>
          <span>Use credenciais individuais. Tentativas repetidas sao bloqueadas e auditadas.</span>
        </div>
        <label>
          Email da equipe
          <input
            name="email"
            type="email"
            autoComplete="username"
            placeholder="pessoa@associacao.org"
            required
          />
        </label>
        <label>
          Senha da equipe
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Senha individual"
            required
          />
        </label>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Entrando..." : "Entrar como equipe"}
        </button>
      </form>
      <p className="muted">
        Entre como equipe para cadastrar pacientes, emitir carteirinhas e registrar receitas.
      </p>
      {error ? <p className="pill danger">{error}</p> : null}
    </>
  );
}

function PatientForms({
  busy,
  onCreatePatient,
  onPatientAccess,
  onInviteReset,
  onMemberCard,
  onPrescriptionDocument,
}) {
  return (
    <>
      <form id="patient-form" className="inline-form" onSubmit={onCreatePatient}>
        <label>
          Novo paciente
          <input name="name" placeholder="Nome completo" required />
        </label>
        <label>
          Associado
          <input name="memberCode" placeholder="APO-2001" required />
        </label>
        <label>
          Convite
          <input name="inviteCode" placeholder="CONVITE2026" required />
        </label>
        <label>
          Receita valida ate
          <input name="prescriptionExpiresAt" type="date" required />
        </label>
        <label>
          Responsavel
          <input name="guardianName" placeholder="Nome do responsavel" />
        </label>
        <label>
          Telefone
          <input name="contactPhone" placeholder="(11) 90000-0000" />
        </label>
        <label>
          Plano de cuidado
          <input name="carePlan" placeholder="Orientacao resumida da receita" />
        </label>
        <button className="primary" type="submit" disabled={busy === "patient"}>
          {busy === "patient" ? "Criando..." : "Criar paciente"}
        </button>
      </form>

      <form id="patient-access-form" className="inline-form" onSubmit={onPatientAccess}>
        <label>
          Associado
          <input name="memberCode" placeholder="APO-1027" required />
        </label>
        <label>
          Nome completo
          <input name="name" placeholder="Atualizar nome, se necessario" />
        </label>
        <label>
          Status
          <select name="status">
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </label>
        <label>
          Associacao
          <select name="associationEligible">
            <option value="">Manter elegibilidade</option>
            <option value="true">Elegivel</option>
            <option value="false">Nao elegivel</option>
          </select>
        </label>
        <label>
          Receita valida ate
          <input name="prescriptionExpiresAt" type="date" />
        </label>
        <label>
          Carteirinha valida ate
          <input name="cardExpiresAt" type="date" />
        </label>
        <label>
          Responsavel
          <input name="guardianName" placeholder="Responsavel pelo cadastro" />
        </label>
        <label>
          Telefone responsavel
          <input name="guardianPhone" placeholder="(11) 90000-0000" />
        </label>
        <label>
          Telefone paciente
          <input name="contactPhone" placeholder="(11) 98888-0000" />
        </label>
        <label>
          Email
          <input name="email" type="email" placeholder="paciente@email.com" />
        </label>
        <label>
          Cidade
          <input name="city" placeholder="Sao Paulo" />
        </label>
        <label>
          UF
          <input name="state" placeholder="SP" maxLength={2} />
        </label>
        <label>
          Plano de cuidado
          <input name="carePlan" placeholder="Produto/orientacao autorizada" />
        </label>
        <label>
          Nota interna
          <input name="supportNote" placeholder="Contexto para suporte e renovacao" />
        </label>
        <button className="primary" type="submit" disabled={busy === "access"}>
          {busy === "access" ? "Atualizando..." : "Atualizar acesso"}
        </button>
      </form>

      <form
        id="invite-reset-form"
        className="inline-form invite-reset-form"
        onSubmit={onInviteReset}
      >
        <label>
          Associado
          <input name="memberCode" placeholder="APO-1027" required />
        </label>
        <label>
          Novo convite opcional
          <input name="inviteCode" placeholder="Gerar automaticamente" />
        </label>
        <div className="invite-reset-result" data-reset-result aria-live="polite">
          Convite atual nunca e exibido. O novo codigo aparece uma vez apos reiniciar.
        </div>
        <button className="primary" type="submit" disabled={busy === "invite"}>
          {busy === "invite" ? "Reiniciando..." : "Reiniciar convite"}
        </button>
      </form>

      <form id="member-card-form" className="inline-form" onSubmit={onMemberCard}>
        <label>
          Associado
          <input name="memberCode" placeholder="APO-1027" required />
        </label>
        <label>
          Numero da carteirinha
          <input name="cardNumber" placeholder="AV-APO-1027-20270131" />
        </label>
        <label>
          Validade
          <input name="expiresAt" type="date" required />
        </label>
        <label>
          Observacao
          <input name="note" placeholder="Renovacao conferida" />
        </label>
        <button className="primary" type="submit" disabled={busy === "card"}>
          {busy === "card" ? "Emitindo..." : "Emitir carteirinha"}
        </button>
      </form>

      <form
        id="prescription-document-form"
        className="inline-form"
        onSubmit={onPrescriptionDocument}
      >
        <label>
          Associado
          <input name="memberCode" placeholder="APO-1027" required />
        </label>
        <label>
          Arquivo
          <input name="file" type="file" accept="application/pdf,image/*" required />
        </label>
        <label>
          Observacao interna
          <input name="note" placeholder="Receita conferida pela equipe" />
        </label>
        <label>
          Validade
          <input name="expiresAt" type="date" required />
        </label>
        <button className="primary" type="submit" disabled={busy === "document"}>
          {busy === "document" ? "Registrando..." : "Registrar receita"}
        </button>
      </form>
    </>
  );
}

function PatientsSurface({ dashboard, counts, worklist }) {
  return (
    <>
      <section className="command-grid">
        <QueueCard
          label="Pacientes"
          count={counts.total}
          detail={`${counts.allowed} liberado(s), ${counts.blocked} bloqueado(s).`}
          tone={counts.blocked ? "warn" : "good"}
        />
        <QueueCard
          label="Validades proximas"
          count={counts.expiring}
          detail={
            counts.expiring
              ? "Receita ou carteirinha vence em ate 30 dias."
              : "Sem alerta de validade em 30 dias."
          }
          tone={counts.expiring ? "warn" : "good"}
        />
        <QueueCard
          label="Documentos"
          count={dashboard.prescriptionDocuments.length}
          detail="Receitas privadas registradas para auditoria e download controlado."
        />
      </section>

      {worklist.length ? (
        worklist.map(({ patient, documents, latestOrder }) => (
          <PatientCard
            key={patient.id}
            patient={patient}
            documents={documents}
            latestOrder={latestOrder}
          />
        ))
      ) : (
        <p className="muted">Nenhum paciente corresponde aos filtros atuais.</p>
      )}
    </>
  );
}

function QueueCard({ label, count, detail, tone = "" }) {
  return (
    <article className={`queue-card ${tone}`.trim()}>
      <span>{label}</span>
      <strong>{count}</strong>
      <p>{detail}</p>
    </article>
  );
}

function PatientCard({ patient, documents, latestOrder }) {
  return (
    <article className="order-card order-row">
      <div>
        <h3>{patient.name}</h3>
        <p>
          {patient.memberCode} - receita ate {formatDate(patient.prescriptionExpiresAt)} -
          carteirinha ate {formatDate(patient.cardExpiresAt)}
        </p>
        <p>{profileLine(patient)}</p>
        <p className="muted">{patient.eligibility?.reason || "Paciente liberado."}</p>
        <p className="muted">
          {patient.carePlan
            ? `Plano de cuidado: ${patient.carePlan}`
            : "Plano de cuidado pendente no cadastro."}
        </p>
        <p className="muted">
          {patient.privacyConsentAt
            ? `Privacidade: aceite ${patient.privacyConsentVersion || "lgpd-2026-05"} em ${formatDateTime(patient.privacyConsentAt)}`
            : "Privacidade: aceite pendente."}
        </p>
        <p className="muted">
          {patient.inviteResetAt
            ? `Convite reiniciado em ${formatDateTime(patient.inviteResetAt)}.`
            : "Convite ainda nao reiniciado pela equipe."}
        </p>
        {patient.supportNote ? <p className="muted">Nota interna: {patient.supportNote}</p> : null}
        <p className="muted">
          {latestOrder
            ? `Ultimo pedido ${latestOrder.id}: ${latestOrder.status}`
            : "Sem pedido registrado."}
        </p>
        {documents.length ? (
          <div className="stack">
            {documents.map((document) => (
              <DocumentLink key={document.id} document={document} />
            ))}
          </div>
        ) : null}
      </div>
      <span className={`pill ${patient.eligibility?.allowed ? "" : "danger"}`.trim()}>
        {patient.eligibility?.allowed ? "liberado" : "bloqueado"}
      </span>
    </article>
  );
}

function DocumentLink({ document }) {
  return (
    <article className="order-card order-row">
      <div>
        <strong>{document.fileName}</strong>
        <p>
          validade {formatDate(document.expiresAt)} - hash{" "}
          {String(document.sha256 || "").slice(0, 12)}...
        </p>
      </div>
      <a
        className="mini"
        href={`/api/team/prescription-documents/${document.id}/download`}
        target="_blank"
        rel="noreferrer"
      >
        Baixar receita
      </a>
    </article>
  );
}

function profileLine(patient) {
  const contact = patient.contactPhone || patient.email || "contato nao informado";
  const place = [patient.city, patient.state].filter(Boolean).join("/");
  const guardian = patient.guardianName
    ? `responsavel ${patient.guardianName}`
    : "responsavel nao informado";
  return [contact, place, guardian].filter(Boolean).join(" - ");
}

function buildPatientWorklist(dashboard, query, status) {
  if (!dashboard) return [];
  const normalizedQuery = normalize(query);

  return dashboard.patients
    .map((patient) => {
      const orders = dashboard.orders.filter((order) => order.patientId === patient.id);
      const documents = dashboard.prescriptionDocuments.filter(
        (document) =>
          document.patientId === patient.id || document.memberCode === patient.memberCode,
      );
      return { patient, latestOrder: orders[0] || null, documents };
    })
    .filter(({ patient, latestOrder, documents }) => {
      const matchesQuery = textIncludes(
        [
          patient.name,
          patient.memberCode,
          patient.eligibility?.reason,
          patient.prescriptionExpiresAt,
          patient.cardExpiresAt,
          patient.lastLoginAt,
          latestOrder?.id,
          latestOrder?.status,
          latestOrder?.paymentStatus,
          ...documents.map((document) => document.fileName),
        ],
        normalizedQuery,
      );
      const matchesStatus =
        status === "all" ||
        (status === "allowed" && patient.eligibility?.allowed) ||
        (status === "blocked" && !patient.eligibility?.allowed) ||
        (status === "expiring" && patientExpiring(patient));
      return matchesQuery && matchesStatus;
    });
}

function patientCounts(dashboard) {
  const patients = dashboard?.patients || [];
  return {
    total: patients.length,
    allowed: patients.filter((patient) => patient.eligibility?.allowed).length,
    blocked: patients.filter((patient) => !patient.eligibility?.allowed).length,
    expiring: patients.filter(patientExpiring).length,
  };
}

function patientExpiring(patient) {
  return Math.min(daysUntil(patient.prescriptionExpiresAt), daysUntil(patient.cardExpiresAt)) <= 30;
}

function daysUntil(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(`${value}T12:00:00-03:00`);
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function formatDate(value) {
  if (!value) return "sem validade";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
    new Date(`${value}T12:00:00-03:00`),
  );
}

function formatDateTime(value) {
  if (!value) return "sem registro";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function textIncludes(values, query) {
  if (!query) return true;
  return values.some((value) => normalize(value).includes(query));
}

function formPayload(form) {
  return Object.fromEntries(new FormData(form));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Erro na requisicao.");
  return payload;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    });
    reader.addEventListener("error", () =>
      reject(reader.error || new Error("Nao foi possivel ler o arquivo.")),
    );
    reader.readAsDataURL(file);
  });
}
