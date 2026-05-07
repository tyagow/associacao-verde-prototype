const ACCESS_CODE = "APOIAR2026";
const storageKey = "apoio-reserva-mvp";
const DATA_VERSION = "20260507-4";

const demoState = {
  version: DATA_VERSION,
  unlocked: false,
  products: [
    {
      id: "oleo-cbd-10",
      name: "Oleo CBD 10%",
      description: "Frasco para pacientes com prescricao ativa, separado pela equipe da associacao.",
      unit: "frasco",
      price: 180,
      stock: 23,
      image: "url('https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80')",
    },
    {
      id: "oleo-full-20",
      name: "Oleo Full Spectrum 20%",
      description: "Opcao para pedidos recorrentes, com conferencia de receita antes da entrega.",
      unit: "frasco",
      price: 240,
      stock: 13,
      image: "url('https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=80')",
    },
    {
      id: "flor-24k",
      name: "Flor 24k",
      description: "Produto em gramas, controlado por lote e disponibilidade de estoque.",
      unit: "g",
      price: 22,
      stock: 92,
      image: "url('https://images.unsplash.com/photo-1603909223429-69bb7101f420?auto=format&fit=crop&w=900&q=80')",
    },
    {
      id: "oleo-cbn-noite",
      name: "Oleo CBN Noite",
      description: "Formula de apoio noturno para pacientes com prescricao e acompanhamento ativo.",
      unit: "frasco",
      price: 210,
      stock: 9,
      image: "url('https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=80')",
    },
    {
      id: "pomada-topica",
      name: "Pomada Topica CBD",
      description: "Uso topico conforme orientacao medica, separada pela equipe em pedidos confirmados.",
      unit: "un",
      price: 95,
      stock: 17,
      image: "url('https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=900&q=80')",
    },
    {
      id: "gomas-cbd",
      name: "Gomas CBD 5mg",
      description: "Caixa com doses padronizadas para pacientes com receita valida.",
      unit: "cx",
      price: 130,
      stock: 6,
      image: "url('https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=900&q=80')",
    },
  ],
  cart: [],
  orders: [
    {
      id: "PED-1027",
      patient: "Helena Rocha",
      memberCode: "APO-1027",
      delivery: "GED Log via Melhor Envio",
      items: [
        { name: "Oleo CBD 10%", unit: "frasco", quantity: 1, subtotal: 180 },
        { name: "Pomada Topica CBD", unit: "un", quantity: 1, subtotal: 95 },
      ],
      total: 275,
    },
    {
      id: "PED-1026",
      patient: "Marina Lima",
      memberCode: "APO-1026",
      delivery: "Correios via Melhor Envio",
      items: [{ name: "Flor 24k", unit: "g", quantity: 8, subtotal: 176 }],
      total: 176,
    },
    {
      id: "PED-1025",
      patient: "Caio Martins",
      memberCode: "APO-1025",
      delivery: "Retirada combinada",
      items: [{ name: "Oleo Full Spectrum 20%", unit: "frasco", quantity: 1, subtotal: 240 }],
      total: 240,
    },
  ],
  movements: [
    { id: "m1", productId: "flor-24k", type: "Entrada", quantity: 100, note: "Saldo inicial do lote 24k" },
    { id: "m2", productId: "oleo-cbd-10", type: "Entrada", quantity: 24, note: "Saldo inicial oleo CBD 10%" },
    { id: "m3", productId: "oleo-full-20", type: "Entrada", quantity: 14, note: "Saldo inicial Full Spectrum 20%" },
    { id: "m4", productId: "oleo-cbn-noite", type: "Entrada", quantity: 9, note: "Entrada de lote noturno" },
    { id: "m5", productId: "pomada-topica", type: "Entrada", quantity: 18, note: "Entrada de topicos" },
    { id: "m6", productId: "gomas-cbd", type: "Entrada", quantity: 6, note: "Entrada de caixas padronizadas" },
    { id: "m7", productId: "pomada-topica", type: "Saida", quantity: 1, note: "Baixa automática pelo pedido PED-1027" },
    { id: "m8", productId: "oleo-cbd-10", type: "Saida", quantity: 1, note: "Baixa automática pelo pedido PED-1027" },
    { id: "m9", productId: "flor-24k", type: "Saida", quantity: 8, note: "Baixa automática pelo pedido PED-1026" },
    { id: "m10", productId: "oleo-full-20", type: "Saida", quantity: 1, note: "Baixa automática pelo pedido PED-1025" },
  ],
};

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return normalizeState(structuredClone(demoState));

  const parsed = JSON.parse(saved);
  if (parsed.version !== DATA_VERSION) {
    const fresh = structuredClone(demoState);
    fresh.unlocked = Boolean(parsed.unlocked);
    return normalizeState(fresh);
  }

  return normalizeState(parsed);
}

