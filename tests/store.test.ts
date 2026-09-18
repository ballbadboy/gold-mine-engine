import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readState, transact } from "../src/lib/marketing/store";
import { applyCommand } from "../src/lib/marketing/domain";
import { reserveAI } from "../src/lib/support/domain";

test("file transactions persist concurrently without losing records; failures do not commit", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gold-mine-test-"));
  process.env.MARKETING_STORE = "file";
  process.env.MARKETING_DATA_DIR = dir;
  try {
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        transact((state) =>
          applyCommand(state, {
            type: "partner.create",
            input: { name: `Partner ${index}`, currency: "USD", cpaMinor: 100 },
          }),
        ),
      ),
    );
    assert.equal((await readState()).partners.length, 12);
    await assert.rejects(
      transact((state) => {
        state.partners.length = 0;
        throw new Error("abort");
      }),
    );
    assert.equal((await readState()).partners.length, 12);
    const persisted = await readFile(path.join(dir, "marketing.json"), "utf8");
    assert.equal(JSON.parse(persisted).partners.length, 12);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});
test("corrupt persisted state fails without resetting or overwriting it", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gold-mine-corrupt-"));
  process.env.MARKETING_STORE = "file";
  process.env.MARKETING_DATA_DIR = dir;
  try {
    const file = path.join(dir, "marketing.json");
    await writeFile(file, "not valid json");
    await assert.rejects(readState());
    await assert.rejects(transact(() => true));
    assert.equal(await readFile(file, "utf8"), "not valid json");
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});
test("production refuses the file adapter", async () => {
  const prior = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "production" });
  process.env.MARKETING_STORE = "file";
  try {
    await assert.rejects(readState(), /Production/);
  } finally {
    if (prior === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: prior });
  }
});
test("concurrent support requests cannot exceed a shared persisted AI call budget", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gold-mine-ai-budget-"));
  process.env.MARKETING_STORE = "file";
  process.env.MARKETING_DATA_DIR = dir;
  const now = new Date("2026-09-18T12:00:00Z");
  try {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        transact((state) => reserveAI(state.support, 3, now)),
      ),
    );
    assert.equal(results.filter(Boolean).length, 3);
    assert.equal((await readState()).support.usage[0].aiCalls, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
