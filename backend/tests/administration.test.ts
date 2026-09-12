import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { Teacher } from "../src/db";
import { authenticate } from "../src/app";
import {
  requireActiveAccount,
  requireAdministrator,
} from "../src/administration";

test("las cuentas nuevas requieren activación y nunca son administradoras", () => {
  const account = Teacher.build({ name: "Prueba" });
  assert.equal(account.role, "teacher");
  assert.equal(account.isActive, false);
  assert.throws(() => requireActiveAccount(account), {
    message: "account_disabled",
  });
  account.isActive = true;
  assert.equal(requireActiveAccount(account), account);
  account.deletedAt = new Date();
  assert.throws(() => requireActiveAccount(account), {
    message: "unauthorized",
  });
});
test("el servidor consulta rol, activación y versión de sesión actuales", async (t) => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "administration-test-secret-at-least-32-characters";
  const account = Teacher.build({
    id: 1,
    role: "teacher",
    isActive: true,
    sessionVersion: 0,
  });
  t.mock.method(Teacher, "findByPk", async () => account);
  try {
    await assert.rejects(requireAdministrator(1), { message: "forbidden" });
    account.role = "admin";
    assert.equal(await requireAdministrator(1), account);
    const token = jwt.sign(
      { kind: "teacher", sessionVersion: 0 },
      process.env.JWT_SECRET,
      { subject: "1", expiresIn: 60 },
    );
    assert.deepEqual(await authenticate(token, "teacher"), {
      kind: "teacher",
      id: 1,
    });
    account.isActive = false;
    await assert.rejects(authenticate(token, "teacher"), {
      message: "account_disabled",
    });
    account.isActive = true;
    account.sessionVersion = 1;
    await assert.rejects(authenticate(token, "teacher"), {
      message: "unauthorized",
    });
    account.deletedAt = new Date();
    await assert.rejects(requireAdministrator(1), { message: "unauthorized" });
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});
