"""Phase 0 screenshot capture: tokens-applied baselines.

Usage: python3 scripts/p0-screenshots.py
"""

from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4184"
OUT = Path("artifacts/visual-e2e/redesign")
ROUTES = [("home", "/"), ("paciente", "/paciente"), ("equipe", "/equipe"), ("admin", "/admin")]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        for name, path in ROUTES:
            page.goto(f"{BASE}{path}", wait_until="networkidle")
            target = OUT / f"p0-tokens-applied-{name}-desktop.png"
            page.screenshot(path=str(target), full_page=True)
            print(f"wrote {target}")
        browser.close()


if __name__ == "__main__":
    main()
