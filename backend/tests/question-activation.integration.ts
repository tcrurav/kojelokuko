import { test } from "node:test";
import assert from "node:assert/strict";
import { adminToken } from "./admin-session";
import type {
  BankQuestion,
  QuestionList,
} from "../../frontend/src/question-types";

const base = process.env.TEST_URL || "http://localhost";
test("activación de preguntas: persistencia, contador, permisos y conflictos", async () => {
  const token = await adminToken(base);
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  };
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    authenticated = true,
  ) {
    return fetch(base + "/api" + path, {
      method,
      headers: authenticated ? headers : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  const before = (await (await request("/questions")).json()) as QuestionList;
  const content = {
    statement: "Pregunta de activación de prueba",
    leftOption: "Una opción",
    rightOption: "Otra opción",
    correctOption: "LEFT",
    explanation: "Explicación de prueba",
    category: "Activación",
    difficulty: "",
  };
  const created = await request("/questions", "POST", content);
  assert.equal(created.status, 201);
  let question = (await created.json()) as BankQuestion;
  assert.equal(question.isActive, true);
  try {
    assert.equal(
      (
        await request(
          `/questions/${question.id}/activation`,
          "PUT",
          { version: question.version, isActive: false },
          false,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await request(`/questions/${question.id}/activation`, "PUT", {
          version: question.version,
          isActive: "false",
        })
      ).status,
      400,
    );
    const disabled = await request(
      `/questions/${question.id}/activation`,
      "PUT",
      { version: question.version, isActive: false },
    );
    assert.equal(disabled.status, 200);
    const oldVersion = question.version;
    question = (await disabled.json()) as BankQuestion;
    assert.equal(question.isActive, false);
    assert.equal(question.version, oldVersion + 1);
    assert.equal(
      (
        await request(`/questions/${question.id}/activation`, "PUT", {
          version: oldVersion,
          isActive: true,
        })
      ).status,
      409,
    );
    const persisted = (await (
      await request(`/questions/${question.id}`)
    ).json()) as BankQuestion;
    assert.equal(persisted.isActive, false);
    const listing = (await (
      await request("/questions")
    ).json()) as QuestionList;
    assert.equal(listing.activeTotal, before.activeTotal);
    assert.equal(listing.total, before.total + 1);
    const edited = await request(`/questions/${question.id}`, "PUT", {
      version: question.version,
      question: content,
    });
    assert.equal(edited.status, 200);
    question = (await edited.json()) as BankQuestion;
    assert.equal(question.isActive, false);
    const enabled = await request(
      `/questions/${question.id}/activation`,
      "PUT",
      { version: question.version, isActive: true },
    );
    assert.equal(enabled.status, 200);
    question = (await enabled.json()) as BankQuestion;
    assert.equal(question.isActive, true);
    assert.equal(
      ((await (await request("/questions")).json()) as QuestionList)
        .activeTotal,
      before.activeTotal + 1,
    );
  } finally {
    await request(`/questions/${question.id}`, "DELETE", {
      version: question.version,
    });
  }
  assert.equal(
    (
      await request(`/questions/${question.id}/activation`, "PUT", {
        version: question.version + 1,
        isActive: true,
      })
    ).status,
    404,
  );
});
