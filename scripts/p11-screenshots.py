"""Phase 11 public landing screenshot capture.

Captures the redesigned institutional public landing at desktop and
mobile viewports. The page has no authentication and no E2E
assertions, so the harness simply navigates the unauthenticated
visitor path. Mirrors the p10 harness pattern: spins up an isolated
production-mode server so React hydrates.

Outputs (six files):
  artifacts/visual-e2e/redesign/p11-public-hero-desktop.png
  artifacts/visual-e2e/redesign/p11-public-hero-mobile.png
  artifacts/visual-e2e/redesign/p11-public-middle-desktop.png
  artifacts/visual-e2e/redesign/p11-public-middle-mobile.png
  artifacts/visual-e2e/redesign/p11-public-footer-desktop.png
  artifacts/visual-e2e/redesign/p11-public-footer-mobile.png

Usage: python3 scripts/p11-screenshots.py
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
OUT = Path("artifacts/visual-e2e/redesign")

DESKTOP = {"width": 1280, "height": 900}
MOBILE = {"width": 390, "height": 844}


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
    tmp = tempfile.TemporaryDirectory(prefix="p11-screenshots-")
    env = {
        **os.environ,
        "PORT": str(port),
        "NEXT_DEV": "false",
        "DB_FILE": str(Path(tmp.name) / "p11.sqlite"),
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
        wait_for_health(base)
    except Exception:
        proc.terminate()
        raise
    return base, proc, tmp


def shoot_anchor(page: Page, anchor_id: str, target: Path) -> None:
    locator = page.locator(f"#{anchor_id}").first
    locator.scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    locator.screenshot(path=str(target))
    print(f"wrote {target}")


def shoot_hero(page: Page, target: Path) -> None:
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(200)
    page.locator("section[aria-labelledby='lx-hero-title']").first.screenshot(
        path=str(target)
    )
    print(f"wrote {target}")


def shoot_footer(page: Page, target: Path) -> None:
    locator = page.locator("footer").last
    locator.scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    locator.screenshot(path=str(target))
    print(f"wrote {target}")


def capture(base: str, viewport: dict, suffix: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            ctx = browser.new_context(viewport=viewport, is_mobile=(viewport is MOBILE))
            page = ctx.new_page()
            page.goto(f"{base}/", wait_until="networkidle")
            page.wait_for_timeout(400)

            shoot_hero(page, OUT / f"p11-public-hero-{suffix}.png")
            shoot_anchor(page, "programas", OUT / f"p11-public-middle-{suffix}.png")
            shoot_footer(page, OUT / f"p11-public-footer-{suffix}.png")
        finally:
            browser.close()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    base, proc, tmp = start_isolated_server()
    try:
        capture(base, DESKTOP, "desktop")
        capture(base, MOBILE, "mobile")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        tmp.cleanup()


if __name__ == "__main__":
    main()
