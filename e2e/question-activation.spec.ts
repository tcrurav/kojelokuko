import { test, expect } from "@playwright/test";
import {
  activateTestTeacher,
  adminToken,
} from "../backend/tests/admin-session";
import type { BankQuestion } from "../frontend/src/question-types";

test("un profesor desactiva y reactiva una pregunta compartida", async ({
  page,
  request,
  baseURL,
}) => {
  const base = baseURL!;
  const email = `question-browser-${Date.now()}@example.test`;
  const password = "Question-test-12345";
  expect(
    (
      await request.post("/api/auth/register", {
        data: { email, password, name: "Profesor preguntas" },
      })
    ).status(),
  ).toBe(201);
  await activateTestTeacher(base, email);
  const token = await adminToken(base);
  const headers = { Authorization: "Bearer " + token };
  const response = await request.post("/api/questions", {
    headers,
    data: {
      statement: `Pregunta de interruptor ${Date.now()}`,
      leftOption: "Primera opción",
      rightOption: "Segunda opción",
      correctOption: "LEFT",
      explanation: "Explicación de prueba",
      category: "Prueba de interfaz",
      difficulty: "",
    },
  });
  expect(response.status()).toBe(201);
  const q = (await response.json()) as BankQuestion;
  try {
    await page.goto("/teacher/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("link", { name: /Gestionar preguntas/ }).click();
    await page.getByLabel("Buscar por enunciado o categoría").fill(q.statement);
    const toggle = page.getByRole("switch", {
      name: `Pregunta activa: ${q.statement}`,
      exact: true,
    });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(page.getByRole("status")).toContainText(
      "Pregunta desactivada",
    );
    await page.reload();
    await page.getByLabel("Buscar por enunciado o categoría").fill(q.statement);
    await expect(toggle).not.toBeChecked();
    await expect(page.locator(".bank-question")).toHaveCount(1);
    await page.screenshot({
      path: "test-results/question-activation.png",
      fullPage: true,
    });
    await toggle.click();
    await expect(toggle).toBeChecked();
  } finally {
    const current = (await (
      await request.get(`/api/questions/${q.id}`, { headers })
    ).json()) as BankQuestion;
    await request.delete(`/api/questions/${q.id}`, {
      headers,
      data: { version: current.version },
    });
  }
});
