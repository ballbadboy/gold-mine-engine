import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyState } from "../src/lib/marketing/model";

// Executes the actual migration in Postgres/WASM, independently of Supabase hosting.
test("migration enforces owner-only access and rejects stale revisions atomically", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;",
    );
    for (const table of [
      "tenants",
      "websites",
      "products",
      "content_pages",
      "metrics_daily",
      "insights",
      "actions",
      "knowledge_chunks",
    ]) {
      await db.exec(
        `create table public.${table} (id text); alter table public.${table} enable row level security; create policy allow_all_authenticated on public.${table} for all to authenticated using (true) with check (true);`,
      );
    }
    const migration = await readFile(
      "supabase/migrations/202609180001_marketing_workspace.sql",
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration); // Applying again must not reset data or duplicate grants.
    const policies = await db.query<{ count: number }>(
      "select count(*)::int from pg_policies where policyname='allow_all_authenticated'",
    );
    assert.equal(policies.rows[0].count, 0);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select state from public.marketing_workspaces"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select public.marketing_compare_and_swap($1,$2,$3)", [
          "owner",
          0,
          emptyState(),
        ]),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    const write = (revision: number, state = emptyState()) =>
      db.query<{ saved: boolean }>(
        "select public.marketing_compare_and_swap($1,$2,$3) as saved",
        ["owner", revision, state],
      );
    assert.equal((await write(0)).rows[0].saved, true);
    const state = emptyState();
    state.audit.push({
      id: "6d0e6634-bd2e-4e6c-9b53-32dfca20181e",
      action: "test",
      targetId: "owner",
      actor: "owner",
      createdAt: new Date().toISOString(),
    });
    const results = await Promise.all([write(1, state), write(1)]);
    assert.deepEqual(
      results.map((result) => result.rows[0].saved),
      [true, false],
    );
    const saved = await db.query<{ revision: number; state: typeof state }>(
      "select revision::int, state from public.marketing_workspaces where id=$1",
      ["owner"],
    );
    assert.equal(saved.rows[0].revision, 2);
    assert.equal(saved.rows[0].state.audit.length, 1);
    await assert.rejects(
      db.query("delete from public.marketing_workspaces"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
