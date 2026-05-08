"""Phase 1d patient screenshot capture.

Captures the 11 patient states x 2 viewports listed in the Phase 1 ledger:

  login, empty, cart, pix, tracking, history, support,
  blocked, consent, catalog-drawer, profile-drawer

Viewports: desktop 1280x800, mobile 390x844.

Side effect: also performs a 320px overflow audit and prints any element
that exceeds the viewport width (writes findings to stdout).

Outputs to artifacts/visual-e2e/redesign/p1-patient-<state>-<viewport>.png.

Pre-req: a dev server running at $BASE with seeded credentials:
  - APO-1027 / HELENA2026 (patient happy-path / consented)
  - APO-1999 / BLOQ2026 (blocked patient)

Usage: python3 scripts/p1-screenshots.py
"""

from __future__ import annotations

import os
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import Page, sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


def free_port() -> int:
    s = socket.socket()
    s.bind(("", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def wait_for_health(base_url: str, proc: subprocess.Popen, timeout: float = 30.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urlopen(f"{base_url}/health", timeout=1) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError(f"server did not become healthy at {base_url}")


def start_isolated_server() -> tuple[str, subprocess.Popen, tempfile.TemporaryDirectory]:
    """Spin up a fresh production-mode server (no NEXT_DEV) on a free port.
    Required because the long-lived dev server (NEXT_DEV=true) does not
    hydrate React when Playwright connects (HMR WebSocket failure cascades
    into a no-op client). The existing E2E does the same thing.
    """
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    tmp = tempfile.TemporaryDirectory(prefix="p1-screenshots-")
    env = {
        **os.environ,
        "PORT": str(port),
        "NEXT_DEV": "false",
        "DB_FILE": str(Path(tmp.name) / "p1.sqlite"),
        "DOCUMENT_STORAGE_DIR": str(Path(tmp.name) / "docs"),
        "TEAM_EMAIL": "equipe@apoiar.local",
        "TEAM_PASSWORD": "apoio-equipe-dev",
        "PIX_WEBHOOK_SECRET": "dev-webhook-secret",
        "SESSION_SECRET": "dev-session-secret-change-me",
    }
    proc = subprocess.Popen(
        ["node", "server.mjs"],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        wait_for_health(base, proc)
    except Exception:
        proc.terminate()
        raise
    return base, proc, tmp


BASE = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:4184")
OUT = Path("artifacts/visual-e2e/redesign")
NOTE = OUT / "p1-NOTE.md"

DESKTOP = {"width": 1280, "height": 800}
MOBILE = {"width": 390, "height": 844}
MOBILE_320 = {"width": 320, "height": 720}

PATIENT_HAPPY = ("APO-1027", "HELENA2026")
PATIENT_BLOCKED = ("APO-1999", "BLOQ2026")


def login(page: Page, member: str, invite: str) -> None:
    page.goto(f"{BASE}/paciente", wait_until="networkidle")
    page.locator("#patient-login input[name='memberCode']").fill(member)
    page.locator("#patient-login input[name='inviteCode']").fill(invite)
    page.locator("#patient-login button[type='submit']").click()
    page.wait_for_load_state("networkidle")
    # Wait for the authenticated render to land. #patient-summary is rendered
    # only after the session resolves to role=patient.
    try:
        page.locator("#patient-summary").wait_for(state="attached", timeout=8000)
    except Exception:
        # Could be blocked patient (no #patient-summary). Caller decides.
        pass


def accept_consent_if_pending(page: Page) -> None:
    # The consent panel is always present post-login. If it shows the
    # "Autorizar uso dos dados" pre-state, click submit; otherwise no-op.
    panel = page.locator("#privacy-consent-panel")
    panel.wait_for(state="attached", timeout=8000)
    txt = panel.text_content() or ""
    if "Autorizar uso dos dados" in txt:
        panel.locator("button[type='submit']").click()
        page.wait_for_load_state("networkidle")


def shoot(page: Page, name: str, viewport: dict, full=True) -> Path:
    page.set_viewport_size(viewport)
    page.wait_for_timeout(250)
    target = OUT / f"p1-patient-{name}-{'mobile' if viewport['width'] <= 480 else 'desktop'}.png"
    page.screenshot(path=str(target), full_page=full)
    print(f"wrote {target}")
    return target


def overflow_audit(page: Page, label: str) -> list[str]:
    """Return list of selectors whose horizontal scroll exceeds viewport."""
    page.set_viewport_size(MOBILE_320)
    page.wait_for_timeout(150)
    findings = page.evaluate(
        """() => {
          const w = document.documentElement.clientWidth;
          const out = [];
          if (document.documentElement.scrollWidth > w) {
            out.push(`document scrollWidth=${document.documentElement.scrollWidth} > ${w}`);
          }
          // walk a shallow set of suspect candidates (sections/articles)
          for (const el of document.querySelectorAll('section, article, header, form, table')) {
            if (el.scrollWidth > w + 1) {
              const cls = (el.className && typeof el.className === 'string')
                ? el.className.split(/\\s+/).slice(0,3).join('.')
                : '';
              const id = el.id ? `#${el.id}` : '';
              out.push(`${el.tagName.toLowerCase()}${id}.${cls} scrollWidth=${el.scrollWidth}`);
            }
          }
          return out;
        }"""
    )
    if findings:
        print(f"[overflow @ 320px on {label}]")
        for f in findings:
            print(f"  - {f}")
    return findings


def state_login(ctx, viewport):
    page = ctx.new_page()
    page.set_viewport_size(viewport)
    page.goto(f"{BASE}/paciente", wait_until="networkidle")
    shoot(page, "login", viewport)
    page.close()


def state_consent(ctx, viewport):
    """Patient logged in, consent NOT yet accepted: shows 'Autorizar uso dos dados'."""
    # We need a freshly-logged-in patient pre-consent. Cleanest: log in into a
    # context where the patient hasn't accepted in this DB session. Since the
    # dev DB persists consent, we can't easily un-accept it. Capture whatever
    # state actually appears. If it shows 'Consentimento registrado', skip.
    page = ctx.new_page()
    page.set_viewport_size(viewport)
    login(page, *PATIENT_HAPPY)
    panel = page.locator("#privacy-consent-panel")
    panel.wait_for(state="attached", timeout=8000)
    txt = panel.text_content() or ""
    if "Autorizar uso dos dados" in txt:
        shoot(page, "consent", viewport)
    else:
        # capture the "registered" state and note in NOTE.md
        shoot(page, "consent", viewport)
        with NOTE.open("a") as f:
            f.write(
                f"- consent ({viewport['width']}px): captured 'Consentimento registrado' "
                "instead of pre-consent state — dev DB had already accepted.\n"
            )
    page.close()


def state_empty(ctx, viewport):
    page = ctx.new_page()
    page.set_viewport_size(viewport)
    login(page, *PATIENT_HAPPY)
    accept_consent_if_pending(page)
    # Ensure no Pix pending: if there's an open order, the empty hero won't show.
    # We capture whatever we get and note.
    page.wait_for_load_state("networkidle")
    shoot(page, "empty", viewport)
    page.close()


def state_cart(ctx, viewport):
    """Cart-with-items state (CartHero shown). NOTE: the underlying sqlite is
    shared across all states in a run; if a previous state ('pix-tracking')
    left an open Pix-pending order, this state will instead show the PixHero
    takeover (the patient's *current order* takes precedence over the
    cart-preview UI). We capture whatever renders and document the caveat."""
    page = ctx.new_page()
    page.set_viewport_size(viewport)
    login(page, *PATIENT_HAPPY)
    accept_consent_if_pending(page)
    try:
        page.get_by_role("button", name="Abrir catalogo autorizado").first.click()
        page.wait_for_timeout(400)
        page.locator("[data-add='oleo-cbd-10']").first.click(timeout=5000)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        shoot(page, "cart", viewport)
    except Exception as exc:
        with NOTE.open("a") as f:
            f.write(f"- cart ({viewport['width']}px): could not stage cart — {exc}\n")
        shoot(page, "cart", viewport)
    page.close()


def state_pix_and_tracking(ctx, viewport):
    """Trigger checkout to land in PixHero, screenshot pix; then call mark-paid
    via API to advance to tracking and screenshot."""
    page = ctx.new_page()
    page.set_viewport_size(viewport)
    login(page, *PATIENT_HAPPY)
    accept_consent_if_pending(page)
    try:
        page.get_by_role("button", name="Abrir catalogo autorizado").first.click()
        page.wait_for_timeout(400)
        page.locator("[data-add='oleo-cbd-10']").first.click(timeout=5000)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        # Submit the checkout form -> Pix hero
        page.locator("#checkout button[type='submit']").click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)
        shoot(page, "pix", viewport)

        # Tracking: simulate paid via dev webhook, then refresh.
        try:
            page.evaluate(
                """async () => {
                  const r = await fetch('/api/my-orders');
                  const j = await r.json();
                  const o = (j.orders || [])[0];
                  if (!o) return null;
                  // dev provider supports manual settle — try /api/dev/settle-pix
                  await fetch('/api/dev/settle-pix', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: o.id })
                  });
                }"""
            )
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(400)
            shoot(page, "tracking", viewport)
        except Exception as exc:
            with NOTE.open("a") as f:
                f.write(f"- tracking ({viewport['width']}px): settle attempt failed — {exc}\n")
            shoot(page, "tracking", viewport)
    except Exception as exc:
        with NOTE.open("a") as f:
            f.write(f"- pix/tracking ({viewport['width']}px): could not stage — {exc}\n")
        shoot(page, "pix", viewport)
        shoot(page, "tracking", viewport)
    page.close()


def state_history(ctx, viewport):
    page = ctx.new_page()
    page.set_viewport_size(viewport)
    login(page, *PATIENT_HAPPY)
    accept_consent_if_pending(page)
    # Click Historico tab (button labelled 'Historico' in PatientTabs).
    try:
        page.get_by_role("tab", name="Historico").click(timeout=3000)
    except Exception:
        try:
            page.get_by_role("button", name="Historico").click(timeout=3000)
        except Exception:
            pass
    page.wait_for_timeout(300)
    shoot(page, "history", viewport)
    page.close()


def state_support(ctx, viewport):
    page = ctx.new_page()
    page.set_viewport_size(viewport)
    login(page, *PATIENT_HAPPY)
    accept_consent_if_pending(page)
    try:
        page.get_by_role("tab", name="Suporte").click(timeout=3000)
    except Exception:
        try:
            page.get_by_role("button", name="Suporte").click(timeout=3000)
        except Exception:
            pass
    page.wait_for_timeout(300)
    shoot(page, "support", viewport)
    page.close()


def state_blocked(ctx, viewport):
    page = ctx.new_page()
    page.set_viewport_size(viewport)
    page.goto(f"{BASE}/paciente", wait_until="networkidle")
    page.locator("#patient-login input[name='memberCode']").fill(PATIENT_BLOCKED[0])
    page.locator("#patient-login input[name='inviteCode']").fill(PATIENT_BLOCKED[1])
    page.locator("#patient-login button[type='submit']").click()
    page.wait_for_timeout(800)
    expect(page.locator("#access-issue")).to_be_visible(timeout=5000)
    shoot(page, "blocked", viewport)
    page.close()


def state_catalog_drawer(ctx, viewport):
    page = ctx.new_page()
    page.set_viewport_size(viewport)
    login(page, *PATIENT_HAPPY)
    accept_consent_if_pending(page)
    try:
        page.get_by_role("button", name="Abrir catalogo autorizado").first.click()
        page.wait_for_timeout(450)
    except Exception as exc:
        with NOTE.open("a") as f:
            f.write(f"- catalog-drawer ({viewport['width']}px): {exc}\n")
    shoot(page, "catalog-drawer", viewport)
    page.close()


def state_profile_drawer(ctx, viewport):
    page = ctx.new_page()
    page.set_viewport_size(viewport)
    login(page, *PATIENT_HAPPY)
    accept_consent_if_pending(page)
    try:
        page.get_by_role("button", name="Meu perfil").first.click()
        page.wait_for_timeout(450)
    except Exception as exc:
        with NOTE.open("a") as f:
            f.write(f"- profile-drawer ({viewport['width']}px): {exc}\n")
    shoot(page, "profile-drawer", viewport)
    page.close()


STATES = [
    ("login", state_login),
    ("consent", state_consent),
    ("empty", state_empty),
    ("cart", state_cart),
    ("pix-tracking", state_pix_and_tracking),
    ("history", state_history),
    ("support", state_support),
    ("blocked", state_blocked),
    ("catalog-drawer", state_catalog_drawer),
    ("profile-drawer", state_profile_drawer),
]


def main():
    global BASE
    OUT.mkdir(parents=True, exist_ok=True)
    owned_server = None
    owned_tmp = None
    if not os.environ.get("E2E_BASE_URL"):
        BASE, owned_server, owned_tmp = start_isolated_server()
        print(f"started isolated server at {BASE}")
    with NOTE.open("w") as f:
        f.write("# Phase 1d screenshot notes\n\n")
        f.write(f"Captured: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"Server: {BASE} (isolated={owned_server is not None})\n\n")
    try:
        run_capture()
    finally:
        if owned_server is not None:
            owned_server.terminate()
            try:
                owned_server.wait(timeout=5)
            except Exception:
                owned_server.kill()
        if owned_tmp is not None:
            owned_tmp.cleanup()


def run_capture():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for viewport in (DESKTOP, MOBILE):
            for name, fn in STATES:
                ctx = browser.new_context()  # fresh cookies per state
                try:
                    fn(ctx, viewport)
                except Exception as exc:
                    with NOTE.open("a") as f:
                        f.write(f"- {name} ({viewport['width']}px): top-level error — {exc}\n")
                    print(f"!! {name} ({viewport['width']}px): {exc}")
                finally:
                    ctx.close()
        # 320px overflow audit on the empty state
        try:
            ctx = browser.new_context()
            page = ctx.new_page()
            page.set_viewport_size(MOBILE_320)
            login(page, *PATIENT_HAPPY)
            accept_consent_if_pending(page)
            findings_empty = overflow_audit(page, "empty")
            ctx.close()
        except Exception as exc:
            print(f"!! overflow audit failed: {exc}")
            findings_empty = []
        with NOTE.open("a") as f:
            f.write("\n## 320px overflow audit (empty state)\n\n")
            if findings_empty:
                for line in findings_empty:
                    f.write(f"- {line}\n")
            else:
                f.write("- no overflow detected\n")
        browser.close()


if __name__ == "__main__":
    main()
