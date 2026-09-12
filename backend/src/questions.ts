import { Op } from "sequelize";
import { z } from "zod";
import { db, Question, QuestionContent } from "./db";
import { requireThat } from "./domain";

export const questionSchema = z
  .object({
    statement: z.string().trim().min(5).max(2000),
    leftOption: z.string().trim().min(1).max(120),
    rightOption: z.string().trim().min(1).max(120),
    correctOption: z.enum(["LEFT", "RIGHT"]),
    explanation: z.string().trim().min(5).max(4000),
    category: z.string().trim().min(1).max(120),
    difficulty: z.string().trim().max(120).default(""),
  })
  .strict()
  .refine(
    (q) =>
      q.leftOption.toLocaleLowerCase() !== q.rightOption.toLocaleLowerCase(),
    { message: "Las opciones deben ser diferentes", path: ["rightOption"] },
  );
export const questionUpdateSchema = z
  .object({ version: z.number().int().nonnegative(), question: questionSchema })
  .strict();
export const questionVersionSchema = z
  .object({ version: z.number().int().nonnegative() })
  .strict();
export const questionActivationSchema = z
  .object({
    version: z.number().int().nonnegative(),
    isActive: z.boolean(),
  })
  .strict();
export const questionQuerySchema = z
  .object({
    search: z.string().trim().max(120).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();

export function questionContent(q: QuestionContent): QuestionContent {
  return {
    statement: q.statement,
    leftOption: q.leftOption,
    rightOption: q.rightOption,
    correctOption: q.correctOption,
    explanation: q.explanation,
    category: q.category,
    difficulty: q.difficulty,
  };
}
export async function listQuestions(search: string, page: number) {
  const where = {
    deletedAt: null,
    ...(search
      ? {
          [Op.or]: [
            { statement: { [Op.like]: `%${search}%` } },
            { category: { [Op.like]: `%${search}%` } },
          ],
        }
      : {}),
  };
  const result = await Question.findAndCountAll({
    where,
    order: [["id", "DESC"]],
    limit: 12,
    offset: (page - 1) * 12,
  });
  const activeTotal = await Question.count({
    where: { deletedAt: null, isActive: true },
  });
  return {
    items: result.rows,
    total: result.count,
    activeTotal,
    page,
    pageSize: 12,
  };
}
export async function getQuestion(id: number) {
  const q = await Question.findOne({ where: { id, deletedAt: null } });
  requireThat(q, "question_not_found", 404);
  return q;
}
export async function createQuestion(data: QuestionContent) {
  return Question.create(questionContent(data));
}
export async function updateQuestion(
  id: number,
  version: number,
  data: QuestionContent,
) {
  return db.transaction(async (transaction) => {
    const q = await Question.findOne({
      where: { id, deletedAt: null },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    requireThat(q, "question_not_found", 404);
    requireThat(q.version === version, "question_conflict", 409);
    return q.update(
      { ...questionContent(data), version: version + 1 },
      { transaction },
    );
  });
}
export async function deleteQuestion(id: number, version: number) {
  return db.transaction(async (transaction) => {
    const q = await Question.findOne({
      where: { id, deletedAt: null },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    requireThat(q, "question_not_found", 404);
    requireThat(q.version === version, "question_conflict", 409);
    await q.update(
      { deletedAt: new Date(), version: version + 1 },
      { transaction },
    );
  });
}
export async function setQuestionActive(
  id: number,
  version: number,
  isActive: boolean,
) {
  return db.transaction(async (transaction) => {
    const q = await Question.findOne({
      where: { id, deletedAt: null },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    requireThat(q, "question_not_found", 404);
    requireThat(q.version === version, "question_conflict", 409);
    return q.update({ isActive, version: version + 1 }, { transaction });
  });
}
