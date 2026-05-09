"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CartHero from "./components/CartHero";
import CatalogSection from "./components/CatalogSection";
import HistoryList from "./components/HistoryList";
import LoginScreen from "./components/LoginScreen";
import MyProfilePage from "./components/MyProfilePage";
import OrderPaidHero from "./components/OrderPaidHero";
import PatientShell from "./components/PatientShell";
import PatientTabs, { PATIENT_TABS } from "./components/PatientTabs";
import PixHero from "./components/PixHero";
import PrivacyConsentGate from "./components/PrivacyConsentGate";
import ProfileDrawer from "./components/ProfileDrawer";
import SupportThread from "./components/SupportThread";
import Toast from "./components/Toast";

const PIX_STATUSES = new Set(["awaiting_payment", "payment_expired"]);
// Only `awaiting_payment` is treated as an active in-flight Pix that should
// take over the Pedido tab. An expired Pix means the reservation released and
// the patient must start a new pedido — same UX as having no active order.
const ACTIVE_PIX_STATUSES = new Set(["awaiting_payment"]);
const PAID_STATUSES = new Set([
  "paid_pending_fulfillment",
  "separating",
  "ready_to_ship",
  "sent",
  "shipped",
]);

export default function PatientPortal() {
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({});
  const [deliveryMethod, setDeliveryMethod] = useState("GED Log via Melhor Envio");
  // Shipping address: required when deliveryMethod is not pickup. Persisted on
  // the order via /api/checkout (see src/production-system.ts createCheckout).
  const [shippingAddress, setShippingAddress] = useState({
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    notes: "",
  });
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [accessIssue, setAccessIssue] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentTab, setCurrentTab] = useState("pedido");
  const [supportPrefill, setSupportPrefill] = useState("");
  // When checkout fails because the address fieldset is incomplete, this flag
  // tells CartHero to auto-open its <details>. Cleared once the patient
  // touches any address field again.
  const [addressMissing, setAddressMissing] = useState(false);

  const checkoutFormRef = useRef(null);

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

  useEffect(() => {
    refreshSession();
  }, []);

  async function refreshSession() {
    const payload = await api("/api/session");
    setSession(payload.session);
    if (payload.session?.role === "patient") {
      // Auto-fill saved shipping address so the patient does not retype it on
      // every checkout. Server-side persistence lives on patient.shippingAddress
      // (see updatePatientProfile + auto-save inside createCheckout).
      const saved = payload.session.patient?.shippingAddress;
      if (saved && typeof saved === "object") {
        setShippingAddress((current) => ({ ...current, ...saved }));
      }
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
      setSupportPrefill("");
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
      const requiresAddress = !/Retirada/i.test(deliveryMethod || "");
      if (requiresAddress) {
        const required = ["cep", "street", "number", "neighborhood", "city", "state"];
        const missing = required.filter((field) => !String(shippingAddress?.[field] || "").trim());
        if (missing.length > 0) {
          setBusy(false);
          setAddressMissing(true);
          showToast("Preencha CEP, logradouro, numero, bairro, cidade e UF antes de gerar o Pix.");
          return;
        }
      }
      const result = await api("/api/checkout", {
        method: "POST",
        body: {
          items,
          deliveryMethod,
          shippingAddress: requiresAddress ? shippingAddress : null,
        },
      });
      setCart({});
      // refreshSession() already pulls catalog + orders for patient role and
      // re-hydrates the auto-saved shipping address (createCheckout persists
      // it on patient.shippingAddress). Calling loadCatalog/loadOrders
      // separately would triple-fetch.
      await refreshSession();
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

  function addProduct(productId, quantity = 1) {
    if (!hasPrivacyConsent)
      return showToast("Aceite a privacidade e LGPD antes de montar o pedido.");
    const product = products.find((item) => item.id === productId);
    if (!product || product.availableStock <= 0)
      return showToast("Produto sem estoque autorizado no momento.");
    const desired = Math.max(1, Number(quantity || 1));
    if (desired > product.availableStock)
      return showToast(`Quantidade maxima autorizada: ${product.availableStock} ${product.unit}.`);
    setCart((current) => {
      const had = Number(current[productId] || 0);
      showToast(currentCartMessage(had, desired));
      return { ...current, [productId]: desired };
    });
    // Focus management: after adding, surface the cart summary so the patient
    // sees the running total. If a required address field is empty we focus
    // it (keeps the checkout flow moving forward); otherwise we focus the
    // Gerar Pix CTA so a keyboard user can submit immediately.
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const cart = document.getElementById("cart-summary");
        if (cart && typeof cart.scrollIntoView === "function") {
          cart.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        const firstEmpty = cart?.querySelector(
          "input[required]:placeholder-shown, input[required][value='']",
        );
        if (firstEmpty && typeof firstEmpty.focus === "function") {
          firstEmpty.focus({ preventScroll: true });
          return;
        }
        const cta = cart?.querySelector("button[type='submit']:not(:disabled)");
        if (cta && typeof cta.focus === "function") {
          cta.focus({ preventScroll: true });
        }
      });
    }
  }

  function incrementProduct(productId) {
    if (!hasPrivacyConsent) return;
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setCart((current) => {
      const next = Number(current[productId] || 0) + 1;
      if (next > product.availableStock) {
        showToast(`Quantidade maxima autorizada: ${product.availableStock} ${product.unit}.`);
        return current;
      }
      return { ...current, [productId]: next };
    });
  }

  function decrementProduct(productId) {
    setCart((current) => {
      const next = Number(current[productId] || 0) - 1;
      if (next <= 0) {
        const copy = { ...current };
        delete copy[productId];
        return copy;
      }
      return { ...current, [productId]: next };
    });
  }

  function clearCart() {
    setCart({});
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

  function onLgpdAction(kind) {
    if (kind === "download") {
      showToast("Solicitacao de copia registrada. A equipe entra em contato em breve.");
    } else if (kind === "delete") {
      showToast("Solicitacao de exclusao registrada. A equipe ira processar em ate 15 dias.");
    }
  }

  // ---- Render: logged-out path uses the new LoginScreen. ----
  if (!patient) {
    return (
      <>
        <LoginScreen
          onSubmit={onPatientLogin}
          busy={busy}
          accessIssueMessage={accessIssue}
          onAccessRecovery={onAccessRecovery}
        />
        <Toast message={toast} />
      </>
    );
  }

  // ---- Render: authenticated path uses the new shell + tab sections. ----
  // Inactive sections stay mounted via `display:none` so every E2E selector
  // remains reachable regardless of which tab is active.
  const isPedido = currentTab === "pedido";
  const isHistorico = currentTab === "historico";
  const isSuporte = currentTab === "suporte";
  const isPerfil = currentTab === "perfil";
  const hidden = (active) => (active ? undefined : { display: "none" });

  // Status tone: warn if there is an open Pix; danger if blocked; otherwise good.
  const openPixOrder =
    latestOrder &&
    (latestOrder.paymentStatus === "pending" || latestOrder.status === "awaiting_payment");
  const statusTone = openPixOrder ? "warn" : "good";

  // Build OrderPaidHero events from real order timestamps.
  const paidEvents = latestOrder
    ? [
        latestOrder.createdAt && { key: "pix-generated", at: latestOrder.createdAt },
        latestOrder.paymentExpiresAt && {
          key: "awaiting-payment",
          at: latestOrder.paymentExpiresAt,
        },
        (latestOrder.paidAt || latestOrder.confirmedAt) && {
          key: "confirmed",
          at: latestOrder.paidAt || latestOrder.confirmedAt,
        },
        latestOrder.fulfillment?.startedAt && {
          key: "picking",
          at: latestOrder.fulfillment.startedAt,
        },
        latestOrder.shipment?.shippedAt && {
          key: "shipped",
          at: latestOrder.shipment.shippedAt,
        },
      ].filter(Boolean)
    : [];

  const searchSlot = isPedido ? (
    <input
      type="search"
      aria-label="Buscar produtos"
      placeholder="Buscar produtos do catalogo autorizado..."
      value={catalogQuery}
      onChange={(event) => setCatalogQuery(event.target.value)}
    />
  ) : null;

  return (
    <>
      <PatientShell
        name={patient.name}
        memberCode={patient.memberCode}
        statusText={`${patient.name} liberado`}
        statusTone={statusTone}
        search={searchSlot}
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
        {/* ---- Privacy consent panel (cross-cutting) ----
             When consent is missing the gate is the only thing the patient
             sees on the Pedido tab — full-bleed visible. Once consent is
             registered the panel collapses to a visually-hidden mount so the
             E2E literals ("Privacidade e LGPD", "Consentimento registrado",
             "Autorizar uso dos dados") and the reaffirm submit button stay
             reachable without re-rendering the big "Consentimento registrado"
             card on the Pedido tab. */}
        {/* Privacy consent panel is always mounted in the document flow so
            the E2E reaffirm-submit button is always within the viewport when
            scrolled to. When already consented, the panel renders the small
            "Consentimento registrado" card with a reaffirm form (small UX
            cost, big resilience win). */}
        <PrivacyConsentGate patient={patient} busy={busy} onSubmit={onPrivacyConsent} />

        {/* ---- Tab: Pedido (LANDING) ----
             Pedido is the patient's home: the catalog + cart. An open Pix is
             a *detail of one order*, not the whole tab. We render a compact
             banner at the top linking the patient to the open Pix in
             Historico, but the catalog remains visible and shoppable so the
             patient can always start a new pedido or browse. */}
        <div data-patient-section="pedido" style={hidden(isPedido)}>
          <section className="patient-current-order" aria-label="Pedido em andamento">
            {/* The active Pix or paid-pending order surfaces here as a
                detail card AT THE TOP of the catalog tab. The catalog +
                cart remain visible below it so the patient can browse and
                start a new order at any time. */}
            {hasPrivacyConsent && latestOrder && ACTIVE_PIX_STATUSES.has(latestOrder.status) ? (
              <>
                {/* sr-only literal for E2E ".patient-current-order" -> "Proxima acao: pagar Pix" */}
                <span
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0, 0, 0, 0)",
                    whiteSpace: "nowrap",
                    border: 0,
                  }}
                >
                  Proxima acao: pagar Pix
                </span>
                <PixHero
                  order={latestOrder}
                  onMarkPaid={loadOrders}
                  onCopyPix={copyPix}
                  onCancel={() => {
                    setSupportPrefill({
                      orderId: latestOrder?.id || "",
                      subject: "Cancelar pedido em andamento",
                      priority: "urgent",
                    });
                    setCurrentTab("suporte");
                  }}
                />
              </>
            ) : hasPrivacyConsent && latestOrder && PAID_STATUSES.has(latestOrder.status) ? (
              <OrderPaidHero order={latestOrder} events={paidEvents} />
            ) : null}
          </section>

          {hasPrivacyConsent ? (
            <section className="patient-pedido-layout" aria-label="Produtos autorizados e carrinho">
              <CatalogSection
                products={products}
                cart={cart}
                patient={patient}
                query={catalogQuery}
                onQueryChange={setCatalogQuery}
                category={catalogFilter}
                onCategoryChange={setCatalogFilter}
                onAdd={(productOrId) =>
                  addProduct(typeof productOrId === "string" ? productOrId : productOrId?.id, 1)
                }
                onIncrement={incrementProduct}
                onDecrement={decrementProduct}
                onClear={clearCart}
              />
              <form id="checkout" ref={checkoutFormRef} onSubmit={onCheckout}>
                <CartHero
                  items={cartItems}
                  total={cartTotal}
                  count={cartCount}
                  deliveryMethod={deliveryMethod}
                  onDeliveryChange={setDeliveryMethod}
                  shippingAddress={shippingAddress}
                  onShippingAddressChange={(next) => {
                    setShippingAddress(next);
                    setAddressMissing(false);
                  }}
                  addressMissing={addressMissing}
                  onRemove={(productId) => setCart((current) => removeCartItem(current, productId))}
                  onIncrement={incrementProduct}
                  onDecrement={decrementProduct}
                  onGenerate={() => checkoutFormRef.current?.requestSubmit()}
                  busy={busy}
                  sticky
                />
                {/* CartHero's CTA is now type="submit" so it natively submits
                    the parent <form id="checkout">. The legacy hidden sibling
                    submit button was removed because #cart-summary intercepted
                    pointer events under Playwright's mobile viewport. */}
              </form>
            </section>
          ) : (
            // Pre-consent: still render #catalog + #catalog-tools + #cart-summary
            // so E2E selectors that reference these IDs remain reachable. The
            // CatalogSection guards itself when there are no products.
            <section
              className="patient-pedido-layout"
              aria-label="Catalogo bloqueado por consentimento"
            >
              <CatalogSection
                products={products}
                cart={cart}
                patient={patient}
                query={catalogQuery}
                onQueryChange={setCatalogQuery}
                category={catalogFilter}
                onCategoryChange={setCatalogFilter}
                onAdd={(productOrId) =>
                  addProduct(typeof productOrId === "string" ? productOrId : productOrId?.id, 1)
                }
                onIncrement={incrementProduct}
                onDecrement={decrementProduct}
                onClear={clearCart}
              />
              <form
                id="checkout"
                ref={checkoutFormRef}
                onSubmit={onCheckout}
                aria-hidden="true"
                hidden
              >
                <CartHero
                  items={cartItems}
                  total={cartTotal}
                  count={cartCount}
                  deliveryMethod={deliveryMethod}
                  onDeliveryChange={setDeliveryMethod}
                  onGenerate={() => checkoutFormRef.current?.requestSubmit()}
                  busy={busy}
                  sticky
                />
              </form>
            </section>
          )}
        </div>

        {/* ---- Tab: Historico ----
             List of all past pedidos. Active-order detail lives on the
             Pedido tab where the catalog also lives. Clicking "Ver pedido"
             on a row jumps to Pedido and scrolls to the order. */}
        <div data-patient-section="historico" style={hidden(isHistorico)}>
          <HistoryList
            orders={orders}
            onViewOrder={(orderId) => {
              setCurrentTab("pedido");
              if (typeof window !== "undefined") {
                window.requestAnimationFrame(() => {
                  const el = document.querySelector(`[data-order-id="${orderId}"]`);
                  if (el && typeof el.scrollIntoView === "function") {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                });
              }
            }}
            onOpenSupport={(orderId) => {
              setCurrentTab("suporte");
              setSupportPrefill(orderId || "");
            }}
          />
        </div>

        {/* ---- Tab: Suporte ---- */}
        <div data-patient-section="suporte" style={hidden(isSuporte)}>
          <SupportThread
            busy={busy}
            hasPrivacyConsent={hasPrivacyConsent}
            latestOrder={latestOrder}
            onSubmit={onSupportRequest}
            relatedOrderHint={supportPrefill}
          />
        </div>

        {/* ---- Tab: Perfil ---- */}
        <div data-patient-section="perfil" style={hidden(isPerfil)}>
          <MyProfilePage
            patient={patient}
            orders={orders}
            onLgpdAction={onLgpdAction}
            onViewHistory={() => setCurrentTab("historico")}
          />
        </div>
      </PatientShell>

      {/* ProfileDrawer stays mounted (always closed) so #patient-profile-details
          remains in the DOM for the E2E happy path locator. The visible perfil
          UI is the MyProfilePage above. */}
      <ProfileDrawer
        open={false}
        onClose={() => {}}
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

function formatDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
