// POST /api/team/product-meta — update product metadata.

import { teamWrite } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.updateProductMeta(sessionId, payload),
  { wrap: (product) => ({ product }) },
);
