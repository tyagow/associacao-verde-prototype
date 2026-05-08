#!/usr/bin/env node
// Idempotent dev helper: ensures the TIAGO patient exists so a fresh dev
// reset doesn't wipe out the human operator's quick-access account.
// Usage: node scripts/add-dev-user.mjs [baseUrl]

const baseUrl = process.argv[2] || process.env.DEV_BASE_URL || "http://127.0.0.1:4184";
const teamEmail = process.env.TEAM_EMAIL || "equipe@apoiar.local";
const teamPassword = process.env.TEAM_PASSWORD || "apoio-equipe-dev";

const memberCode = process.env.DEV_PATIENT_CODE || "TIAGO";
const inviteCode = process.env.DEV_PATIENT_INVITE || "TIAGO";
const name = process.env.DEV_PATIENT_NAME || "Tiago Filterbuy";

async function main() {
  const probe = await fetch(`${baseUrl}/api/patient/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberCode, inviteCode }),
  });
  if (probe.ok) {
    console.log(`OK: patient ${memberCode}/${inviteCode} already accepts login`);
    return;
  }

  const login = await fetch(`${baseUrl}/api/team/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: teamEmail, password: teamPassword }),
  });
  if (!login.ok) throw new Error(`team login failed: ${login.status}`);
  const cookie = login.headers.get("set-cookie").split(";")[0];

  const resp = await fetch(`${baseUrl}/api/team/patients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      name,
      memberCode,
      inviteCode,
      prescription: "Receita dev permanente",
      prescriptionExpiresAt: "2027-12-31",
      carePlan: "acompanhamento dev",
      privateNotes: "conta de acesso rapido para o operador humano",
    }),
  });
  const body = await resp.text();
  if (!resp.ok) throw new Error(`create failed ${resp.status}: ${body}`);
  console.log(`CREATED: patient ${memberCode}/${inviteCode}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
