import test from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "node:util";
import { readFile } from "node:fs/promises";
import {
  assertNoOwnerCredentials,
  renderOwnerEnv,
} from "../scripts/owner-env.mjs";

test("owner setup replaces blank template entries without overwriting other configuration", async () => {
  const source = await readFile(".env.example", "utf8");
  const values = {
    ADMIN_PASSWORD_HASH: "scrypt:test-hash",
    ADMIN_SESSION_SECRET: "test-only-secret",
  };
  const result = renderOwnerEnv(source, values);
  assert.equal(
    parseEnv(result).ADMIN_PASSWORD_HASH,
    values.ADMIN_PASSWORD_HASH,
  );
  assert.equal(parseEnv(result).APP_ORIGIN, "http://localhost:3000");
  assert.equal(result.match(/^ADMIN_PASSWORD_HASH=/gm)?.length, 1);
  assert.throws(() => assertNoOwnerCredentials(result), /already exist/);
  assert.throws(
    () => renderOwnerEnv('export ADMIN_SESSION_SECRET="present"', values),
    /already exist/,
  );
});
