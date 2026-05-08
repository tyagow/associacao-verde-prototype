"""Phase 12 mobile polish sweep — audit + screenshot capture.

Spins up an isolated production-mode server (mirrors p1/p9 pattern) so React
hydrates under Playwright. For every redesigned surface, captures screenshots
at 390x844 (mobile primary) and 320x568 (mobile narrow), and asserts no
horizontal overflow at either width. Also runs an "offenders" probe that lists
the worst-offending elements when overflow is detected (matches the E2E
responsive_overflow_check probe).

Outputs (under artifacts/visual-e2e/redesign/):
  p12-<label>-390.png
  p12-<label>-320.png
  p12-mobile-overview-grid.png  (best-effort composite via PIL)

Routes covered:
  /                       (public landing)
  /paciente               (login + post-login modes)
  /equipe                 (command center)
  /equipe/pacientes
  /equipe/estoque
  /equipe/pedidos
  /equipe/fulfillment     (kanban — single column tabs on mobile)
  /equipe/suporte         (workbench — stacked on mobile)
  /admin                  (readiness — 1-col on mobile)

Usage: python3 scripts/p12-screenshots.py [--audit-only]
"""

from __future__ import annotations

import argparse
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import Page, expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path("artifacts/visual-e2e/redesign")

WIDTH_PRIMARY = 390
WIDTH_NARROW = 320
HEIGHT_PRIMARY = 844
HEIGHT_NARROW = 720

TEAM_EMAIL = "equipe@apoiar.local"
TEAM_PASSWORD = "apoio-equipe-dev"
PATIENT_MEMBER = "APO-1027"
PATIENT_INVITE = "HELENA2026"

OFFENDER_JS = r"""() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll('*')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          id: el.id,
          cls: String(el.className || '').slice(0, 80),
          text: String(el.innerText || el.value || '').replace(/\s+/g, ' ').slice(0, 80),
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
        };
      })
      .filter((it) => it.right > width + 1 || it.left < -1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 8);
}"""


