"""Phase 9 admin readiness screenshot capture.

Captures the redesigned admin readiness page on desktop and mobile.

Spins up an isolated production-mode server (mirrors the p1 pattern) so
React hydrates under Playwright. Logs in as team, navigates to /admin,
captures /admin at 1280x900 (desktop) and 390x900 (mobile).

Outputs:
  artifacts/visual-e2e/redesign/p9-admin-readiness-desktop.png
  artifacts/visual-e2e/redesign/p9-admin-readiness-mobile.png

Usage: python3 scripts/p9-screenshots.py
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
MOBILE = {"width": 390, "height": 900}

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
    tmp = tempfile.TemporaryDirectory(prefix="p9-screenshots-")
    env = {
        **os.environ,
        "PORT": str(port),
        "NEXT_DEV": "false",
        "DB_FILE": str(Path(tmp.name) / "p9.sqlite"),
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


def shoot_admin(page: Page, base_url: str, viewport: dict, label: str) -> None:
    page.set_viewport_size(viewport)
    page.goto(f"{base_url}/admin", wait_until="networkidle")
    # Wait until readiness has loaded (gate cards render).
    page.wait_for_selector("[data-gate]", timeout=10000)
    page.wait_for_timeout(400)
    target = OUT / f"p9-admin-readiness-{label}.png"
    page.screenshot(path=str(target), full_page=True)
    print(f"wrote {target}")

    # Click the first non-passing gate to expand the detail panel and shoot a
    # second image showing the form drawer state.
    pending = page.locator("[data-gate][data-tone='warn']").first
    if pending.count() > 0:
        pending.click()
        page.wait_for_timeout(300)
        target2 = OUT / f"p9-admin-readiness-{label}-detail.png"
        page.screenshot(path=str(target2), full_page=True)
        print(f"wrote {target2}")


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
                shoot_admin(page, base, DESKTOP, "desktop")
                shoot_admin(page, base, MOBILE, "mobile")
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
