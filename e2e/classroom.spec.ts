import { test, expect } from "@playwright/test";
test("profesor y dos alumnos completan una ronda con teclado y botón móvil", async ({
  browser,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Soy profesor" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/home.png", fullPage: true });
  await page.getByRole("link", { name: /Soy profesor/ }).click();
  await page.getByRole("link", { name: /Crear una cuenta/ }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Docente de prueba");
  await page.getByLabel("Email").fill(`browser-${Date.now()}@example.test`);
  await page.getByLabel("Contraseña").fill("Browser-test-12345");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByRole("combobox", { name: /^Preguntas/ }).selectOption("2");
  await page.getByLabel("Segundos por pregunta").selectOption("30");
  await page.getByRole("button", { name: "Crear partida" }).click();
  const code = await page.locator(".game-code").innerText();
  await page.goto(page.url() + "?polling");
  await expect(page.getByRole("status")).toContainText("polling");
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  try {
    for (const [client, name] of [
      [a, "Ada"],
      [b, "Beto"],
    ] as const) {
      client.on("pageerror", (e) => errors.push(e.message));
      await client.goto(new URL("/join", page.url()).href);
      await client.getByLabel("Código de 6 caracteres").fill(code);
      await client.getByRole("button", { name: "Comprobar código" }).click();
      await client.getByLabel("Tu nombre").fill(name);
      await client.getByRole("button", { name: "¡Dentro!" }).click();
      await expect(
        client.getByRole("heading", {
          name: "Busca a la persona sentada a tu lado",
        }),
      ).toBeVisible();
    }
    await a.getByRole("button", { name: "Está a mi derecha" }).click();
    await expect(b.getByText(/Tú serás/)).toContainText("NEGRO / DERECHA");
    await b.getByRole("button", { name: "Aceptar pareja" }).click();
    await a.getByLabel("Nombre del equipo").fill("Equipo Navegador");
    await a.getByRole("button", { name: "Guardar nombre" }).click();
    await expect(
      b.getByRole("heading", { name: /Equipo preparado! Equipo Navegador/ }),
    ).toBeVisible();
    await b.screenshot({
      path: "test-results/mobile-lobby.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Iniciar competición" }).click();
    await page
      .getByRole("button", { name: "Empezar primera pregunta" })
      .click();
    await expect(
      a.getByRole("button", { name: "RESPONDER COMO BLANCO" }),
    ).toBeEnabled();
    await expect(
      b.getByRole("button", { name: "RESPONDER COMO NEGRO" }),
    ).toBeEnabled();
    await b.screenshot({
      path: "test-results/mobile-question.png",
      fullPage: true,
    });
    await a.locator("body").click({ position: { x: 5, y: 5 } });
    await a.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "La solución" }),
    ).toBeVisible();
    await expect(a.locator(".feedback")).toBeVisible();
    await b.reload();
    await expect(b.locator(".role")).toContainText("NEGRO / DERECHA");
    await expect(b.locator(".feedback")).toContainText("Respondió");
    await page
      .getByRole("button", { name: "Clasificación por equipos" })
      .click();
    await page.getByRole("button", { name: "Siguiente pregunta" }).click();
    await b.getByRole("button", { name: "RESPONDER COMO NEGRO" }).click();
    await expect(b.locator(".feedback")).toContainText("Beto");
    await page
      .getByRole("button", { name: "Clasificación por equipos" })
      .click();
    await page.getByRole("button", { name: "Mostrar podio final" }).click();
    await expect(
      page.getByRole("heading", { name: "¡Un aplauso para el aula!" }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/final.png", fullPage: true });
    await page
      .getByRole("button", { name: "Clasificación individual" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Contribución individual" }),
    ).toBeVisible();
    assertNoErrors();
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
  function assertNoErrors() {
    expect(errors).toEqual([]);
  }
});
