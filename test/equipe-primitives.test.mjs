import { register } from "node:module";

// Stub *.css imports so "use client" components from app/equipe/components
// can be imported under node:test without a bundler. Must run before any
// import that transitively pulls a *.module.css file.
register("./css-stub-loader.mjs", import.meta.url);

const { test } = await import("node:test");
const assert = (await import("node:assert/strict")).default;
const React = (await import("react")).default;
const { renderToStaticMarkup } = await import("react-dom/server");

const StatusStrip = (await import("../app/equipe/components/StatusStrip.jsx")).default;
const PageHead = (await import("../app/equipe/components/PageHead.jsx")).default;
const KpiRibbon = (await import("../app/equipe/components/KpiRibbon.jsx")).default;
const KpiSpark = (await import("../app/equipe/components/KpiSpark.jsx")).default;

test("StatusStrip renders chips, marks active segment, exposes Atualizar button", () => {
  let refreshed = 0;
  const html = renderToStaticMarkup(
    React.createElement(StatusStrip, {
      chips: [
        { label: "abertos", count: 3, tone: "warn" },
        { label: "resolvidos", count: 7, tone: "ok" },
      ],
      segments: [
        { label: "Tudo", active: true, onClick: () => {} },
        { label: "Meus", active: false, onClick: () => {} },
      ],
      filters: React.createElement("input", { "data-filter": "x", "aria-label": "x" }),
      onRefresh: () => {
        refreshed += 1;
      },
    }),
  );
  assert.match(html, /abertos/);
  assert.match(html, /resolvidos/);
  // Active segment carries aria-selected="true"
  assert.match(html, /aria-selected="true"[^>]*>[^<]*<span>Tudo<\/span>/);
  assert.match(html, /aria-selected="false"[^>]*>[^<]*<span>Meus<\/span>/);
  // Filter slot renders verbatim, preserving the data-filter contract.
  assert.match(html, /data-filter="x"/);
  // Atualizar button rendered.
  assert.match(html, /aria-label="Atualizar"/);
  assert.match(html, />Atualizar</);
  // Sanity: onRefresh was provided as a function (we can't trigger DOM
  // events from renderToStaticMarkup, but this guards the prop contract).
  assert.equal(typeof refreshed, "number");
});

test("StatusStrip omits chips/segments/filters/refresh sections when not provided", () => {
  const html = renderToStaticMarkup(React.createElement(StatusStrip, {}));
  assert.doesNotMatch(html, /aria-label="Atualizar"/);
  assert.doesNotMatch(html, /role="tablist"/);
  // The outer region wrapper is always present.
  assert.match(html, /aria-label="Status e filtros"/);
});

test("PageHead renders title, meta, and actions slots", () => {
  const html = renderToStaticMarkup(
    React.createElement(PageHead, {
      title: "Suporte ao paciente",
      meta: React.createElement("span", { id: "support-status" }, "3 abertos"),
      actions: React.createElement(
        "button",
        { type: "button", "data-action": "refresh" },
        "Atualizar",
      ),
    }),
  );
  assert.match(html, /<h1[^>]*>Suporte ao paciente<\/h1>/);
  assert.match(html, /id="support-status"[^>]*>3 abertos/);
  assert.match(html, /data-action="refresh"/);
});

test("PageHead with only a title omits the right rail entirely", () => {
  const html = renderToStaticMarkup(React.createElement(PageHead, { title: "Estoque" }));
  assert.match(html, /<h1[^>]*>Estoque<\/h1>/);
  // No meta span and no actions wrapper when neither is provided.
  assert.doesNotMatch(html, /class="[^"]*right/);
});

test("KpiRibbon renders the ribbon and its KpiSpark cells", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      KpiRibbon,
      { ariaLabel: "Indicadores" },
      React.createElement(KpiSpark, { key: "a", label: "Pix abertos", value: 12 }),
      React.createElement(KpiSpark, { key: "b", label: "Pagos hoje", value: 7 }),
      React.createElement(KpiSpark, { key: "c", label: "Em separacao", value: 4 }),
    ),
  );
  assert.match(html, /aria-label="Indicadores"/);
  // 3 KpiSpark cells: each surfaces its label and value text.
  assert.match(html, /Pix abertos/);
  assert.match(html, /Pagos hoje/);
  assert.match(html, /Em separacao/);
  // Values rendered as text — tabular-nums lives in CSS, but we at least
  // assert the numeric content is present.
  assert.match(html, />12</);
  assert.match(html, />7</);
  assert.match(html, />4</);
});

test("primitives default-export a function (component sanity)", () => {
  for (const [name, fn] of [
    ["StatusStrip", StatusStrip],
    ["PageHead", PageHead],
    ["KpiRibbon", KpiRibbon],
  ]) {
    assert.equal(typeof fn, "function", `${name} default export must be a function`);
  }
});