def free_port() -> int:
    s = socket.socket()
    s.bind(("", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def wait_for_health(base_url: str, timeout: float = 90.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urlopen(f"{base_url}/health", timeout=1) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError(f"server did not become healthy at {base_url}")


def start_isolated_server():
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    tmp = tempfile.TemporaryDirectory(prefix="p12-screenshots-")
    env = {
        **os.environ,
        "PORT": str(port),
        "NEXT_DEV": "false",
        "DB_FILE": str(Path(tmp.name) / "p12.sqlite"),
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


def login_patient(page: Page, base_url: str) -> None:
    page.goto(f"{base_url}/paciente", wait_until="networkidle")
    if page.locator("#patient-login").is_visible():
        page.locator("#patient-login input[name='memberCode']").fill(PATIENT_MEMBER)
        page.locator("#patient-login input[name='inviteCode']").fill(PATIENT_INVITE)
        page.locator("#patient-login button[type='submit']").click()
    expect(page.locator("#patient-status")).to_contain_text("Helena", timeout=10000)


def check_overflow(page: Page, route: str, width: int) -> list:
    overflow = page.evaluate(
        "() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"
    )
    if not overflow:
        return []
    return page.evaluate(OFFENDER_JS)


SURFACES = [
    # (route, label, kind)  kind: 'public', 'patient', 'team'
    ("/", "home", "public"),
    ("/paciente", "paciente", "patient"),
    ("/equipe", "equipe-comando", "team"),
    ("/equipe/pacientes", "equipe-pacientes", "team"),
    ("/equipe/estoque", "equipe-estoque", "team"),
    ("/equipe/pedidos", "equipe-pedidos", "team"),
    ("/equipe/fulfillment", "equipe-fulfillment", "team"),
    ("/equipe/suporte", "equipe-suporte", "team"),
    ("/admin", "admin", "team"),
]


def run_for_width(p, base: str, width: int, height: int, do_screenshots: bool, results: dict):
    browser = p.chromium.launch(headless=True)
    try:
        page = browser.new_page(
            viewport={"width": width, "height": height},
            is_mobile=True,
        )
        # Pre-login both surfaces as needed
        login_team(page, base)
        # patient login is in a separate context-equivalent; share page but log in patient too
        # Actually we need patient login specifically when on /paciente; we'll do it at navigate time.
        for route, label, kind in SURFACES:
            page.goto(f"{base}{route}", wait_until="load")
            page.wait_for_timeout(400)
            if kind == "patient":
                # If patient login form is visible, fill it
                if page.locator("#patient-login").is_visible():
                    page.locator("#patient-login input[name='memberCode']").fill(PATIENT_MEMBER)
                    page.locator("#patient-login input[name='inviteCode']").fill(PATIENT_INVITE)
                    page.locator("#patient-login button[type='submit']").click()
                    page.wait_for_timeout(800)
            page.wait_for_timeout(400)
            offenders = check_overflow(page, route, width)
            key = f"{label}@{width}"
            if offenders:
                results.setdefault("overflow", {})[key] = offenders
                print(f"  OVERFLOW {key}:")
                for off in offenders[:5]:
                    print(f"    - {off['tag']}.{off['cls'][:40]} right={off['right']} w={off['width']} text={off['text'][:50]!r}")
            else:
                print(f"  ok {key}")
            if do_screenshots:
                target = OUT / f"p12-{label}-{width}.png"
                try:
                    page.screenshot(path=str(target), full_page=True)
                    results.setdefault("shots", []).append(str(target))
                except Exception as exc:
                    print(f"  warn screenshot failed for {key}: {exc}")
    finally:
        browser.close()


def make_contact_sheet(shots: list[str]) -> Path | None:
    try:
        from PIL import Image  # type: ignore
    except Exception:
        return None
    if not shots:
        return None
    imgs = []
    for s in shots:
        try:
            im = Image.open(s)
            # cap height to keep grid manageable
            max_h = 1200
            if im.height > max_h:
                ratio = max_h / im.height
                im = im.resize((int(im.width * ratio), max_h))
            imgs.append((Path(s).name, im))
        except Exception:
            continue
    if not imgs:
        return None
    cols = 3
    pad = 16
    label_h = 28
    cell_w = max(im.width for _, im in imgs)
    cell_h = max(im.height for _, im in imgs) + label_h
    rows = (len(imgs) + cols - 1) // cols
    sheet_w = cols * cell_w + (cols + 1) * pad
    sheet_h = rows * cell_h + (rows + 1) * pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), (245, 245, 240))
    try:
        from PIL import ImageDraw, ImageFont  # type: ignore
        draw = ImageDraw.Draw(sheet)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
        except Exception:
            font = ImageFont.load_default()
    except Exception:
        draw = None
        font = None
    for i, (name, im) in enumerate(imgs):
        r = i // cols
        c = i % cols
        x = pad + c * (cell_w + pad)
        y = pad + r * (cell_h + pad)
        if draw and font:
            draw.text((x, y), name, fill=(20, 30, 25), font=font)
        sheet.paste(im, (x, y + label_h))
    target = OUT / "p12-mobile-overview-grid.png"
    sheet.save(target)
    return target


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audit-only", action="store_true", help="Skip screenshots, just audit overflow")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    base, proc, tmp = start_isolated_server()
    results: dict = {}
    try:
        with sync_playwright() as p:
            print(f"=== auditing at {WIDTH_PRIMARY}x{HEIGHT_PRIMARY} ===")
            run_for_width(p, base, WIDTH_PRIMARY, HEIGHT_PRIMARY, not args.audit_only, results)
            print(f"=== auditing at {WIDTH_NARROW}x{HEIGHT_NARROW} ===")
            run_for_width(p, base, WIDTH_NARROW, HEIGHT_NARROW, not args.audit_only, results)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        tmp.cleanup()

    overflow_map = results.get("overflow") or {}
    shots = results.get("shots") or []
    print()
    print(f"=== summary: {len(shots)} screenshots, {len(overflow_map)} overflow keys ===")
    if overflow_map:
        for k, offs in overflow_map.items():
            print(f"  {k}: {len(offs)} offenders")
    if shots and not args.audit_only:
        sheet = make_contact_sheet(shots)
        if sheet:
            print(f"contact sheet: {sheet}")
        else:
            print("(PIL not available — skipped contact sheet, individual files in place)")
    if overflow_map:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
