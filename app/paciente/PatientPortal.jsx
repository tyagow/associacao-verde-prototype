"use client";

import Brand from "../components/Brand";
import { useEffect, useMemo, useState } from "react";
import CatalogDrawer from "./components/CatalogDrawer";
import PatientShell from "./components/PatientShell";
import PatientTabs, { PATIENT_TABS } from "./components/PatientTabs";
import ProfileDrawer from "./components/ProfileDrawer";
import Toast from "./components/Toast";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function PatientPortal() {
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({});
  const [deliveryMethod, setDeliveryMethod] = useState("GED Log via Melhor Envio");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [productQuantities, setProductQuantities] = useState({});
  const [accessIssue, setAccessIssue] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentTab, setCurrentTab] = useState("pedido");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const patient = session?.role === "patient" ? session.patient : null;
  const hasPrivacyConsent = Boolean(patient?.privacyConsentAt);
  const latestOrder = orders[0] || null;
  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, quantity]) => {
          const product = products.find((item) => item.id === productId);
          return product
            ? { product, quantity, subtotalCents: product.priceCents * quantity }
            : null;
        })
        .filter(Boolean),
    [cart, products],
  );
  const cartTotal = cartItems.reduce((sum, item) => sum + item.subtotalCents, 0);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const filteredProducts = useMemo(
    () => filterProducts(products, catalogQuery, catalogFilter),
    [products, catalogQuery, catalogFilter],
  );

  useEffect(() => {
    refreshSession();
  }, []);

  async function refreshSession() {
    const payload = await api("/api/session");
    setSession(payload.session);
    if (payload.session?.role === "patient") {
      await Promise.all([loadCatalog(), loadOrders()]);
    }
  }

  async function loadCatalog() {
    const payload = await api("/api/catalog");
    setProducts(payload.products || []);
  }

  async function loadOrders() {
    const payload = await api("/api/my-orders");
    setOrders(payload.orders || []);
  }

  async function onPatientLogin(event) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    await submitPatientLogin(form);
  }

  async function submitPatientLogin(form) {
    const payload = Object.fromEntries(new FormData(form));
    try {
      await api("/api/patient/login", { method: "POST", body: payload });
      form.reset();
      setAccessIssue("");
      await refreshSession();
      showToast("Paciente validado. Catalogo liberado.");
    } catch (error) {
      setAccessIssue(error.message);
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function onAccessRecovery(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      await api("/api/patient/access-recovery", { method: "POST", body: payload });
      showToast("Solicitacao de revisao enviada ao suporte.");
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function onCheckout(event) {
    event.preventDefault();
    if (!hasPrivacyConsent) return showToast("Aceite a privacidade e LGPD antes de gerar Pix.");
    await submitCheckout();
  }

  async function onSupportRequest(event) {
    event.preventDefault();
    if (!hasPrivacyConsent)
      return showToast("Aceite a privacidade e LGPD antes de enviar dados ao suporte.");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    if (latestOrder?.id && !payload.relatedOrderId) payload.relatedOrderId = latestOrder.id;
    setBusy(true);
    try {
      await api("/api/support-requests", { method: "POST", body: payload });
      form.reset();
      showToast("Solicitacao enviada ao suporte da associacao.");
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function onPrivacyConsent(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api("/api/patient/consent", {
        method: "POST",
        body: { accepted: true, version: "lgpd-2026-05" },
      });
      setSession((current) =>
        current?.role === "patient" ? { ...current, patient: result.patient } : current,
      );
      showToast("Aceite de privacidade registrado.");
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCheckout() {
    if (!cartItems.length) return showToast("Adicione ao menos um produto antes de gerar o Pix.");
    setBusy(true);
    try {
      const items = cartItems.map(({ product, quantity }) => ({ productId: product.id, quantity }));
      const result = await api("/api/checkout", {
        method: "POST",
        body: { items, deliveryMethod },
      });
      setCart({});
      await Promise.all([loadCatalog(), loadOrders()]);
      showToast(`Pix gerado para ${result.order.id}. Estoque reservado ate o vencimento.`);
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/logout", { method: "POST" });
    setSession(null);
    setProducts([]);
    setOrders([]);
    setCart({});
    setAccessIssue("");
    setCurrentTab("pedido");
    showToast("Sessao encerrada.");
  }

  function addProduct(productId) {
    if (!hasPrivacyConsent)
      return showToast("Aceite a privacidade e LGPD antes de montar o pedido.");
    const product = products.find((item) => item.id === productId);
    if (!product || product.availableStock <= 0)
      return showToast("Produto sem estoque autorizado no momento.");
    const quantity = Number(productQuantities[productId] || 1);
    if (quantity <= 0) return showToast("Informe uma quantidade valida.");
    if (quantity > product.availableStock)
      return showToast(`Quantidade maxima autorizada: ${product.availableStock} ${product.unit}.`);
    setCart((current) => ({ ...current, [productId]: quantity }));
    showToast(currentCartMessage(cart[productId], quantity));
  }

  function onProductQuantity(productId, value, max) {
    const quantity = Math.max(1, Math.min(max || 1, Number(value || 1)));
    setProductQuantities((current) => ({ ...current, [productId]: quantity }));
  }

  async function copyPix(code) {
    try {
      await navigator.clipboard.writeText(code);
      showToast("Codigo Pix copiado.");
    } catch {
      showToast("Selecione e copie o codigo Pix.");
    }
  }

  function showToast(message) {
    setToast(message || "Erro na requisicao.");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(""), 3200);
  }

  // ---- Render: logged-out path keeps the legacy hero + login form. ----
  if (!patient) {
    return (
      <>
        <header className="topbar">
          <Brand />
          <nav className="patient-nav" aria-label="Portal do paciente">
            <a className="ghost active" href="/paciente">
              Paciente
            </a>
            <a className="ghost" href="/">
              Inicio
            </a>
          </nav>
        </header>

        <main className="patient-portal">
          <section className="patient-portal-hero" aria-labelledby="patient-title">
            <div>
              <p className="kicker">Portal privado do paciente</p>
              <h1 id="patient-title">Acesso seguro ao tratamento autorizado.</h1>
              <p>
                Entre com seu codigo de associado e convite privado. O catalogo so abre depois que o
                servidor confirma cadastro ativo, receita valida, carteirinha vigente e associacao
                liberada.
              </p>
            </div>
            <aside className="patient-trust-panel" aria-label="Como o acesso funciona">
              <article>
                <span>1</span>
                <strong>Validacao</strong>
                <p>Cadastro, convite, receita e carteirinha.</p>
              </article>
              <article>
                <span>2</span>
                <strong>Pedido</strong>
                <p>Produtos autorizados e reserva controlada.</p>
              </article>
              <article>
                <span>3</span>
                <strong>Pix</strong>
                <p>Pagamento com codigo e vencimento claros.</p>
              </article>
            </aside>
          </section>

          <section className="patient-workspace">
            <article className="patient-profile-card">
              <div className="panel-heading compact-heading">
                <div>
                  <p className="kicker">Perfil e elegibilidade</p>
                  <h2>Entrar no portal</h2>
                  <p className="muted">
                    Use suas credenciais privadas para abrir o catalogo autorizado.
                  </p>
                </div>
                <span className="status" id="patient-status">
                  acesso bloqueado
                </span>
              </div>

              <form id="patient-login" className="patient-login-card" onSubmit={onPatientLogin}>
                <label>
                  Codigo de associado
                  <input
                    name="memberCode"
                    autoComplete="username"
                    placeholder="APO-1027"
                    required
                  />
                </label>
                <label>
                  Convite privado
                  <input
                    name="inviteCode"
                    autoComplete="one-time-code"
                    placeholder="HELENA2026"
                    required
                  />
                </label>
                <button className="accent" type="submit" disabled={busy}>
                  Entrar com seguranca
                </button>
              </form>

              <section id="access-issue" className="access-issue-panel" hidden={!accessIssue}>
                {accessIssue ? (
                  <AccessIssuePanel message={accessIssue} busy={busy} onSubmit={onAccessRecovery} />
                ) : null}
              </section>

              <div id="patient-summary" className="patient-profile-grid">
                <article className="access-card primary-access">
                  <span>Associado</span>
                  <strong>Acesso restrito</strong>
                  <p>O sistema valida os requisitos antes de liberar qualquer produto.</p>
                </article>
                <article className="access-card">
                  <span>Receita</span>
                  <strong>Obrigatoria</strong>
                  <p>Receita e carteirinha precisam estar vigentes.</p>
                </article>
                <article className="access-card muted-card">
                  <span>Pedido atual</span>
                  <strong>Nenhum pedido aberto</strong>
                  <p>Escolha produtos autorizados e gere Pix para reservar estoque.</p>
                </article>
              </div>
            </article>
          </section>
        </main>

        <Toast message={toast} />
      </>
    );
  }

  // ---- Render: authenticated path uses the new shell + tab sections. ----
  // Inactive sections stay mounted via `display:none` so every E2E selector
  // remains reachable regardless of which tab is active. Phase 1d will
  // tighten this back to true conditional rendering once selectors are
  // re-mapped per section.
  const isPedido = currentTab === "pedido";
  const isHistorico = currentTab === "historico";
  const isSuporte = currentTab === "suporte";
  const hidden = (active) => (active ? undefined : { display: "none" });

  return (
    <>
      <PatientShell
        name={patient.name}
        statusText={`${patient.name} liberado`}
        statusTone="good"
        tabs={
          <PatientTabs
            current={PATIENT_TABS.includes(currentTab) ? currentTab : "pedido"}
            onChange={setCurrentTab}
          />
        }
        actions={
          <button className="ghost" type="button" onClick={logout}>
            Sair
          </button>
        }
      >
        {/* ---- Cross-cutting blocks (always visible regardless of tab) ---- */}
        <article className="patient-profile-card">
          <div className="panel-heading compact-heading">
            <div>
              <p className="kicker">Perfil e elegibilidade</p>
              <h2>{patient.name}</h2>
              <p className="muted">
                {patient.memberCode} · {patient.eligibility?.reason || "Paciente liberado."}
              </p>
            </div>
          </div>

          <div id="patient-summary" className="patient-profile-grid">
            <article className="access-card primary-access">
              <span>Associado</span>
              <strong>{patient.name}</strong>
              <p>{patient.memberCode}</p>
            </article>
            <article className="access-card">
              <span>Receita</span>
              <strong>Valida ate {formatDate(patient.prescriptionExpiresAt)}</strong>
              <p>Carteirinha valida ate {formatDate(patient.cardExpiresAt)}.</p>
            </article>
            <article className={`access-card ${latestOrder ? "" : "muted-card"}`}>
              <span>Pedido atual</span>
              <strong>{latestOrder ? latestOrder.id : "Nenhum pedido aberto"}</strong>
              <p>
                {latestOrder
                  ? patientOrderStatusText(latestOrder)
                  : "Escolha produtos autorizados e gere Pix para reservar estoque."}
              </p>
            </article>
          </div>

          <section
            id="privacy-consent-panel"
            className={`privacy-consent-panel ${patient.privacyConsentAt ? "good" : "warn"}`}
          >
            {patient.privacyConsentAt ? (
              <>
                <span className="kicker">Privacidade e LGPD</span>
                <h3>Consentimento registrado</h3>
                <p>
                  Versao {patient.privacyConsentVersion || "lgpd-2026-05"} aceita em{" "}
                  {formatDateTime(patient.privacyConsentAt)}.
                </p>
              </>
            ) : (
              <form onSubmit={onPrivacyConsent}>
                <span className="kicker">Privacidade e LGPD</span>
                <h3>Autorizar uso dos dados para atendimento</h3>
                <p>
                  Usamos cadastro, receita, pedidos e mensagens apenas para elegibilidade, preparo,
                  pagamento, envio e suporte da associacao.
                </p>
                <button className="primary" type="submit" disabled={busy}>
                  Aceitar e continuar
                </button>
              </form>
            )}
          </section>
        </article>

        {/* ---- Tab: Pedido ---- */}
        <div data-patient-section="pedido" style={hidden(isPedido)}>
          <section className="patient-current-order" aria-label="Proxima acao do paciente">
            <PatientNextAction
              order={latestOrder}
              cartCount={cartCount}
              hasPrivacyConsent={hasPrivacyConsent}
              onRefresh={loadOrders}
              onCopyPix={copyPix}
            />
          </section>

          <article className="patient-order-card">
            <div className="section-heading compact-heading">
              <div>
                <p className="kicker">Produtos autorizados</p>
                <h2>Pedido privado</h2>
                <p className="muted">A reserva so nasce no servidor quando o Pix e gerado.</p>
              </div>
            </div>

            <div className="patient-catalog-actions">
              <button
                className="btn btn--primary"
                type="button"
                onClick={() => setCatalogOpen(true)}
                disabled={!hasPrivacyConsent}
              >
                Abrir catalogo autorizado
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => setProfileOpen(true)}>
                Meu perfil
              </button>
            </div>

            <div id="cart-summary">
              {cartItems.length ? (
                <section className="cart-panel patient-cart-panel">
                  <div>
                    <span className="kicker">Resumo antes do Pix</span>
                    <h3>{cartCount} item(ns) selecionado(s)</h3>
                    <p className="muted">
                      Ao gerar Pix, o servidor reserva o estoque ate o vencimento do pagamento.
                    </p>
                  </div>
                  <div className="cart-lines">
                    {cartItems.map(({ product, quantity, subtotalCents }) => (
                      <article key={product.id}>
                        <div>
                          <strong>
                            {quantity} {product.unit} · {product.name}
                          </strong>
                          <span>{money.format(subtotalCents / 100)}</span>
                        </div>
                        <button
                          className="mini"
                          type="button"
                          onClick={() => setCart((current) => removeCartItem(current, product.id))}
                        >
                          Remover
                        </button>
                      </article>
                    ))}
                  </div>
                  <div className="cart-total">
                    <span>Total estimado</span>
                    <strong>{money.format(cartTotal / 100)}</strong>
                  </div>
                </section>
              ) : latestOrder ? null : (
                <section className="cart-panel muted-card patient-cart-panel">
                  <div>
                    <span className="kicker">Pedido privado</span>
                    <h3>Seu pedido ainda esta vazio.</h3>
                    <p className="muted">
                      Escolha uma quantidade no catalogo autorizado e clique em adicionar.
                    </p>
                  </div>
                </section>
              )}
            </div>

            <form
              id="checkout"
              className="checkout patient-checkout"
              onSubmit={onCheckout}
              hidden={!hasPrivacyConsent}
            >
              <label>
                Entrega
                <select
                  name="deliveryMethod"
                  value={deliveryMethod}
                  onChange={(event) => setDeliveryMethod(event.target.value)}
                >
                  <option>GED Log via Melhor Envio</option>
                  <option>Correios via Melhor Envio</option>
                  <option>Retirada combinada</option>
                </select>
              </label>
              <button className="accent" type="submit" disabled={busy || !cartCount}>
                {cartCount
                  ? `Reservar ${cartCount} item(ns) e gerar Pix`
                  : "Selecione produtos para gerar Pix"}
              </button>
            </form>
          </article>
        </div>

        {/* ---- Tab: Historico ---- */}
        <div data-patient-section="historico" style={hidden(isHistorico)}>
          <section id="patient-orders" className="patient-orders stack">
            <h3>Historico de pedidos</h3>
            {orders.length ? (
              orders.map((order) => <OrderCard order={order} key={order.id} />)
            ) : (
              <p className="muted">Nenhum pedido criado nesta conta.</p>
            )}
          </section>
        </div>

        {/* ---- Tab: Suporte ---- */}
        <div data-patient-section="suporte" style={hidden(isSuporte)}>
          <section className="patient-aftercare" hidden={!hasPrivacyConsent}>
            <form
              id="support-request-form"
              className="support-request-form"
              onSubmit={onSupportRequest}
            >
              <div>
                <span className="kicker">Solicitar atendimento</span>
                <h3>Fale com a equipe sobre cadastro, Pix, receita ou entrega</h3>
                <p className="muted">
                  Use este canal quando a proxima acao do pedido ou a elegibilidade precisar de
                  revisao humana.
                </p>
              </div>
              <label>
                Assunto
                <input name="subject" placeholder="Renovar receita, duvida sobre Pix..." required />
              </label>
              <label>
                Prioridade
                <select name="priority" defaultValue="normal">
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </label>
              <label className="wide-field">
                Mensagem
                <textarea
                  name="message"
                  rows={3}
                  placeholder="Descreva o que precisa ser revisado pela equipe."
                  required
                />
              </label>
              {latestOrder ? (
                <input type="hidden" name="relatedOrderId" value={latestOrder.id} />
              ) : null}
              <button className="primary" type="submit" disabled={busy}>
                Enviar ao suporte
              </button>
            </form>
          </section>
        </div>
      </PatientShell>

      <CatalogDrawer
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        title="Catalogo autorizado"
        kicker="Produtos liberados"
      >
        <div className="catalog-tools" id="catalog-tools" hidden={!hasPrivacyConsent}>
          <label>
            Buscar produto autorizado
            <input
              data-catalog-query
              type="search"
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder="Buscar por oleo, flor, goma..."
            />
          </label>
          <div className="segment-control" role="group" aria-label="Filtrar produtos autorizados">
            {CATALOG_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                data-catalog-filter={filter.value}
                className={catalogFilter === filter.value ? "active" : undefined}
                aria-pressed={catalogFilter === filter.value}
                onClick={() => setCatalogFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div id="catalog" className="patient-product-list">
          {!hasPrivacyConsent ? (
            <section className="consent-required-panel">
              <span className="kicker">Privacidade obrigatoria</span>
              <h3>Aceite LGPD para abrir catalogo, suporte e Pix</h3>
              <p>
                O pedido usa dados de cadastro, receita, produto, pagamento e suporte. O sistema so
                libera a operacao depois do consentimento registrado.
              </p>
            </section>
          ) : filteredProducts.length ? (
            filteredProducts.map((product) => (
              <article className="patient-product-card" key={product.id}>
                <div className="patient-product-main">
                  <span className="product-category">
                    {productCategoryLabel(productCategory(product))}
                  </span>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                </div>
                <div className="patient-product-stock">
                  <span>Estoque autorizado</span>
                  <strong className={product.availableStock <= 5 ? "warn-text" : undefined}>
                    {product.availableStock} {product.unit}
                  </strong>
                </div>
                <div className="patient-product-price">
                  <span>Valor</span>
                  <strong>{money.format(product.priceCents / 100)}</strong>
                </div>
                <div className="patient-product-action">
                  <label>
                    Qtd.
                    <input
                      className="qty"
                      data-qty={product.id}
                      type="number"
                      min="1"
                      max={Math.max(1, product.availableStock)}
                      value={productQuantities[product.id] || 1}
                      onChange={(event) =>
                        onProductQuantity(product.id, event.target.value, product.availableStock)
                      }
                      disabled={product.availableStock <= 0}
                    />
                  </label>
                  <button
                    className="mini"
                    type="button"
                    data-add={product.id}
                    onClick={() => addProduct(product.id)}
                    disabled={product.availableStock <= 0}
                  >
                    {cart[product.id] ? "Atualizar" : "Adicionar"}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">Nenhum produto autorizado encontrado para este filtro.</p>
          )}
        </div>
      </CatalogDrawer>

      <ProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Meu perfil"
        kicker="Cadastro e elegibilidade"
      >
        <section
          className="patient-profile-details"
          id="patient-profile-details"
          aria-label="Dados do associado"
        >
          <PatientProfileDetails patient={patient} latestOrder={latestOrder} />
        </section>
      </ProfileDrawer>

      <Toast message={toast} />
    </>
  );
}

const CATALOG_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "oil", label: "Oleos" },
  { value: "flower", label: "Flores" },
  { value: "edible", label: "Gomas" },
];

function PatientNextAction({ order, cartCount, hasPrivacyConsent, onRefresh, onCopyPix }) {
  if (!hasPrivacyConsent) {
    return (
      <section className="patient-next-action warn">
        <div>
          <span className="kicker">Proxima acao</span>
          <h3>Registrar privacidade e LGPD</h3>
          <p>
            A equipe so pode liberar catalogo, suporte e pagamento depois do aceite de uso dos dados
            para atendimento.
          </p>
        </div>
        <span className="pill warn">aceite pendente</span>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="patient-next-action">
        <div>
          <span className="kicker">Proxima acao</span>
          <h3>Monte o pedido autorizado</h3>
          <p>
            Escolha somente os produtos liberados pela associacao. A reserva de estoque acontece no
            servidor quando o Pix for gerado.
          </p>
        </div>
        <span className="pill">
          {cartCount ? `${cartCount} item(ns) no pedido` : "sem Pix aberto"}
        </span>
      </section>
    );
  }

  const isPending = order.paymentStatus === "pending" || order.status === "awaiting_payment";
  return (
    <section className={`payment-panel ${isPending ? "pending" : ""}`}>
      <div>
        <span className="kicker">
          {isPending ? "Proxima acao: pagar Pix" : "Pedido em acompanhamento"}
        </span>
        <h3>{order.id}</h3>
        <p>{patientOrderStatusText(order)}</p>
        {order.paymentExpiresAt ? (
          <p className="muted">Vencimento do Pix: {formatDateTime(order.paymentExpiresAt)}</p>
        ) : null}
      </div>
      <div className="payment-box">
        <span>{money.format(order.totalCents / 100)}</span>
        <strong className={statusTone(order.status)}>
          {paymentStatusLabel(order.paymentStatus, order.status)}
        </strong>
        {order.pix?.copiaECola ? (
          <>
            <textarea readOnly aria-label="Pix copia e cola" defaultValue={order.pix.copiaECola} />
            <div className="payment-actions">
              <button
                className="mini"
                type="button"
                onClick={() => onCopyPix(order.pix.copiaECola)}
              >
                Copiar Pix
              </button>
              <button className="mini" type="button" onClick={onRefresh}>
                Ja paguei, atualizar
              </button>
            </div>
            <p className="muted">
              Copie este codigo no aplicativo do banco. Se o Pix vencer, monte uma nova reserva para
              recalcular estoque.
            </p>
          </>
        ) : (
          <p className="muted">O codigo Pix aparece aqui quando o pagamento estiver pendente.</p>
        )}
      </div>
    </section>
  );
}

function AccessIssuePanel({ message, busy, onSubmit }) {
  return (
    <>
      <span className="pill danger">Acesso nao liberado</span>
      <h3>Atendimento precisa revisar seu cadastro</h3>
      <p>{message}</p>
      <ul>
        <li>Confira se a receita e a carteirinha estao vigentes.</li>
        <li>Use o mesmo codigo de associado informado pela equipe.</li>
        <li>Procure o suporte da associacao para atualizar documentos antes de tentar comprar.</li>
      </ul>
      <form className="recovery-request-form" onSubmit={onSubmit}>
        <label>
          Codigo de associado
          <input name="memberCode" placeholder="APO-1027" required />
        </label>
        <label>
          Convite privado
          <input name="inviteCode" placeholder="HELENA2026" required />
        </label>
        <label className="wide-field">
          Mensagem para suporte
          <textarea
            name="message"
            rows={3}
            defaultValue={`Preciso revisar meu acesso: ${message}`}
            required
          />
        </label>
        <button className="primary" type="submit" disabled={busy}>
          Enviar revisao
        </button>
      </form>
    </>
  );
}

function PatientProfileDetails({ patient, latestOrder }) {
  return (
    <>
      <article>
        <span>Responsavel</span>
        <strong>{patient.guardianName || "Nao informado"}</strong>
        <p>
          {patient.guardianName
            ? `${patient.guardianPhone || "Telefone nao informado"} · contato registrado pela associacao.`
            : "A equipe pode completar o responsavel pelo cadastro."}
        </p>
      </article>
      <article>
        <span>Contato</span>
        <strong>{patient.contactPhone || patient.email || "Nao informado"}</strong>
        <p>
          {[patient.city, patient.state].filter(Boolean).join("/") ||
            "Cidade/UF pendente no cadastro."}
        </p>
      </article>
      <article>
        <span>Plano de cuidado</span>
        <strong>{patient.carePlan || "Aguardando orientacao"}</strong>
        <p>
          {patient.supportNote ||
            "A equipe acompanha receita, carteirinha, Pix e entrega pelo painel de suporte."}
        </p>
      </article>
      <article>
        <span>Privacidade</span>
        <strong>{patient.privacyConsentAt ? "Consentimento registrado" : "Aceite pendente"}</strong>
        <p>
          {patient.privacyConsentAt
            ? `Versao ${patient.privacyConsentVersion || "lgpd-2026-05"} em ${formatDateTime(patient.privacyConsentAt)}.`
            : "Revise e aceite o uso de dados para atendimento."}
        </p>
      </article>
      <article>
        <span>Sessao privada</span>
        <strong>
          {patient.lastSessionExpiresAt
            ? `Ate ${formatDateTime(patient.lastSessionExpiresAt)}`
            : "Sem sessao ativa"}
        </strong>
        <p>
          {patient.lastLoginAt
            ? `Ultimo acesso em ${formatDateTime(patient.lastLoginAt)}.`
            : "Primeiro acesso registrado nesta sessao."}
        </p>
      </article>
      <article>
        <span>Suporte</span>
        <strong>{latestOrder ? "Pedido em acompanhamento" : "Sem pedido aberto"}</strong>
        <p>
          {latestOrder
            ? `Informe ${latestOrder.id} ao atendimento se precisar de ajuda.`
            : "O suporte acompanha receita, carteirinha, Pix e entrega pelo painel da equipe."}
        </p>
      </article>
    </>
  );
}

function OrderCard({ order }) {
  return (
    <article className="order-card patient-history-card">
      <div className="order-row">
        <div>
          <h3>{order.id}</h3>
          <p>{patientOrderStatusText(order)}</p>
          {order.items?.length ? (
            <p>
              {order.items.map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(" | ")}
            </p>
          ) : null}
          <p className="muted">
            {order.deliveryMethod || "Entrega a combinar"}
            {order.paymentExpiresAt ? ` · Pix vence ${formatDateTime(order.paymentExpiresAt)}` : ""}
            {order.shipment
              ? ` · ${order.shipment.carrier} ${order.shipment.trackingCode || ""}`
              : ""}
          </p>
          <span className={`pill ${statusTone(order.status)}`.trim()}>
            {statusLabel(order.status)}
          </span>
        </div>
        <div className="money">{money.format(order.totalCents / 100)}</div>
      </div>
    </article>
  );
}

function currentCartMessage(previousQuantity, nextQuantity) {
  return previousQuantity
    ? `Quantidade atualizada para ${nextQuantity}.`
    : "Produto adicionado ao pedido.";
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

function removeCartItem(current, productId) {
  const next = { ...current };
  delete next[productId];
  return next;
}

function formatDate(value) {
  if (!value) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
    new Date(`${value}T12:00:00-03:00`),
  );
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function patientOrderStatusText(order) {
  const labels = {
    awaiting_payment: "Pix aguardando pagamento. A reserva fica ativa ate o vencimento.",
    paid_pending_fulfillment: "Pagamento confirmado. Equipe preparando separacao.",
    separating: "Pedido em separacao pela equipe.",
    ready_to_ship: "Pedido pronto para envio ou retirada.",
    sent: "Pedido enviado.",
    payment_expired: "Pagamento expirou. Gere um novo pedido para reservar estoque novamente.",
  };
  return labels[order.status] || "Status em revisao pela equipe.";
}

function statusLabel(status) {
  return (
    {
      awaiting_payment: "Pix pendente",
      paid_pending_fulfillment: "Pago, aguardando separacao",
      separating: "Em separacao",
      ready_to_ship: "Pronto para envio",
      sent: "Enviado",
      payment_expired: "Pagamento expirado",
    }[status] || "Em revisao"
  );
}

function paymentStatusLabel(paymentStatus, orderStatus) {
  if (orderStatus === "payment_expired" || paymentStatus === "expired") return "Pix expirado";
  return (
    {
      pending: "Pix pendente",
      paid: "Pix confirmado",
      confirmed: "Pix confirmado",
      failed: "Pagamento falhou",
      cancelled: "Pagamento cancelado",
    }[paymentStatus] || statusLabel(orderStatus)
  );
}

function statusTone(status) {
  if (status === "awaiting_payment") return "warn";
  if (status === "payment_expired") return "danger";
  return "";
}

function productCategoryLabel(category) {
  return (
    {
      oil: "Oleo medicinal",
      flower: "Flor medicinal",
      edible: "Produto oral",
    }[category] || "Produto autorizado"
  );
}

function filterProducts(products, query, filter) {
  const normalizedQuery = normalizeText(query);
  return products.filter((product) => {
    const category = productCategory(product);
    const matchesFilter = filter === "all" || category === filter;
    const haystack = normalizeText(`${product.name} ${product.description} ${product.unit}`);
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
}

function productCategory(product) {
  if (product.category) return product.category;
  const text = normalizeText(`${product.name} ${product.description} ${product.unit}`);
  if (text.includes("flor") || text.includes("grama") || text.includes("g ")) return "flower";
  if (text.includes("goma") || text.includes("capsula") || text.includes("cx")) return "edible";
  return "oil";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
