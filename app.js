const seedState = {
  patients: [
    {
      id: "p1",
      name: "Helena Rocha",
      guardian: "",
      prescription: "2026-06-18",
      note: "Receita anexada. Dose revisada.",
    },
    {
      id: "p2",
      name: "Joao Lima",
      guardian: "Marina Lima, mae",
      prescription: "2026-05-29",
      note: "Menor de idade. Responsavel validado.",
    },
    {
      id: "p3",
      name: "Caio Martins",
      guardian: "",
      prescription: "2026-08-04",
      note: "Carteirinha ativa.",
    },
  ],
  batches: [
    { id: "b1", strain: "24k", week: 6, plants: 18, harvested: 0, dried: 0 },
    { id: "b2", strain: "Harlequin", week: 3, plants: 12, harvested: 0, dried: 0 },
    { id: "b3", strain: "Manga Rosa CBD", week: 10, plants: 9, harvested: 420, dried: 112 },
  ],
  stock: [
    { strain: "24k", grams: 100 },
    { strain: "Manga Rosa CBD", grams: 112 },
    { strain: "Harlequin", grams: 64 },
  ],
  orders: [
    {
      id: "o1",
      patientId: "p1",
      product: "24k",
      grams: 15,
      status: "separacao",
      payment: "Pago",
      shipping: "GED Log via Melhor Envio",
      tracking: "",
    },
    {
      id: "o2",
      patientId: "p2",
      product: "Harlequin",
      grams: 10,
      status: "pagamento",
      payment: "Aguardando link",
      shipping: "Correios via Melhor Envio",
      tracking: "",
    },
  ],
};

let state = loadState();
let cardIndex = 0;

const titles = {
  dashboard: "Painel da associacao",
  patients: "Pacientes e receitas",
  grow: "Plantio e estoque",
  orders: "Pedidos e envios",
  triage: "Triagem medica",
};

function loadState() {
  const saved = localStorage.getItem("associacao-verde-state");
  return saved ? JSON.parse(saved) : structuredClone(seedState);
}

function saveState() {
  localStorage.setItem("associacao-verde-state", JSON.stringify(state));
}

function fmtDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(`${value}T12:00:00`));
}

function daysUntil(value) {
  const today = new Date("2026-05-07T12:00:00-03:00");
  const date = new Date(`${value}T12:00:00-03:00`);
  return Math.ceil((date - today) / 86400000);
}

function patientName(id) {
  return state.patients.find((patient) => patient.id === id)?.name || "Paciente removido";
}

function renderIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function setView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  document.querySelector("#view-title").textContent = titles[viewId];
}

