import { test } from "node:test";
import assert from "node:assert/strict";
import {
  db,
  Game,
  Player,
  Team,
  PairRequest,
  TeamAnswer,
  GameQuestion,
} from "../src/db";
import { snapshot } from "../src/services";

test("la vista por jugador oculta la opción ajena incluso al cerrar y reconectar", async (t) => {
  const game = Game.build({
    id: 1,
    teacherId: 99,
    status: "QUESTION_ACTIVE",
    currentQuestionIndex: 1,
    showPartnerOption: false,
  });
  const question = {
    statement: "Pregunta",
    leftOption: "Texto blanco privado",
    rightOption: "Texto negro privado",
    correctOption: "LEFT" as const,
    explanation: "Explicación",
    category: "Prueba",
    difficulty: "Baja",
  };
  type Run = (tx: object) => Promise<unknown>;
  t.mock.method(
    db,
    "transaction",
    async (optionsOrRun: object | Run, run?: Run) =>
      (typeof optionsOrRun === "function" ? optionsOrRun : run!)({ LOCK: { UPDATE: "UPDATE" } }),
  );
  t.mock.method(Game, "findByPk", async () => game);
  t.mock.method(Player, "findOne", async () =>
    Player.build({ id: 10, gameId: 1 }),
  );
  t.mock.method(Player, "findAll", async () => []);
  t.mock.method(Team, "findAll", async () => [
    Team.build({ id: 5, leftPlayerId: 10, rightPlayerId: 11 }),
  ]);
  t.mock.method(PairRequest, "findAll", async () => []);
  t.mock.method(TeamAnswer, "findAll", async () => []);
  t.mock.method(GameQuestion, "findOne", async () =>
    GameQuestion.build({ id: 3, questionSnapshot: question }),
  );

  for (const id of [10, 11, 12, 10]) {
    const state = await snapshot({ kind: "player", id }, 1);
    assert.equal(state.game.showPartnerOption, false);
    assert.equal(
      state.question?.leftOption,
      id === 10 ? question.leftOption : null,
    );
    assert.equal(
      state.question?.rightOption,
      id === 11 ? question.rightOption : null,
    );
    assert.equal(state.question?.correctOption, undefined);
    assert.equal(state.question?.explanation, undefined);
  }
  const teacher = await snapshot({ kind: "teacher", id: 99 }, 1);
  assert.equal(teacher.question?.leftOption, question.leftOption);
  assert.equal(teacher.question?.rightOption, question.rightOption);
  game.showPartnerOption = true;
  const visible = await snapshot({ kind: "player", id: 10 }, 1);
  assert.equal(visible.question?.rightOption, question.rightOption);
  game.showPartnerOption = false;
  for (const status of [
    "QUESTION_FINISHED",
    "SHOWING_RANKING",
    "FINISHED",
  ] as const) {
    game.status = status;
    const revealed = await snapshot({ kind: "player", id: 10 }, 1);
    assert.equal(revealed.question?.leftOption, question.leftOption);
    assert.equal(revealed.question?.rightOption, null);
    assert.equal(revealed.question?.correctOption, "LEFT");
  }
});

test("las partidas mantienen ambas opciones visibles por defecto", () => {
  assert.equal(Game.build().showPartnerOption, true);
});

