// POST /api/team/shipments — upsert a shipment record.

import { teamWrite } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite((system, sessionId, payload) =>
  system.upsertShipment(sessionId, payload),
);