function normalizeState(nextState) {
  nextState.movements ||= structuredClone(demoState.movements);
  nextState.orders ||= [];
  nextState.cart ||= [];
  for (const product of nextState.products) {
    product.stock = Number(product.stock || 0);
  }
  return nextState;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function money(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function quantity(value, unit) {
  return `${value} ${unit}`;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2600);
}

function showApp() {
  document.querySelector("#access-gate").hidden = true;
  document.querySelector("#site-shell").hidden = false;
  state.unlocked = true;
  saveState();
  render();
}

function productById(id) {
  return state.products.find((product) => product.id === id);
}

function cartQuantity(productId) {
  return state.cart.find((item) => item.productId === productId)?.quantity || 0;
}

function updateCart(productId, delta) {
  const product = productById(productId);
  const current = state.cart.find((item) => item.productId === productId);
  const nextQuantity = Math.max(0, cartQuantity(productId) + delta);

  if (nextQuantity > product.stock) {
    showToast("Quantidade maior que o estoque disponível.");
    return;
  }

  if (!current && nextQuantity > 0) {
    state.cart.push({ productId, quantity: nextQuantity });
  } else if (current && nextQuantity === 0) {
    state.cart = state.cart.filter((item) => item.productId !== productId);
  } else if (current) {
    current.quantity = nextQuantity;
  }

  saveState();
  render();
}

function renderProducts() {
  document.querySelector("#product-grid").innerHTML = state.products
    .map((product) => {
      const inCart = cartQuantity(product.id);
      const stockClass = product.stock <= 10 ? "stock-pill low" : "stock-pill";
      return `
        <article class="product-card">
          <div class="product-media" style="--image: ${product.image}"></div>
          <div class="product-body">
            <div class="meta-row">
              <span class="${stockClass}">${quantity(product.stock, product.unit)} em estoque</span>
              <span class="price">${money(product.price)}</span>
            </div>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="qty-stepper" aria-label="Quantidade de ${product.name}">
              <button data-cart-dec="${product.id}" aria-label="Diminuir ${product.name}">−</button>
              <strong>${quantity(inCart, product.unit)} no carrinho</strong>
              <button data-cart-inc="${product.id}" aria-label="Adicionar ${product.name}">+</button>
            </div>
            <button class="green-button" data-add-one="${product.id}">Adicionar ao pedido</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelector("#cart-count").textContent = count;

  if (!state.cart.length) {
    document.querySelector("#cart-items").innerHTML = `<p class="empty">Nenhum item no carrinho.</p>`;
    document.querySelector("#stock-impact").innerHTML = "";
    return;
  }

  const total = state.cart.reduce((sum, item) => {
    const product = productById(item.productId);
    return sum + product.price * item.quantity;
  }, 0);

  document.querySelector("#cart-items").innerHTML = `
    ${state.cart
      .map((item) => {
        const product = productById(item.productId);
        return `
          <article class="cart-item">
            <div>
              <strong>${product.name}</strong>
              <br>
              <span>${quantity(item.quantity, product.unit)} × ${money(product.price)}</span>
            </div>
            <strong>${money(product.price * item.quantity)}</strong>
          </article>
        `;
      })
      .join("")}
    <article class="cart-item">
      <strong>Total estimado</strong>
      <strong>${money(total)}</strong>
    </article>
  `;

  document.querySelector("#stock-impact").innerHTML = `
    <strong>Baixa automática prevista</strong>
    ${state.cart
      .map((item) => {
        const product = productById(item.productId);
        return `<span>${product.name}: ${quantity(product.stock, product.unit)} → ${quantity(product.stock - item.quantity, product.unit)}</span>`;
      })
      .join("")}
  `;
}

function renderStockForm() {
  document.querySelector("#stock-product").innerHTML = state.products
    .map((product) => `<option value="${product.id}">${product.name} (${quantity(product.stock, product.unit)})</option>`)
    .join("");
}

function renderOrders() {
  if (!state.orders.length) {
    document.querySelector("#orders-list").innerHTML = `<p class="empty">Nenhum pedido confirmado nesta demo.</p>`;
    return;
  }

  document.querySelector("#orders-list").innerHTML = state.orders
    .map(
      (order) => `
        <article class="order-item">
          <div>
            <strong>${order.patient}</strong>
            <p>${order.items.map((item) => `${quantity(item.quantity, item.unit)} ${item.name}`).join(" · ")}</p>
            <span>${order.delivery} · ${order.memberCode}</span>
          </div>
          <strong>${money(order.total)}</strong>
        </article>
      `,
    )
    .join("");
}

function render() {
  renderProducts();
  renderCart();
  renderStockForm();
  renderInventory();
  renderMovements();
  renderOrders();
}

function renderInventory() {
  document.querySelector("#inventory-grid").innerHTML = state.products
    .map((product) => {
      const reserved = cartQuantity(product.id);
      return `
        <article class="inventory-card">
          <span>${product.name}</span>
          <strong>${quantity(product.stock, product.unit)}</strong>
          <small>${reserved ? `${quantity(reserved, product.unit)} no carrinho atual` : "sem reserva no carrinho"}</small>
        </article>
      `;
    })
    .join("");
}

function renderMovements() {
  document.querySelector("#movement-list").innerHTML = [...state.movements]
    .slice(-8)
    .reverse()
    .map((movement) => {
      const product = productById(movement.productId);
      const sign = movement.type === "Saida" ? "-" : "+";
      return `
        <article class="movement-item ${movement.type === "Saida" ? "out" : "in"}">
          <div>
            <strong>${movement.type} · ${product?.name || "Produto"}</strong>
            <span>${movement.note}</span>
          </div>
          <b>${sign}${quantity(movement.quantity, product?.unit || "")}</b>
        </article>
      `;
    })
    .join("");
}

document.querySelector("#access-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const code = document.querySelector("#access-code").value.trim().toUpperCase().replace(/[\s-]/g, "");
  if (code !== ACCESS_CODE) {
    alert("Codigo invalido para esta demo.");
    return;
  }
  showApp();
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.cartInc) {
    updateCart(target.dataset.cartInc, 1);
    document.querySelector("#cart-drawer").classList.add("open");
  }
  if (target.dataset.cartDec) updateCart(target.dataset.cartDec, -1);
  if (target.dataset.addOne) {
    updateCart(target.dataset.addOne, 1);
    document.querySelector("#cart-drawer").classList.add("open");
  }
  if (target.id === "cart-toggle") document.querySelector("#cart-drawer").classList.add("open");
  if (target.id === "close-cart") document.querySelector("#cart-drawer").classList.remove("open");
  if (target.id === "admin-toggle") document.querySelector("#admin-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  if (target.id === "reset-demo") {
    state = structuredClone(demoState);
    state.unlocked = true;
    saveState();
    render();
  }
  if (target.id === "copy-link") {
    await navigator.clipboard.writeText(window.location.href);
    target.textContent = "Link copiado";
    setTimeout(() => {
      target.textContent = "Copiar link do paciente";
    }, 1500);
  }
});

document.querySelector("#stock-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const product = productById(document.querySelector("#stock-product").value);
  const quantity = Number(document.querySelector("#stock-amount").value);
  product.stock += quantity;
  state.movements.push({
    id: `MOV-${Date.now()}`,
    productId: product.id,
    type: "Entrada",
    quantity,
    note: document.querySelector("#stock-note").value || "Entrada adicionada pela equipe",
  });
  document.querySelector("#stock-note").value = "";
  saveState();
  render();
  showToast(`Estoque atualizado: +${quantity} ${product.unit} de ${product.name}.`);
});

document.querySelector("#checkout-form").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!state.cart.length) {
    showToast("Adicione ao menos um item ao carrinho.");
    return;
  }

  for (const item of state.cart) {
    const product = productById(item.productId);
    if (item.quantity > product.stock) {
      showToast(`Estoque insuficiente para ${product.name}.`);
      return;
    }
  }

  const items = state.cart.map((item) => {
    const product = productById(item.productId);
    return {
      name: product.name,
      unit: product.unit,
      quantity: item.quantity,
      subtotal: item.quantity * product.price,
    };
  });

  const orderId = `PED-${Date.now()}`;

  for (const item of state.cart) {
    const product = productById(item.productId);
    product.stock -= item.quantity;
    state.movements.push({
      id: `MOV-${Date.now()}-${product.id}`,
      productId: product.id,
      type: "Saida",
      quantity: item.quantity,
      note: `Baixa automática pelo pedido ${orderId}`,
    });
  }

  state.orders.unshift({
    id: orderId,
    patient: document.querySelector("#patient-name").value,
    memberCode: document.querySelector("#member-code").value,
    delivery: document.querySelector("#delivery-method").value,
    items,
    total: items.reduce((sum, item) => sum + item.subtotal, 0),
  });

  state.cart = [];
  event.currentTarget.reset();
  document.querySelector("#cart-drawer").classList.remove("open");
  saveState();
  render();
  document.querySelector("#orders-list").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Compra confirmada. O estoque foi atualizado automaticamente.");
});

if (state.unlocked) {
  showApp();
}
