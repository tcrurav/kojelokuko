import { test } from "node:test";
import assert from "node:assert/strict";
import { db, Question, Game, GameQuestion } from "../src/db";
import { createGame } from "../src/services";

test("crear partida filtra dificultad antes del sorteo y conserva su contenido", async (t) => {
  const transaction = {};
  t.mock.method(
    db,
    "transaction",
    async (run: (tx: object) => Promise<unknown>) => run(transaction),
  );
  const questions = [1, 2, 3].map((id) =>
    Question.build({
      id,
      statement: `Pregunta fácil ${id}`,
      leftOption: "Sí",
      rightOption: "No",
      correctOption: "LEFT",
      explanation: "Explicación sencilla",
      category: "Listas",
      difficulty: "Baja",
    }),
  );
  t.mock.method(
    Question,
    "findAll",
    async (options: { where: object; transaction: object }) => {
      assert.deepEqual(options.where, {
        deletedAt: null,
        isActive: true,
        difficulty: "Baja",
      });
      assert.equal(options.transaction, transaction);
      return [...questions];
    },
  );
  t.mock.method(Game, "create", async () => Game.build({ id: 42 }));
  const insert = t.mock.method(
    GameQuestion,
    "bulkCreate",
    async (
      rows: { questionId: number; questionSnapshot: { difficulty: string } }[],
    ) => {
      assert.equal(rows.length, 2);
      assert.equal(new Set(rows.map((row) => row.questionId)).size, 2);
      assert.ok(
        rows.every((row) => row.questionSnapshot.difficulty === "Baja"),
      );
    },
  );
  await createGame(1, 2, 20, "Baja");
  assert.equal(insert.mock.callCount(), 1);
});

test("sin suficientes preguntas del nivel no se crea ninguna partida", async (t) => {
  t.mock.method(
    db,
    "transaction",
    async (run: (tx: object) => Promise<unknown>) => run({}),
  );
  t.mock.method(Question, "findAll", async () => []);
  const create = t.mock.method(Game, "create", async () => {
    throw new Error("No debe crear");
  });
  await assert.rejects(createGame(1, 1, 20, "Alta"), {
    message: "insufficient_questions",
  });
  assert.equal(create.mock.callCount(), 0);
});

test("todas las dificultades y sin especificar son selecciones diferentes", async (t) => {
  t.mock.method(
    db,
    "transaction",
    async (run: (tx: object) => Promise<unknown>) => run({}),
  );
  const filters: object[] = [];
  t.mock.method(Question, "findAll", async (options: { where: object }) => {
    filters.push(options.where);
    return [];
  });
  await assert.rejects(createGame(1, 1, 20), {
    message: "insufficient_questions",
  });
  await assert.rejects(createGame(1, 1, 20, ""), {
    message: "insufficient_questions",
  });
  assert.deepEqual(filters, [
    { deletedAt: null, isActive: true },
    { deletedAt: null, isActive: true, difficulty: "" },
  ]);
});
