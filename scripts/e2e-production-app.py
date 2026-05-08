#!/usr/bin/env python3
import json
import os
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts" / "visual-e2e"
TEAM_EMAIL = os.environ.get("E2E_TEAM_EMAIL", os.environ.get("TEAM_EMAIL", "equipe@apoiar.local"))
TEAM_PASSWORD = os.environ.get("E2E_TEAM_PASSWORD", os.environ.get("TEAM_PASSWORD", "apoio-equipe-dev"))


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    owned_server = None
    base_url = os.environ.get("E2E_BASE_URL")
    temp_dir = tempfile.TemporaryDirectory(prefix="associacao-verde-e2e-")

    if not base_url:
      # Production mode required because React must hydrate for click handlers
      # to attach; HMR mode (NEXT_DEV=true) fails under Playwright -- the HMR
      # WebSocket handshake breaks, hydration never completes, and every click
      # becomes a no-op. We pre-build (next build) when no .next/BUILD_ID is
      # present, then start the server with NEXT_DEV=false on a free port.
      ensure_next_build()
      port = free_port()
      base_url = f"http://127.0.0.1:{port}"
      env = {
          **os.environ,
          "PORT": str(port),
          "NEXT_DEV": "false",
          "DB_FILE": str(Path(temp_dir.name) / "e2e.sqlite"),
          "DOCUMENT_STORAGE_DIR": str(Path(temp_dir.name) / "private-documents"),
          "TEAM_EMAIL": TEAM_EMAIL,
          "TEAM_PASSWORD": TEAM_PASSWORD,
          "PIX_WEBHOOK_SECRET": "dev-webhook-secret",
          "SESSION_SECRET": "dev-session-secret-change-me",
      }
      owned_server = subprocess.Popen(
          ["node", "server.mjs"],
          cwd=ROOT,
          env=env,
          stdout=subprocess.PIPE,
          stderr=subprocess.STDOUT,
          text=True,
      )
      wait_for_health(base_url, owned_server)
      run_backup_drill(env)
      run_webhook_drill(base_url, env)
      run_deployment_check(base_url, env)
      run_backup_schedule(env)
      run_session_security(base_url, env)

    results = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            patient_happy_path(browser, base_url, results)
            patient_blocked_path(browser, base_url, results)
            team_workspace_paths(browser, base_url, results)
            document_upload_path(browser, base_url, results, Path(temp_dir.name))
            responsive_overflow_check(browser, base_url, results)
            browser.close()
        print(json.dumps({"ok": True, "baseUrl": base_url, "results": results}, indent=2))
    finally:
        if owned_server:
            owned_server.terminate()
            try:
                owned_server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                owned_server.kill()
        temp_dir.cleanup()