function renderMetrics() {
  const openOrders = state.orders.filter((order) => order.status !== "enviado").length;
  const expiring = state.patients.filter((patient) => daysUntil(patient.prescription) <= 45).length;
  const available = state.stock.reduce((sum, item) => sum + item.grams, 0);
  const harvestReady = state.batches.filter((batch) => batch.week >= 9).length;

  document.querySelector("#metrics").innerHTML = [
    ["Pedidos abertos", openOrders],
    ["Receitas ate 45 dias", expiring],
    ["Estoque disponivel", `${available}g`],
    ["Lotes prontos", harvestReady],
  ]
    .map(([label, value]) => `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderTasks() {
  const tasks = [
    ["package-check", "Separar pedidos pagos", `${state.orders.filter((order) => order.status === "separacao").length} na bancada`],
    ["credit-card", "Enviar link de pagamento", `${state.orders.filter((order) => order.status === "pagamento").length} pendente`],
    ["truck", "Gerar etiqueta Melhor Envio", `${state.orders.filter((order) => order.status === "envio").length} pronto`],
    ["badge-check", "Renovar carteirinhas", `${state.patients.filter((patient) => daysUntil(patient.prescription) <= 30).length} proximas`],
  ];

  document.querySelector("#daily-tasks").innerHTML = tasks
    .map(
      ([icon, title, detail]) => `
        <article class="task-item">
          <span data-icon="${icon}"></span>
          <strong>${title}</strong>
          <span class="status-pill amber">${detail}</span>
        </article>
      `,
    )
    .join("");
}

function renderExpiry() {
  const rows = [...state.patients].sort((a, b) => daysUntil(a.prescription) - daysUntil(b.prescription));
  document.querySelector("#expiry-list").innerHTML = rows
    .map((patient) => {
      const days = daysUntil(patient.prescription);
      const color = days <= 30 ? "red" : days <= 45 ? "amber" : "green";
      return `
        <article class="stock-item">
          <div>
            <strong>${patient.name}</strong>
            <span>${fmtDate(patient.prescription)}</span>
          </div>
          <span class="status-pill ${color}">${days} dias</span>
        </article>
      `;
    })
    .join("");
}

function renderPatients() {
  document.querySelector("#patient-table").innerHTML = state.patients
    .map((patient) => {
      const days = daysUntil(patient.prescription);
      const order = state.orders.find((item) => item.patientId === patient.id && item.status !== "enviado");
      return `
        <tr>
          <td><strong>${patient.name}</strong><br><span>${patient.note}</span></td>
          <td>${patient.guardian || "Paciente maior de idade"}</td>
          <td>${fmtDate(patient.prescription)}<br><span>${days} dias restantes</span></td>
          <td><span class="status-pill ${days <= 30 ? "red" : "green"}">${days <= 0 ? "Vencida" : "Ativa"}</span></td>
          <td>${order ? `${order.product}, ${order.grams}g` : "Nenhum"}</td>
        </tr>
      `;
    })
    .join("");

  renderCard();
}

function renderCard() {
  if (!state.patients.length) return;
  const patient = state.patients[cardIndex % state.patients.length];
  document.querySelector("#member-card").innerHTML = `
    <small>Carteirinha de associado</small>
    <h3>${patient.name}</h3>
    <p>${patient.guardian ? `Responsavel: ${patient.guardian}` : "Titular responsavel pelo cadastro"}</p>
    <span>Valida ate ${fmtDate(patient.prescription)}</span>
    <br>
    <span>ID AV-${patient.id.toUpperCase()}-${patient.prescription.slice(5).replace("-", "")}</span>
  `;
}

function renderGrow() {
  const columns = [
    ["vegetativo", "Semanas 1-4", (batch) => batch.week <= 4],
    ["floracao", "Semanas 5-8", (batch) => batch.week >= 5 && batch.week <= 8],
    ["colheita", "Colheita/secagem", (batch) => batch.week >= 9],
    ["estoque", "Saida para estoque", (batch) => batch.dried > 0],
  ];

  document.querySelector("#grow-board").innerHTML = columns
    .map(
      ([key, title, filter]) => `
        <section class="kanban-column">
          <div class="column-title">${title}<span>${state.batches.filter(filter).length}</span></div>
          ${state.batches
            .filter(filter)
            .map((batch) => batchCard(batch, key))
            .join("")}
        </section>
      `,
    )
    .join("");
}

function batchCard(batch, key) {
  const actions = [];
  if (key !== "estoque") actions.push(`<button class="mini-button" data-batch-week="${batch.id}">Avancar semana</button>`);
  if (batch.week >= 9 && !batch.harvested) actions.push(`<button class="mini-button" data-batch-harvest="${batch.id}">Registrar colheita</button>`);
  if (batch.harvested && !batch.dried) actions.push(`<button class="mini-button" data-batch-dry="${batch.id}">Registrar seco</button>`);
  if (batch.dried) actions.push(`<button class="mini-button" data-stock-out="${batch.id}">Dar saida</button>`);

  return `
    <article class="batch-card">
      <strong>${batch.strain}</strong>
      <span>Semana ${batch.week} | ${batch.plants} plantas</span>
      <span>Colhido: ${batch.harvested}g | Seco: ${batch.dried}g</span>
      <div class="card-actions">${actions.join("")}</div>
    </article>
  `;
}

function renderStock() {
  document.querySelector("#stock-list").innerHTML = state.stock
    .map(
      (item) => `
        <article class="stock-item">
          <div><strong>${item.strain}</strong><span>Disponivel para pedido</span></div>
          <span class="status-pill ${item.grams < 30 ? "red" : "green"}">${item.grams}g</span>
        </article>
      `,
    )
    .join("");
}

function renderOrders() {
  const columns = [
    ["pagamento", "Pagamento"],
    ["separacao", "Separacao"],
    ["envio", "Melhor Envio"],
    ["enviado", "Enviado"],
  ];

  document.querySelector("#order-board").innerHTML = columns
    .map(
      ([status, title]) => `
        <section class="order-column">
          <div class="column-title">${title}<span>${state.orders.filter((order) => order.status === status).length}</span></div>
          ${state.orders
            .filter((order) => order.status === status)
            .map(orderCard)
            .join("")}
        </section>
      `,
    )
    .join("");
}

function orderCard(order) {
  const next = {
    pagamento: "Marcar pago",
    separacao: "Separar pedido",
    envio: "Gerar etiqueta",
    enviado: "Concluido",
  }[order.status];
  return `
    <article class="order-card">
      <strong>${patientName(order.patientId)}</strong>
      <span>${order.product} | ${order.grams}g</span>
      <span>${order.payment} | ${order.shipping}</span>
      <div class="card-actions">
        <button class="mini-button" data-order-next="${order.id}" ${order.status === "enviado" ? "disabled" : ""}>${next}</button>
      </div>
    </article>
  `;
}

function populateOrderForm() {
  document.querySelector("#order-patient").innerHTML = state.patients
    .map((patient) => `<option value="${patient.id}">${patient.name}</option>`)
    .join("");
  document.querySelector("#order-product").innerHTML = state.stock
    .filter((item) => item.grams > 0)
    .map((item) => `<option value="${item.strain}">${item.strain} (${item.grams}g)</option>`)
    .join("");
}

function renderAll() {
  renderMetrics();
  renderTasks();
  renderExpiry();
  renderPatients();
  renderGrow();
  renderStock();
  renderOrders();
  populateOrderForm();
  renderIcons();
}

function advanceOrder(order) {
  if (order.status === "pagamento") {
    order.status = "separacao";
    order.payment = "Pago";
  } else if (order.status === "separacao") {
    order.status = "envio";
  } else if (order.status === "envio") {
    order.status = "enviado";
    order.tracking = `ME-${Math.floor(100000 + Math.random() * 900000)}`;
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.view) setView(target.dataset.view);
  if (target.dataset.viewJump) setView(target.dataset.viewJump);
  if (target.dataset.openDialog) document.querySelector(`#${target.dataset.openDialog}`).showModal();
  if (target.dataset.closeDialog !== undefined) target.closest("dialog")?.close();

  if (target.id === "reset-demo") {
    state = structuredClone(seedState);
    saveState();
    renderAll();
  }

  if (target.id === "cycle-card") {
    cardIndex += 1;
    renderCard();
  }

  if (target.dataset.batchWeek) {
    const batch = state.batches.find((item) => item.id === target.dataset.batchWeek);
    batch.week = Math.min(batch.week + 1, 12);
    saveState();
    renderAll();
  }

  if (target.dataset.batchHarvest) {
    const batch = state.batches.find((item) => item.id === target.dataset.batchHarvest);
    batch.harvested = batch.plants * 42;
    saveState();
    renderAll();
  }

  if (target.dataset.batchDry) {
    const batch = state.batches.find((item) => item.id === target.dataset.batchDry);
    batch.dried = Math.round(batch.harvested * 0.28);
    const stockItem = state.stock.find((item) => item.strain === batch.strain);
    if (stockItem) stockItem.grams += batch.dried;
    else state.stock.push({ strain: batch.strain, grams: batch.dried });
    saveState();
    renderAll();
  }

  if (target.dataset.stockOut) {
    alert("Saida registrada: o lote seco ja esta disponivel para pedidos e auditoria de estoque.");
  }

  if (target.dataset.orderNext) {
    const order = state.orders.find((item) => item.id === target.dataset.orderNext);
    advanceOrder(order);
    saveState();
    renderAll();
  }
});

