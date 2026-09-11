import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { authenticate } from "../src/app";
test("un JWT expirado o manipulado se rechaza antes de consultar identidad", async () => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-secret-with-more-than-32-characters";
  try {
    const expired = jwt.sign({ kind: "teacher" }, process.env.JWT_SECRET, {
      subject: "1",
      expiresIn: -1,
    });
    await assert.rejects(authenticate(expired, "teacher"), {
      message: "unauthorized",
    });
    const forged = jwt.sign({ kind: "teacher" }, "different-test-secret", {
      subject: "1",
      expiresIn: 60,
    });
    await assert.rejects(authenticate(forged, "teacher"), {
      message: "unauthorized",
    });
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});
