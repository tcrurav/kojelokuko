import { test } from "node:test";
import assert from "node:assert/strict";
import { ignoresEnter } from "../src/api";
test("ENTER ignora repetición, otros teclados y campos interactivos", () => {
  assert.equal(ignoresEnter({ key: "Enter", repeat: false }, null), false);
  assert.equal(ignoresEnter({ key: "Enter", repeat: true }, null), true);
  assert.equal(ignoresEnter({ key: "a", repeat: false }, null), true);
  const field = { closest: () => ({}) } as unknown as Element;
  assert.equal(ignoresEnter({ key: "Enter", repeat: false }, field), true);
});
