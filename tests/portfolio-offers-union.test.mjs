import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20260803223000_create_portfolio_commercial_domain.sql", import.meta.url),
  "utf8",
);
const statement = sql.split("INSERT INTO public.portfolio_offers (")[1]?.split(";")[0];

test("portfolio offers seed has six typed UNION branches", () => {
  assert.ok(statement, "portfolio offers seed statement missing");
  assert.equal(statement.split("UNION ALL").length, 6);
  assert.match(statement, /'R\$ 197',NULL::numeric\(5,2\)/);
  assert.match(statement, /'Até 20% da economia comprovada',20::numeric\(5,2\)/);
});
