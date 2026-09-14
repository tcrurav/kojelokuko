import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionOptions } from "../src/components/QuestionOptions";

test("solo se dibujan las tarjetas de las opciones visibles", () => {
  for (const [leftOption, rightOption, count] of [
    ["Respuesta blanca", null, 1],
    [null, "Respuesta negra", 1],
    ["Respuesta blanca", "Respuesta negra", 2],
    [null, null, 0],
  ] as const) {
    const html = renderToStaticMarkup(createElement(QuestionOptions, { leftOption, rightOption }));
    assert.equal((html.match(/<article/g) ?? []).length, count);
    assert.equal(html.includes("BLANCO"), leftOption !== null);
    assert.equal(html.includes("NEGRO"), rightOption !== null);
    assert.ok(!html.includes("Opción oculta"));
  }
});
