const ACCESS_CODE = "APOIAR2026";
const storageKey = "apoio-reserva-mvp";

const demoState = {
  unlocked: false,
  products: [
    {
      id: "oleo-cbd-10",
      name: "Oleo CBD 10%",
      description: "Frasco para pacientes com prescricao ativa, separado pela equipe da associacao.",
      unit: "frasco",
      price: 180,
      stock: 24,
      image: "url('https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80')",
    },
    {
      id: "oleo-full-20",
      name: "Oleo Full Spectrum 20%",
      description: "Opcao para pedidos recorrentes, com conferencia de receita antes da entrega.",
      unit: "frasco",
      price: 240,
      stock: 14,
      image: "url('https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=80')",
    },
    {
      id: "flor-24k",
      name: "Flor 24k",
      description: "Produto em gramas, controlado por lote e disponibilidade de estoque.",
      unit: "g",
      price: 22,
      stock: 100,
      image: "url('https://images.unsplash.com/photo-1603909223429-69bb7101f420?auto=format&fit=crop&w=900&q=80')",
    },
  ],
  cart: [],
  orders: [],
};

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(storageKey);
  return saved ? JSON.parse(saved) : structuredClone(demoState);
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function money(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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
    alert("Quantidade maior que o estoque disponivel.");
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
              <span class="${stockClass}">${product.stock}${product.unit} em estoque</span>
              <span class="price">${money(product.price)}</span>
            </div>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="qty-stepper" aria-label="Quantidade de ${product.name}">
              <button data-cart-dec="${product.id}" aria-label="Diminuir ${product.name}">−</button>
              <strong>${inCart} no carrinho</strong>
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
              <span>${item.quantity}${product.unit} × ${money(product.price)}</span>
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
}

function renderStockForm() {
  document.querySelector("#stock-product").innerHTML = state.products
    .map((product) => `<option value="${product.id}">${product.name} (${product.stock}${product.unit})</option>`)
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
            <p>${order.items.map((item) => `${item.quantity}${item.unit} ${item.name}`).join(" · ")}</p>
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
  renderOrders();
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
  if (target.id === "admin-toggle") {
    const panel = document.querySelector("#admin-panel");
    panel.hidden = !panel.hidden;
  }
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
  product.stock += Number(document.querySelector("#stock-amount").value);
  saveState();
  render();
});

document.querySelector("#checkout-form").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!state.cart.length) {
    alert("Adicione ao menos um item ao carrinho.");
    return;
  }

  for (const item of state.cart) {
    const product = productById(item.productId);
    if (item.quantity > product.stock) {
      alert(`Estoque insuficiente para ${product.name}.`);
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

  for (const item of state.cart) {
    productById(item.productId).stock -= item.quantity;
  }

  state.orders.unshift({
    id: `PED-${Date.now()}`,
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
  alert("Compra confirmada. O estoque foi atualizado automaticamente.");
});

if (state.unlocked) {
  showApp();
}
