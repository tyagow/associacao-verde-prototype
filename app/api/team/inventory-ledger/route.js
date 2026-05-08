// GET /api/team/inventory-ledger — inventory lots view for the equipe.

import { teamRead } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const GET = teamRead((system, sessionId) => system.listProductLots(sessionId));
