import { test } from "node:test";
import assert from "node:assert/strict";
import { administratorConfiguration } from "../src/administration";

test("configuración administrativa identifica campos inválidos sin revelar valores", () => {
  assert.equal(administratorConfiguration({}), null);
  const password = "private-short";
  assert.throws(
    () =>
      administratorConfiguration({
        ADMIN_EMAIL: "admin@example.test",
        ADMIN_PASSWORD: password,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /ADMIN_PASSWORD/);
      assert.doesNotMatch(error.message, /private-short/);
      assert.doesNotMatch(error.message, /admin@example.test/);
      return true;
    },
  );
  assert.throws(
    () => administratorConfiguration({ ADMIN_EMAIL: "admin@example.test" }),
    /ADMIN_PASSWORD/,
  );
  assert.throws(
    () =>
      administratorConfiguration({
        ADMIN_EMAIL: "invalid",
        ADMIN_PASSWORD: "a".repeat(32),
      }),
    /ADMIN_EMAIL/,
  );
  assert.throws(
    () =>
      administratorConfiguration({
        ADMIN_EMAIL: "admin@example.test",
        ADMIN_PASSWORD: "ñ".repeat(40),
      }),
    /72 bytes/,
  );
  const valid = administratorConfiguration({
    ADMIN_EMAIL: " Admin@Example.test ",
    ADMIN_PASSWORD: "a".repeat(32),
  });
  assert.equal(valid?.email, "admin@example.test");
});
