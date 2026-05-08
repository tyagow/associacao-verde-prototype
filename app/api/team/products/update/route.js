// POST /api/team/products/update — team updates a product.

import { teamWrite } from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.updateProduct(sessionId, payload),
  { wrap: (product) => ({ product }) },
);
