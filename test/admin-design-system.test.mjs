import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Stub *.css imports so React components don't break under node:test.
register("./css-stub-loader.mjs", import.meta.url);

const { test } = await import("node:test");
const assert = (await import("node:assert/strict")).default;
const React = (await import("react")).default;
const { renderToStaticMarkup } = await import("react-dom/server");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GLOBALS_CSS = readFileSync(resolve(__dirname, "..", "app", "globals.css"), "utf8");

function rendered(className, children = "test") {
  return renderToStaticMarkup(React.createElement("div", { className }, children));
}

// ---- .surface -------------------------------------------------------------

test(".surface CSS rule exists with paper background, line border, --r-lg radius", () => {
  // The block selector groups .panel, .card, .surface
  assert.match(
    GLOBALS_CSS,
    /\.panel,\s*\.card,\s*\.surface\s*\{[^}]*background:\s*var\(--paper-warm\)[^}]*border:\s*1px\s+solid\s+var\(--line-soft\)[^}]*border-radius:\s*var\(--r-lg\)/,
    ".surface base rule must define paper background + 1px line border + --r-lg radius",
  );
});

test(".surface renders with the surface className applied", () => {
  const html = rendered("surface");
  assert.match(html, /class="surface"/);
});

test(".surface--elevated modifier class is preserved on render", () => {
  const html = rendered("surface surface--elevated");
  assert.match(html, /class="surface surface--elevated"/);
});

// ---- .surface--bordered-left-* -------------------------------------------

for (const tone of ["ok", "warn", "danger", "info", "neutral"]) {
  test(`.surface--bordered-left-${tone} class renders and has CSS rule`, () => {
    const html = rendered(`surface surface--bordered-left-${tone}`);
    assert.match(html, new RegExp(`surface--bordered-left-${tone}`));
    const cssRule = new RegExp(
      `\\.surface--bordered-left-${tone}\\s*\\{[^}]*border-left:\\s*3px\\s+solid`,
    );
    assert.match(GLOBALS_CSS, cssRule);
  });
}

// ---- .dataTable -----------------------------------------------------------

test(".dataTable CSS defines tabular-nums on td.num/th.num", () => {
  assert.match(
    GLOBALS_CSS,
    /\.dataTable td\.num,\s*\.dataTable th\.num\s*\{[^}]*font-variant-numeric:\s*tabular-nums/,
    "dataTable .num cells must opt into tabular-nums",
  );
});

test(".dataTable renders thead and tbody with td.num class preserved", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      "table",
      { className: "dataTable" },
      React.createElement(
        "thead",
        null,
        React.createElement("tr", null, React.createElement("th", { className: "num" }, "Qty")),
      ),
      React.createElement(
        "tbody",
        null,
        React.createElement("tr", null, React.createElement("td", { className: "num" }, "42")),
      ),
    ),
  );
  assert.match(html, /<table class="dataTable">/);
  assert.match(html, /<th class="num">Qty<\/th>/);
  assert.match(html, /<td class="num">42<\/td>/);
});

// ---- .btn variants --------------------------------------------------------

for (const variant of ["primary", "ghost", "mini", "icon"]) {
  test(`.btn--${variant} renders and CSS rule exists`, () => {
    const html = renderToStaticMarkup(
      React.createElement("button", { type: "button", className: `btn btn--${variant}` }, "Go"),
    );
    assert.match(html, new RegExp(`class="btn btn--${variant}"`));
    assert.match(
      GLOBALS_CSS,
      new RegExp(`\\.btn--${variant}\\s*\\{`),
      `.btn--${variant} rule must exist in globals.css`,
    );
  });
}

// ---- .pill variants -------------------------------------------------------
// The system maps the semantic "success" tone to the historical .pill--good
// modifier (and also accepts .pill.good). Other tones use BEM modifiers.

const PILL_TONES = [
  { semantic: "success", modifier: "good" },
  { semantic: "warn", modifier: "warn" },
  { semantic: "danger", modifier: "danger" },
  { semantic: "info", modifier: "info" },
  { semantic: "neutral", modifier: "neutral" },
];

for (const { semantic, modifier } of PILL_TONES) {
  test(`.pill (${semantic} tone via .pill--${modifier}) renders and CSS rule exists`, () => {
    const html = rendered(`pill pill--${modifier}`, "label");
    assert.match(html, new RegExp(`class="pill pill--${modifier}"`));
    assert.match(
      GLOBALS_CSS,
      new RegExp(`\\.pill--${modifier}\\b`),
      `globals.css must declare .pill--${modifier} for the ${semantic} tone`,
    );
  });
}

// ---- .codeBlock -----------------------------------------------------------

test(".codeBlock renders with mono content and CSS uses --font-mono", () => {
  const html = renderToStaticMarkup(
    React.createElement("code", { className: "codeBlock" }, "ls -la"),
  );
  assert.match(html, /class="codeBlock"/);
  assert.match(html, />ls -la</);
  assert.match(GLOBALS_CSS, /\.codeBlock\s*\{[^}]*font-family:\s*var\(--font-mono\)/);
});

// ---- .drawer family -------------------------------------------------------

test(".drawer / __head / __body / __overlay all render", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      "aside",
      { className: "drawer" },
      React.createElement(
        "header",
        { className: "drawer__head" },
        React.createElement("h3", null, "Detail"),
      ),
      React.createElement("div", { className: "drawer__body" }, "body"),
    ),
  );
  assert.match(html, /class="drawer"/);
  assert.match(html, /class="drawer__head"/);
  assert.match(html, /class="drawer__body"/);

  const overlayHtml = rendered("drawer__overlay", "");
  assert.match(overlayHtml, /class="drawer__overlay"/);

  for (const part of ["drawer", "drawer__head", "drawer__body", "drawer__overlay"]) {
    assert.match(GLOBALS_CSS, new RegExp(`\\.${part}\\s*\\{`), `globals.css must define .${part}`);
  }
});

// ---- .emptyState and .skel ------------------------------------------------

test(".emptyState renders and CSS rule exists", () => {
  const html = rendered("emptyState", "Nada por aqui");
  assert.match(html, /class="emptyState"/);
  assert.match(html, />Nada por aqui</);
  assert.match(GLOBALS_CSS, /\.emptyState\s*\{/);
});

test(".skel renders and CSS rule exists with shimmer animation", () => {
  const html = rendered("skel", "");
  assert.match(html, /class="skel"/);
  assert.match(GLOBALS_CSS, /\.skel\s*\{[^}]*animation:\s*skel-shimmer/);
});
