"""Phase 5 screenshot capture for /equipe/fulfillment.

Captures the rebuilt drag-and-drop kanban (Pago aguardando · Em
separacao · Pronto despachar · Enviado) at:
  - desktop 1280x800
  - mobile  390x844

Outputs:
  artifacts/visual-e2e/redesign/p5-fulfillment-kanban-desktop.png
  artifacts/visual-e2e/redesign/p5-fulfillment-kanban-mobile.png

Pre-req: a server running with seeded team credentials. By default this
spins up an isolated production-mode server on a free port (same
pattern as scripts/p4-screenshots.py — required because Playwright
doesn't hydrate against the long-lived NEXT_DEV server).

Usage:
  python3 scripts/p5-screenshots.py
  E2E_BASE_URL=http://127.0.0.1:4185 python3 scripts/p5-screenshots.py
"""

from __future__ import annotations

import os
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen, Request
from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "visual-e2e" / "redesign"
OUT.mkdir(parents=True, exist_ok=True)

DESKTOP = {"width": 1280, "height": 800}
MOBILE = {"width": 390, "height": 844}

TEAM_EMAIL = os.environ.get("TEAM_EMAIL", "equipe@apoiar.local")
TEAM_PASSWORD = os.environ.get("TEAM_PASSWORD", "apoio-equipe-dev")
PATIENT_HAPPY = ("APO-1027", "HELENA2026")


def free_port() -> int:
    s = socket.socket()
    s.bind(("", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def wait_for_health(base_url: str, proc: subprocess.Popen, timeout: float = 60.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urlopen(f"{base_url}/health", timeout=1) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(0.4)
    raise RuntimeError(f"server did not become healthy at {base_url}")


def start_isolated_server() -> tuple[str, subprocess.Popen, tempfile.TemporaryDirectory]:
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    tmp = tempfile.TemporaryDirectory(prefix="p5-screenshots-")
    env = {
        **os.environ,
        "PORT": str(port),
        "NEXT_DEV": "false",
        "DB_FILE": str(Path(tmp.name) / "p5.sqlite"),
        "DOCUMENT_STORAGE_DIR": str(Path(tmp.name) / "docs"),
        "TEAM_EMAIL": TEAM_EMAIL,
        "TEAM_PASSWORD": TEAM_PASSWORD,
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


def login_team(page: Page, base_url: str) -> None:
    page.goto(f"{base_url}/equipe", wait_until="networkidle")
    if page.locator("#team-login").is_visible():
        page.locator("#team-login input[name='email']").fill(TEAM_EMAIL)
        page.locator("#team-login input[name='password']").fill(TEAM_PASSWORD)
        page.locator("#team-login button[type='submit']").click()
    page.locator("#team-status").wait_for(state="attached", timeout=10000)
    for _ in range(40):
        text = page.locator("#team-status").text_content() or ""
        if "equipe autenticada" in text:
            break
        page.wait_for_timeout(250)


def stage_paid_order(base_url: str, page: Page) -> None:
    """Stage a checkout + simulate Pix so a paid order shows in the kanban."""
    page.goto(f"{base_url}/paciente", wait_until="networkidle")
    page.locator("#patient-login input[name='memberCode']").fill(PATIENT_HAPPY[0])
    page.locator("#patient-login input[name='inviteCode']").fill(PATIENT_HAPPY[1])
    page.locator("#patient-login button[type='submit']").click()
    page.wait_for_load_state("networkidle")
    panel = page.locator("#privacy-consent-panel")
    try:
        panel.wait_for(state="attached", timeout=4000)
        if "Autorizar uso dos dados" in (panel.text_content() or ""):
            panel.locator("button[type='submit']").click()
            page.wait_for_load_state("networkidle")
    except Exception:
        pass
    try:
        page.get_by_role("button", name="Abrir catalogo autorizado").first.click(timeout=4000)
        page.wait_for_timeout(300)
    except Exception:
        pass
    try:
        page.locator("[data-add='oleo-cbd-10']").first.click(timeout=4000)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.locator("#checkout button[type='submit']").click(timeout=4000)
        page.wait_for_load_state("networkidle")
    except Exception:
        pass


def confirm_pix_via_team(base_url: str, page: Page) -> None:
    """Click the team's Pix-simulate button to mark the staged order paid."""
    login_team(page, base_url)
    page.goto(f"{base_url}/equipe/pedidos", wait_until="networkidle")
    pay_button = page.locator("#orders-surface [data-pay]").first
    try:
        pay_button.wait_for(state="visible", timeout=8000)
        pay_button.click()
        page.wait_for_load_state("networkidle")
    except Exception as exc:
        print(f"[warn] could not simulate Pix: {exc}")


def shoot(page: Page, name: str, viewport: dict) -> Path:
    page.set_viewport_size(viewport)
    page.wait_for_timeout(400)
    target = OUT / f"p5-fulfillment-kanban-{name}.png"
    page.screenshot(path=str(target), full_page=True)
    print(f"wrote {target}")
    return target


def main() -> None:
    base = os.environ.get("E2E_BASE_URL")
    proc = None
    tmp = None
    if not base:
        base, proc, tmp = start_isolated_server()
        print(f"isolated server at {base}")
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            try:
                # Stage a paid order so the kanban has cards.
                stage_ctx = browser.new_context(viewport=DESKTOP)
                stage_page = stage_ctx.new_page()
                try:
                    stage_paid_order(base, stage_page)
                except Exception as exc:
                    print(f"[warn] could not stage order: {exc}")
                stage_ctx.close()

                team_ctx = browser.new_context(viewport=DESKTOP)
                team_page = team_ctx.new_page()
                try:
                    confirm_pix_via_team(base, team_page)
                except Exception as exc:
                    print(f"[warn] could not confirm Pix: {exc}")
                team_ctx.close()

                # Desktop kanban.
                ctx = browser.new_context(viewport=DESKTOP)
                page = ctx.new_page()
                login_team(page, base)
                page.goto(f"{base}/equipe/fulfillment", wait_until="networkidle")
                page.locator("#fulfillment-surface").wait_for(state="attached", timeout=10000)
                page.wait_for_timeout(800)
                print(f"desktop final URL: {page.url}")
                shoot(page, "desktop", DESKTOP)
                ctx.close()

                # Mobile kanban.
                ctx = browser.new_context(viewport=MOBILE)
                page = ctx.new_page()
                login_team(page, base)
                page.goto(f"{base}/equipe/fulfillment", wait_until="networkidle")
                page.locator("#fulfillment-surface").wait_for(state="attached", timeout=10000)
                page.wait_for_timeout(800)
                print(f"mobile final URL: {page.url}")
                shoot(page, "mobile", MOBILE)
                ctx.close()
            finally:
                browser.close()
    finally:
        if proc is not None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except Exception:
                proc.kill()
        if tmp is not None:
            tmp.cleanup()


if __name__ == "__main__":
    main()
