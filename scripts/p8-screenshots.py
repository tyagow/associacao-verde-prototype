"""Phase 8 screenshot capture for the ⌘K command palette.

Captures the palette open + typing state at desktop 1280x800.

Outputs:
  artifacts/visual-e2e/redesign/p8-cmdk-desktop.png

Usage:
  python3 scripts/p8-screenshots.py
  E2E_BASE_URL=http://127.0.0.1:4184 python3 scripts/p8-screenshots.py
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

TEAM_EMAIL = os.environ.get("TEAM_EMAIL", "equipe@apoiar.local")
TEAM_PASSWORD = os.environ.get("TEAM_PASSWORD", "apoio-equipe-dev")


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
    tmp = tempfile.TemporaryDirectory(prefix="p8-screenshots-")
    env = {
        **os.environ,
        "PORT": str(port),
        "NEXT_DEV": "false",
        "DB_FILE": str(Path(tmp.name) / "p8.sqlite"),
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
    page.goto(f"{base_url}/equipe", wait_until="domcontentloaded")
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


def shoot_palette(page: Page, name: str) -> Path:
    # Click the kbd hint button to open the palette (works cross-platform
    # without depending on Playwright's modifier-key emulation).
    page.locator("[data-cmdk-trigger]").click()
    # Wait for the cmdk dialog (cmdk emits role=dialog on the Command root).
    page.wait_for_selector("[cmdk-root]", state="visible", timeout=5000)
    # Type a query so the filter results render with active selection.
    page.keyboard.type("pix", delay=40)
    page.wait_for_timeout(400)
    target = OUT / f"p8-cmdk-{name}.png"
    page.screenshot(path=str(target), full_page=False)
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
                ctx = browser.new_context(viewport=DESKTOP)
                page = ctx.new_page()
                login_team(page, base)
                page.goto(f"{base}/equipe", wait_until="domcontentloaded")
                page.locator("#team-dashboard").wait_for(state="attached", timeout=10000)
                page.wait_for_timeout(1500)
                shoot_palette(page, "desktop")
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
