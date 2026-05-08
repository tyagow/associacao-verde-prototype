"""Phase 4 screenshot capture for /equipe/pedidos.

Captures the rebuilt two-ledger view (Pix pendentes + Pedidos pagos) at:
  - desktop 1280x800
  - mobile  390x844

Outputs:
  artifacts/visual-e2e/redesign/p4-orders-desktop.png
  artifacts/visual-e2e/redesign/p4-orders-mobile.png

Pre-req: a server running with seeded team credentials. By default
this spins up an isolated production-mode server on a free port (same
pattern as scripts/p1-screenshots.py and the E2E harness — required
because Playwright doesn't hydrate against the long-lived NEXT_DEV
server).

Usage:
  python3 scripts/p4-screenshots.py
  E2E_BASE_URL=http://127.0.0.1:4184 python3 scripts/p4-screenshots.py  # use shared dev
"""

from __future__ import annotations

import os
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen
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
    tmp = tempfile.TemporaryDirectory(prefix="p4-screenshots-")
    env = {
        **os.environ,
        "PORT": str(port),
        "NEXT_DEV": "false",
        "DB_FILE": str(Path(tmp.name) / "p4.sqlite"),
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
    # Wait until the auth chip flips — same gate the E2E uses.
    page.locator("#team-status").wait_for(state="attached", timeout=10000)
    for _ in range(40):
        text = page.locator("#team-status").text_content() or ""
        if "equipe autenticada" in text:
            break
        page.wait_for_timeout(250)


def stage_pending_pix(base_url: str, page: Page) -> None:
    """Trigger a patient checkout so a Pix payment exists in the dashboard."""
    page.goto(f"{base_url}/paciente", wait_until="networkidle")
    page.locator("#patient-login input[name='memberCode']").fill(PATIENT_HAPPY[0])
    page.locator("#patient-login input[name='inviteCode']").fill(PATIENT_HAPPY[1])
    page.locator("#patient-login button[type='submit']").click()
    page.wait_for_load_state("networkidle")
    # Accept consent if pending.
    panel = page.locator("#privacy-consent-panel")
    try:
        panel.wait_for(state="attached", timeout=4000)
        if "Autorizar uso dos dados" in (panel.text_content() or ""):
            panel.locator("button[type='submit']").click()
            page.wait_for_load_state("networkidle")
    except Exception:
        pass
    # Open catalog drawer and add an item.
    try:
        page.get_by_role("button", name="Abrir catalogo autorizado").first.click(
            timeout=4000
        )
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


def shoot(page: Page, name: str, viewport: dict) -> Path:
    page.set_viewport_size(viewport)
    page.wait_for_timeout(400)
    target = OUT / f"p4-orders-{name}.png"
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
                # Stage a pending Pix so the top ledger has rows.
                stage_ctx = browser.new_context(viewport=DESKTOP)
                stage_page = stage_ctx.new_page()
                try:
                    stage_pending_pix(base, stage_page)
                except Exception as exc:
                    print(f"[warn] could not stage pending Pix: {exc}")
                stage_ctx.close()

                # Desktop screenshot.
                ctx = browser.new_context(viewport=DESKTOP)
                page = ctx.new_page()
                login_team(page, base)
                page.goto(f"{base}/equipe/pedidos", wait_until="networkidle")
                # Wait for the orders surface to render rather than guessing.
                page.locator("#orders-surface").wait_for(state="attached", timeout=10000)
                page.wait_for_timeout(800)
                print(f"desktop final URL: {page.url}")
                shoot(page, "desktop", DESKTOP)
                ctx.close()

                # Mobile screenshot.
                ctx = browser.new_context(viewport=MOBILE)
                page = ctx.new_page()
                login_team(page, base)
                page.goto(f"{base}/equipe/pedidos", wait_until="networkidle")
                page.locator("#orders-surface").wait_for(state="attached", timeout=10000)
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