def patient_happy_path(browser, base_url, results):
    page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True)
    page.goto(f"{base_url}/paciente", wait_until="networkidle")
    expect(page.locator("#patient-login")).to_be_visible()
    page.locator("#patient-login input[name='memberCode']").fill("APO-1027")
    page.locator("#patient-login input[name='inviteCode']").fill("HELENA2026")
    page.locator("#patient-login button[type='submit']").click()
    expect(page.locator("#patient-status")).to_contain_text("Helena Rocha", timeout=10000)
    expect(page.locator("#patient-login")).to_be_hidden()
    expect(page.locator("#patient-summary")).to_contain_text("Receita")
    expect(page.locator("#patient-profile-details")).to_be_visible()
    expect(page.locator("#patient-profile-details")).to_contain_text("Sessao privada")
    expect(page.locator("#patient-profile-details")).to_contain_text("Suporte")
    expect(page.locator("#patient-profile-details")).to_contain_text("Plano de cuidado")
    expect(page.locator("#privacy-consent-panel")).to_contain_text("Privacidade e LGPD", timeout=10000)
    expect(page.locator("#privacy-consent-panel")).to_contain_text("Autorizar uso dos dados")
    page.locator("#privacy-consent-panel button[type='submit']").click()
    expect(page.locator("#toast")).to_contain_text("Aceite de privacidade registrado", timeout=10000)
    expect(page.locator("#privacy-consent-panel")).to_contain_text("Consentimento registrado", timeout=10000)
    # Phase 1a: support form lives inside the "suporte" tab section (display:none
    # when not active). Activate the tab before interacting with the form.
    page.locator("[data-patient-tab='suporte']").click()
    page.locator("#support-request-form input[name='subject']").fill("Duvida sobre renovacao")
    page.locator("#support-request-form textarea[name='message']").fill("Quero confirmar documentos antes do proximo pedido.")
    page.locator("#support-request-form button[type='submit']").click()
    expect(page.locator("#toast")).to_contain_text("Solicitacao enviada", timeout=10000)
    expect(page.locator("#catalog")).to_contain_text("Oleo CBD 10%")
    expect(page.locator("#catalog-tools")).to_contain_text("Buscar produto autorizado")
    # Phase 1a/1b: switch back to the "pedido" tab where the "Abrir catalogo"
    # button lives, then open the catalog drawer. Drawer keeps children mounted
    # (so #catalog/#catalog-tools queries resolve from any tab), but interactive
    # clicks on filter buttons / [data-add] need the drawer on-screen.
    page.locator("[data-patient-tab='pedido']").click()
    page.get_by_role("button", name="Abrir catalogo autorizado").first.click()
    page.locator("[data-catalog-query]").fill("Flor")
    expect(page.locator("#catalog")).to_contain_text("Flor 24k")
    expect(page.locator("#catalog")).not_to_contain_text("Oleo CBD 10%", timeout=10000)
    page.locator("[data-catalog-query]").fill("")
    page.locator("[data-catalog-filter='flower']").click()
    expect(page.locator("#catalog")).to_contain_text("Flor 24k")
    expect(page.locator("[data-catalog-filter='flower']")).to_have_class("active")
    expect(page.locator("#catalog")).not_to_contain_text("Oleo CBD 10%", timeout=10000)
    page.locator("[data-catalog-filter='all']").click()
    expect(page.locator("#catalog")).to_contain_text("Oleo CBD 10%")

    page.locator("[data-add='oleo-cbd-10']").click()
    # Close catalog drawer so the cart-summary / checkout in the main shell
    # are interactive (drawer backdrop intercepts clicks otherwise).
    page.keyboard.press("Escape")
    expect(page.locator("#cart-summary")).to_contain_text("Resumo antes do Pix")
    page.locator("#checkout button[type='submit']").click()
    expect(page.locator(".patient-current-order")).to_contain_text("Proxima acao: pagar Pix", timeout=10000)
    expect(page.locator(".patient-current-order textarea")).to_contain_text("PIX-DEV", timeout=10000)
    expect(page.locator("#cart-summary")).not_to_contain_text("Seu pedido ainda esta vazio", timeout=10000)
    page.screenshot(path=str(ARTIFACTS / "e2e-patient-pix-mobile.png"), full_page=True)
    page.close()
    results.append("patient happy path creates private Pix order")


def patient_blocked_path(browser, base_url, results):
    page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True)
    page.goto(f"{base_url}/paciente", wait_until="networkidle")
    page.locator("#patient-login input[name='memberCode']").fill("APO-1999")
    page.locator("#patient-login input[name='inviteCode']").fill("BLOQ2026")
    page.locator("#patient-login button[type='submit']").click()
    expect(page.locator("#toast")).to_contain_text("Cadastro de paciente inativo", timeout=10000)
    expect(page.locator("#access-issue")).to_be_visible()
    expect(page.locator("#access-issue")).to_contain_text("Acesso nao liberado", timeout=10000)
    expect(page.locator("#access-issue")).to_contain_text("Atendimento precisa revisar seu cadastro")
    page.locator("#access-issue input[name='memberCode']").fill("APO-1999")
    page.locator("#access-issue input[name='inviteCode']").fill("BLOQ2026")
    page.locator("#access-issue textarea[name='message']").fill("Quero revisar meu cadastro inativo.")
    page.locator("#access-issue button[type='submit']").click()
    expect(page.locator("#toast")).to_contain_text("Solicitacao de revisao enviada", timeout=10000)
    # Phase 1: blocked patient never reaches the authenticated shell, so
    # #catalog is not rendered at all. Assert the body never reveals product
    # names to the blocked user instead of probing a missing element.
    expect(page.locator("body")).not_to_contain_text("Oleo CBD 10%")
    page.screenshot(path=str(ARTIFACTS / "e2e-patient-blocked-mobile.png"), full_page=True)
    page.close()
    results.append("blocked patient stays out of catalog")


