import { test } from "node:test";
import assert from "node:assert/strict";
import {
  score,
  gameCode,
  roles,
  transition,
  states,
  comment,
} from "../src/domain";
test("el acierto domina la velocidad y el bonus está acotado", () => {
  assert.equal(score(false, 20000, 20000), 0);
  assert.equal(score(true, 20000, 20000), 1500);
  assert.equal(score(true, 0, 20000), 1000);
  assert.equal(score(true, -1, 20000), 1000);
  assert.equal(score(true, 30000, 20000), 1500);
  assert.equal(score(true, 10000, 20000), 1250);
});
test("códigos legibles y variados", () => {
  const codes = new Set(Array.from({ length: 2000 }, gameCode));
  assert.ok(codes.size > 1990);
  for (const c of codes)
    assert.match(c, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
});
test("orientación física y rechazo de autopareja", () => {
  assert.deepEqual(roles(1, 2, "LEFT"), { leftPlayerId: 2, rightPlayerId: 1 });
  assert.deepEqual(roles(1, 2, "RIGHT"), { leftPlayerId: 1, rightPlayerId: 2 });
  assert.throws(() => roles(1, 1, "LEFT"));
});
test("máquina de estados: se valida toda combinación", () => {
  const edges = new Set([
    "LOBBY:READY",
    "READY:QUESTION_ACTIVE",
    "QUESTION_ACTIVE:QUESTION_FINISHED",
    "QUESTION_FINISHED:SHOWING_RANKING",
    "QUESTION_FINISHED:QUESTION_ACTIVE",
    "QUESTION_FINISHED:FINISHED",
    "SHOWING_RANKING:QUESTION_ACTIVE",
    "SHOWING_RANKING:FINISHED",
  ]);
  for (const a of states)
    for (const b of states) {
      if (edges.has(a + ":" + b)) assert.doesNotThrow(() => transition(a, b));
      else assert.throws(() => transition(a, b));
    }
});
test("comentarios locales responden a estadísticas", () => {
  assert.notEqual(comment(0, 0, 0), comment(0, 2, 0));
  assert.notEqual(comment(1, 1, 1000), comment(1, 1, 10000));
  assert.match(comment(3, 3, 10000, 3), /racha/);
  assert.match(comment(2, 3, 10000, 2, true), /remontada/);
  assert.match(comment(0, 3, 0), /debugger/);
});
test("seeder contiene exactamente 20 escenarios completos", async () => {
  const seed = await import("../seeders/202609110001-questions.cjs" as string);
  let rows: Record<string, unknown>[] = [];
  await seed.default.up({
    bulkInsert: async (_table: string, data: Record<string, unknown>[]) => {
      rows = data;
    },
  });
  assert.equal(rows.length, 20);
  assert.equal(new Set(rows.map((r) => r.category)).size, 20);
  for (const r of rows) {
    assert.ok(["LEFT", "RIGHT"].includes(String(r.correctOption)));
    for (const key of ["statement", "leftOption", "rightOption", "explanation"])
      assert.ok(String(r[key]).length > 10);
    assert.ok(String(r.leftOption).length <= 120);
    assert.ok(String(r.rightOption).length <= 120);
  }
});
