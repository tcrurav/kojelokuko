import { test, expect } from "@playwright/test";
import "../backend/tests/admin-session";

test.use({ trace: "off" });
test("administrador activa, desactiva y borra profesores desde el panel", async ({
  page,
  request,
}) => {
  const email = `admin-browser-${Date.now()}@example.test`;
  const teacherCard = page.locator("article").filter({ has: page.getByText(email, { exact: true }) });
  const registration = await request.post("/api/auth/register", {
    data: { email, name: "Profesor panel", password: "Panel-test-12345" },
  });
  expect(registration.status()).toBe(201);
  await page.goto("/teacher/login");
  await page.getByLabel("Email").fill(process.env.ADMIN_EMAIL!);
  await page.getByLabel("Contraseña").fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByLabel("Buscar por nombre o email").fill(email);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    teacherCard.getByText("Desactivado / pendiente", { exact: true }),
  ).toBeVisible();
  await teacherCard
    .getByRole("button", { name: "Activar a Profesor panel", exact: true })
    .click();
  await expect(teacherCard.getByText("Activo", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel("Buscar por nombre o email").fill(email);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(teacherCard.getByText("Activo", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/administration.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/administration-mobile.png", fullPage: true });
  await teacherCard
    .getByRole("button", { name: "Desactivar a Profesor panel", exact: true })
    .click();
  await expect(
    teacherCard.getByText("Desactivado / pendiente", { exact: true }),
  ).toBeVisible();
  await teacherCard
    .getByRole("button", { name: "Borrar a Profesor panel", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Esta acción no se puede deshacer",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirmar borrado", exact: true }),
  ).toHaveCount(0);
  await teacherCard
    .getByRole("button", { name: "Borrar a Profesor panel", exact: true })
    .click();
  await teacherCard
    .getByRole("button", { name: "Confirmar borrado", exact: true })
    .click();
  await expect(
    page.getByText("No hay profesores para esta búsqueda."),
  ).toBeVisible();
});