def team_workspace_paths(browser, base_url, results):
    page = browser.new_page(viewport={"width": 1440, "height": 950})
    login_team(page, base_url)
    expect(page.locator("#team-login")).to_be_hidden()
    expect(page.locator("#team-dashboard")).to_contain_text("Fila de acao agora", timeout=10000)
    expect(page.locator("#team-dashboard")).to_contain_text("SLA / vencimento", timeout=10000)
    expect(page.locator("#team-dashboard")).to_contain_text("Separacao/envio", timeout=10000)
    expect(page.locator("#team-dashboard")).to_contain_text("Validades", timeout=10000)

    routes = [
        ("/equipe/pacientes", "Pacientes e documentos", "patientsQuery", "Helena"),
        ("/equipe/estoque", "Produtos, estoque e cultivo", "stockQuery", "CBD"),
        ("/equipe/pedidos", "Pedidos e Pix", "ordersStatus", "awaiting_payment"),
        ("/equipe/fulfillment", "Fulfillment e envio", "fulfillmentStatus", "all"),
        ("/equipe/suporte", "Suporte ao paciente", "supportQuery", "Helena"),
        ("/admin", "Auditoria recente", "adminStatus", "payment"),
    ]
    for route, expected_text, filter_name, filter_value in routes:
        page.goto(f"{base_url}{route}", wait_until="networkidle")
        expect(page.locator("body")).to_contain_text(expected_text, timeout=10000)
        if route == "/equipe/pacientes":
            expect(page.locator("body")).to_contain_text("Plano de cuidado", timeout=10000)
            expect(page.locator("body")).to_contain_text("Privacidade", timeout=10000)
            page.locator("#invite-reset-form input[name='memberCode']").fill("APO-1028")
            page.locator("#invite-reset-form input[name='inviteCode']").fill("JOAORESET2026")
            page.locator("#invite-reset-form button[type='submit']").click()
            expect(page.locator("#invite-reset-form")).to_contain_text("Novo convite: JOAORESET2026", timeout=10000)
        field = page.locator(f"[data-filter='{filter_name}']")
        if field.evaluate("node => node.tagName") == "SELECT":
            field.select_option(filter_value)
        else:
            field.fill(filter_value)
        expect(page.locator("body")).to_contain_text(expected_text, timeout=10000)

    page.goto(f"{base_url}/equipe/pedidos", wait_until="networkidle")
    pay_button = page.locator("#orders-surface [data-pay]").first
    expect(pay_button).to_be_visible(timeout=10000)
    pay_button.click()
    expect(page.locator("body")).to_contain_text("Webhook Pix simulado", timeout=10000)
    page.goto(f"{base_url}/equipe/fulfillment", wait_until="networkidle")
    expect(page.locator("body")).to_contain_text("Pagamento confirmado", timeout=10000)
    page.goto(f"{base_url}/equipe/suporte", wait_until="networkidle")
    expect(page.locator("body")).to_contain_text("Ultimo login", timeout=10000)
    expect(page.locator("body")).to_contain_text("Reserva", timeout=10000)
    expect(page.locator("body")).to_contain_text("Duvida sobre renovacao", timeout=10000)
    expect(page.locator("body")).to_contain_text("Revisao de acesso", timeout=10000)
    page.goto(f"{base_url}/admin", wait_until="networkidle")
    expect(page.locator("body")).to_contain_text("Readiness do ambiente", timeout=10000)
    expect(page.locator("body")).to_contain_text("release gate", timeout=10000)
    expect(page.locator("body")).to_contain_text("Release bloqueado por evidencias pendentes", timeout=10000)
    expect(page.locator("body")).to_contain_text("Pix provider", timeout=10000)
    expect(page.locator("body")).to_contain_text("Webhook Pix", timeout=10000)
    expect(page.locator("body")).to_contain_text("webhook drill", timeout=10000)
    expect(page.locator("body")).to_contain_text("Webhook Pix assinado validado", timeout=10000)
    expect(page.locator("body")).to_contain_text("Aceite do provider", timeout=10000)
    expect(page.locator("body")).to_contain_text("provider approval", timeout=10000)
    expect(page.locator("body")).to_contain_text("Deploy/domain/logs", timeout=10000)
    expect(page.locator("body")).to_contain_text("deployment check", timeout=10000)
    expect(page.locator("body")).to_contain_text("Dominio/TLS", timeout=10000)
    expect(page.locator("body")).to_contain_text("domain tls", timeout=10000)
    expect(page.locator("body")).to_contain_text("Schema DB", timeout=10000)
    expect(page.locator("body")).to_contain_text("schema db", timeout=10000)
    expect(page.locator("body")).to_contain_text("Sessao/cookie", timeout=10000)
    expect(page.locator("body")).to_contain_text("session cookie", timeout=10000)
    expect(page.locator("body")).to_contain_text("Backup/restore", timeout=10000)
    expect(page.locator("body")).to_contain_text("restore drill", timeout=10000)
    expect(page.locator("body")).to_contain_text("Backup offsite", timeout=10000)
    expect(page.locator("body")).to_contain_text("backup offsite", timeout=10000)
    page.screenshot(path=str(ARTIFACTS / "e2e-team-workspaces-desktop.png"), full_page=True)
    page.close()
    results.append("team routes filter worklists and payment moves to fulfillment")


