import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

register("./css-stub-loader.mjs", import.meta.url);

const { test } = await import("node:test");
const assert = (await import("node:assert/strict")).default;
const React = (await import("react")).default;
const { renderToStaticMarkup } = await import("react-dom/server");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GLOBALS_CSS = readFileSync(resolve(__dirname, "..", "app", "globals.css"), "utf8");

function rendered(className, children = "x") {
  return renderToStaticMarkup(React.createElement("div", { className }, children));
}

// ---- adm-page -------------------------------------------------------------

test(".adm-page utility renders and is defined in globals.css", () => {
  const html = rendered("adm-page");
  assert.match(html, /class="adm-page"/);
  assert.match(GLOBALS_CSS, /\.adm-page\s*\{/);
});

// ---- adm-stack-1..7 -------------------------------------------------------

for (const n of [1, 2, 3, 4, 5, 6, 7]) {
  test(`.adm-stack-${n} renders and uses --sp-${n} gap`, () => {
    const html = rendered(`adm-stack-${n}`);
    assert.match(html, new RegExp(`class="adm-stack-${n}"`));
    assert.match(
      GLOBALS_CSS,
      new RegExp(`\\.adm-stack-${n}\\s*\\{[^}]*gap:\\s*var\\(--sp-${n}\\)`),
      `.adm-stack-${n} must use --sp-${n} for gap`,
    );
  });
}

// ---- adm-row --------------------------------------------------------------

test(".adm-row renders and is defined", () => {
  const html = rendered("adm-row");
  assert.match(html, /class="adm-row"/);
  assert.match(GLOBALS_CSS, /\.adm-row\s*\{/);
});

// ---- adm-grid-{2,3,4}col --------------------------------------------------

for (const n of [2, 3, 4]) {
  test(`.adm-grid-${n}col renders and grid-template-columns uses ${n} tracks`, () => {
    const html = rendered(`adm-grid-${n}col`);
    assert.match(html, new RegExp(`class="adm-grid-${n}col"`));
    assert.match(
      GLOBALS_CSS,
      new RegExp(`\\.adm-grid-${n}col\\s*\\{\\s*grid-template-columns:\\s*repeat\\(${n},`),
      `.adm-grid-${n}col must declare ${n}-column repeat`,
    );
  });
}

// ---- adm-empty-state ------------------------------------------------------

test(".adm-empty-state utility renders with title + hint slots", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      "div",
      { className: "adm-empty-state" },
      React.createElement("p", { className: "adm-empty-state__title" }, "Nada aqui"),
      React.createElement("p", { className: "adm-empty-state__hint" }, "Tente outro filtro"),
    ),
  );
  assert.match(html, /class="adm-empty-state"/);
  assert.match(html, /class="adm-empty-state__title"/);
  assert.match(html, /class="adm-empty-state__hint"/);
  for (const sel of ["adm-empty-state", "adm-empty-state__title", "adm-empty-state__hint"]) {
    assert.match(GLOBALS_CSS, new RegExp(`\\.${sel}\\s*\\{`));
  }
});

// ---- adm-skeleton ---------------------------------------------------------

test(".adm-skeleton + variants render and CSS shimmer rule exists", () => {
  for (const variant of ["text", "row", "card"]) {
    const html = rendered(`adm-skeleton adm-skeleton--${variant}`);
    assert.match(html, new RegExp(`adm-skeleton--${variant}`));
    assert.match(GLOBALS_CSS, new RegExp(`\\.adm-skeleton--${variant}\\b`));
  }
  // Base + ::after shimmer pseudo-element required for the animation.
  assert.match(GLOBALS_CSS, /\.adm-skeleton\s*\{/);
  assert.match(GLOBALS_CSS, /\.adm-skeleton::after\s*\{/);
});

// ---- spacing token sanity check ------------------------------------------

test("spacing tokens --sp-1..--sp-10 are declared in globals.css", () => {
  for (let n = 1; n <= 10; n += 1) {
    assert.match(GLOBALS_CSS, new RegExp(`--sp-${n}\\s*:`), `--sp-${n} token must be declared`);
  }
});