document.querySelector("#patient-form").addEventListener("submit", (event) => {
  const data = Object.fromEntries(new FormData(event.currentTarget));
  state.patients.push({
    id: `p${Date.now()}`,
    name: data.name,
    guardian: data.guardian,
    prescription: data.prescription,
    note: data.note || "Cadastro criado no prototipo.",
  });
  event.currentTarget.reset();
  saveState();
  renderAll();
});

document.querySelector("#batch-form").addEventListener("submit", (event) => {
  const data = Object.fromEntries(new FormData(event.currentTarget));
  state.batches.push({
    id: `b${Date.now()}`,
    strain: data.strain,
    week: Number(data.week),
    plants: Number(data.plants),
    harvested: 0,
    dried: 0,
  });
  event.currentTarget.reset();
  saveState();
  renderAll();
});

document.querySelector("#order-form").addEventListener("submit", (event) => {
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const grams = Number(data.grams);
  const stockItem = state.stock.find((item) => item.strain === data.product);

  if (!stockItem || stockItem.grams < grams) {
    alert("Estoque insuficiente para esse pedido.");
    return;
  }

  stockItem.grams -= grams;
  state.orders.push({
    id: `o${Date.now()}`,
    patientId: data.patient,
    product: data.product,
    grams,
    status: "pagamento",
    payment: "Aguardando link",
    shipping: data.shipping,
    tracking: "",
  });
  event.currentTarget.reset();
  saveState();
  renderAll();
});

renderAll();