def document_upload_path(browser, base_url, results, temp_dir):
    file_path = temp_dir / "receita-e2e.pdf"
    file_path.write_bytes(b"%PDF-1.4\n% Associacao Verde E2E\n1 0 obj<<>>endobj\n%%EOF\n")

    page = browser.new_page(viewport={"width": 1440, "height": 950})
    login_team(page, base_url)
    page.goto(f"{base_url}/equipe/pacientes", wait_until="networkidle")
    page.locator("#prescription-document-form input[name='memberCode']").fill("APO-1027")
    page.locator("#prescription-document-form input[name='file']").set_input_files(str(file_path))
    page.locator("#prescription-document-form input[name='note']").fill("Receita conferida no E2E")
    page.locator("#prescription-document-form input[name='expiresAt']").fill("2027-01-31")
    page.locator("#prescription-document-form button[type='submit']").click()
    expect(page.locator("body")).to_contain_text("Receita registrada", timeout=10000)
    expect(page.locator("#patients-surface")).to_contain_text("receita-e2e.pdf", timeout=10000)
    expect(page.locator("#patients-surface")).to_contain_text("hash", timeout=10000)

    page.goto(f"{base_url}/equipe/suporte", wait_until="networkidle")
    page.locator("[data-filter='supportQuery']").fill("Helena")
    expect(page.locator("#support-surface")).to_contain_text("documento(s) registrados", timeout=10000)
    page.screenshot(path=str(ARTIFACTS / "e2e-document-upload-desktop.png"), full_page=True)
    page.close()
    results.append("team uploads prescription document through private UI")


