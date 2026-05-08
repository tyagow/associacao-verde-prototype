"""Phase 10 admin audit + team-users screenshot capture.

Captures the redesigned grouped audit timeline and the single team users
table on /admin at desktop. Mirrors the p9-screenshots harness:

  - Spins up an isolated production-mode server so React hydrates.
  - Logs in as team, navigates to /admin.
  - Scrolls to each panel before snapping a clipped screenshot.

Outputs:
  artifacts/visual-e2e/redesign/p10-admin-audit-desktop.png
  artifacts/visual-e2e/redesign/p10-admin-users-desktop.png

Usage: python3 scripts/p10-screenshots.py
"""

from __future__ import annotations

import os
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import Page, expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path("artifacts/visual-e2e/redesign")

DESKTOP = {"width": 1280, "height": 900}

TEAM_EMAIL = "equipe@apoiar.local"
TEAM_PASSWORD = "apoio-equipe-dev"


def free_port() -> int:
    s = socket.socket()
    s.bind(("", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def wait_for_health(base_url: str, timeout: float = 60.0) -> None:
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
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    tmp = tempfile.TemporaryDirectory(prefix="p10-screenshots-")
    env = {
        **os.environ,
        "PORT": str(port),
        "NEXT_DEV": "false",
        "DB_FILE": str(Path(tmp.name) / "p10.sqlite"),
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
        wait_for_health(base)
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
    expect(page.locator("#team-status")).to_contain_text("equipe autenticada", timeout=10000)


def shoot_section(page: Page, kicker_text: str, target: Path) -> None:
    locator = page.locator(f'p.kicker:has-text("{kicker_text}")').first
    panel = locator.locator(
        "xpath=ancestor::section[contains(@class,'panel')][1] | ancestor::*[contains(@class,'panel')][1]"
    ).first
    panel.scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    panel.screenshot(path=str(target))
    print(f"wrote {target}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    base, proc, tmp = start_isolated_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                ctx = browser.new_context(viewport=DESKTOP)
                page = ctx.new_page()
                login_team(page, base)
                page.goto(f"{base}/admin", wait_until="networkidle")
                page.wait_for_selector("[data-gate]", timeout=10000)
                page.wait_for_timeout(400)

                shoot_section(page, "Usuarios da equipe", OUT / "p10-admin-users-desktop.png")
                shoot_section(page, "Auditoria recente", OUT / "p10-admin-audit-desktop.png")
            finally:
                browser.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        tmp.cleanup()


if __name__ == "__main__":
    main()
