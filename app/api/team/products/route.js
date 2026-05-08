// POST /api/team/products — team creates a product.

import { teamWrite } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.createProduct(sessionId, payload),
  { status: 201, wrap: (product) => ({ product }) },
);
