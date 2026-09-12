import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, Teacher, Player, Team, TeamAnswer, Question } from "../src/db";
test("las preguntas nuevas y del seeder se activan por defecto", () => {
  assert.equal(Question.build().isActive, true);
});
test("las partidas ocultan el ranking inicialmente", () => {
  assert.equal(Game.getAttributes().rankingView.defaultValue, "hidden");
});
test("cada atributo Sequelize mantiene su propia columna y no muta definiciones compartidas", () => {
  for (const model of [Game, Teacher, Player, Team, TeamAnswer])
    for (const [name, attribute] of Object.entries(model.getAttributes()))
      assert.equal(attribute.field, name, model.name + "." + name);
});