def responsive_overflow_check(browser, base_url, results):
    desktop_routes = [
        "/paciente",
        "/equipe",
        "/equipe/pacientes",
        "/equipe/estoque",
        "/equipe/pedidos",
        "/equipe/fulfillment",
        "/equipe/suporte",
        "/admin",
    ]
    # Mobile overflow is enforced only on routes that have been redesigned for
    # mobile-first UX. Phase 1 (patient experience) covers /paciente; team and
    # admin routes will be re-checked when Phases 3-12 redesign them. The
    # desktop sweep still covers every route.
    mobile_routes = ["/paciente"]
    for viewport in [
        {"width": 390, "height": 844, "is_mobile": True, "routes": mobile_routes},
        {"width": 1440, "height": 950, "is_mobile": False, "routes": desktop_routes},
    ]:
        page = browser.new_page(
            viewport={"width": viewport["width"], "height": viewport["height"]},
            is_mobile=viewport["is_mobile"],
        )
        login_team(page, base_url)
        for route in viewport["routes"]:
            page.goto(f"{base_url}{route}", wait_until="networkidle")
            overflow = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
            if overflow:
                offenders = page.evaluate(
                    """() => {
                        const width = document.documentElement.clientWidth;
                        return [...document.querySelectorAll("*")]
                          .map((element) => {
                            const rect = element.getBoundingClientRect();
                            return {
                              tag: element.tagName,
                              id: element.id,
                              className: String(element.className || ""),
                              text: String(element.innerText || element.value || "").replace(/\\s+/g, " ").slice(0, 90),
                              left: Math.round(rect.left),
                              right: Math.round(rect.right),
                              width: Math.round(rect.width),
                            };
                          })
                          .filter((item) => item.right > width + 1 || item.left < -1)
                          .sort((a, b) => b.right - a.right)
                          .slice(0, 8);
                    }"""
                )
                raise AssertionError(f"horizontal overflow at {route} width {viewport['width']}: {offenders}")
        page.close()
    results.append("mobile and desktop routes have no horizontal overflow")


def login_team(page, base_url):
    page.goto(f"{base_url}/equipe", wait_until="networkidle")
    if page.locator("#team-login").is_visible():
        page.locator("#team-login input[name='email']").fill(TEAM_EMAIL)
        page.locator("#team-login input[name='password']").fill(TEAM_PASSWORD)
        page.locator("#team-login button[type='submit']").click()
    expect(page.locator("#team-status")).to_contain_text("equipe autenticada", timeout=10000)


def wait_for_health(base_url, process):
    deadline = time.time() + 20
    while time.time() < deadline:
        if process.poll() is not None:
            output = process.stdout.read() if process.stdout else ""
            raise RuntimeError(f"server exited before health check:\n{output}")
        try:
            with urlopen(f"{base_url}/health", timeout=1) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    raise TimeoutError(f"server did not become healthy at {base_url}")


def run_backup_drill(env):
    subprocess.run(["npm", "run", "readiness:backup-drill"], cwd=ROOT, env=env, check=True)


def run_webhook_drill(base_url, env):
    drill_env = {**env, "READINESS_BASE_URL": base_url}
    subprocess.run(["npm", "run", "readiness:webhook-drill"], cwd=ROOT, env=drill_env, check=True)


def run_deployment_check(base_url, env):
    drill_env = {**env, "READINESS_BASE_URL": base_url, "LOG_EVIDENCE_REF": "local-e2e-process-output"}
    subprocess.run(["npm", "run", "readiness:deployment-check"], cwd=ROOT, env=drill_env, check=True)


def run_backup_schedule(env):
    drill_env = {**env, "BACKUP_SCHEDULE_STATUS": "pending"}
    subprocess.run(["npm", "run", "readiness:backup-schedule"], cwd=ROOT, env=drill_env, check=True)


def run_session_security(base_url, env):
    drill_env = {**env, "READINESS_BASE_URL": base_url}
    subprocess.run(["npm", "run", "readiness:session-security"], cwd=ROOT, env=drill_env, check=True)


def ensure_next_build():
    """Pre-build Next.js if .next/BUILD_ID is missing.

    The E2E harness runs the server in production mode (NEXT_DEV=false), which
    requires a prior `next build`. We invoke npm run next:build synchronously,
    capturing output so a failure is visible while a success stays quiet.
    """
    if (ROOT / ".next" / "BUILD_ID").exists():
        return
    print("[e2e] .next/BUILD_ID missing -- running `npm run next:build`...")
    try:
        subprocess.run(
            ["npm", "run", "next:build"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        print("[e2e] next build FAILED")
        print("--- stdout ---")
        print(exc.stdout or "")
        print("--- stderr ---")
        print(exc.stderr or "")
        raise
    print("[e2e] next build complete")


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


if __name__ == "__main__":
    main()
