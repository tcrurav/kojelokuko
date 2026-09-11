import { createHash, randomBytes, randomInt } from "node:crypto";
import { EventEmitter } from "node:events";
import { questionContent } from "./questions";
import { Op, Transaction, UniqueConstraintError } from "sequelize";
import {
  db,
  Game,
  Player,
  Team,
  TeamMember,
  Question,
  GameQuestion,
  TeamAnswer,
  PairRequest,
  Entity,
} from "./db";
import {
  requireThat,
  gameCode,
  roles,
  score,
  transition,
  comment,
  AppError,
  Side,
} from "./domain";
export type Identity = { kind: "teacher" | "player"; id: number };
export const gameEvents = new EventEmitter();
export const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function authorize(
  identity: Identity,
  game: Entity,
  transaction?: Transaction,
) {
  if (identity.kind === "teacher")
    requireThat(game.teacherId === identity.id, "forbidden", 403);
  else
    requireThat(
      await Player.findOne({
        where: { id: identity.id, gameId: game.id },
        transaction,
      }),
      "forbidden",
      403,
    );
}
export async function createGame(
  teacherId: number,
  count: number,
  duration: number,
) {
  for (let attempt = 0; attempt < 8; attempt++)
    try {
      return await db.transaction(async (transaction) => {
        const questions = await Question.findAll({
          where: { deletedAt: null },
          transaction,
        });
        requireThat(questions.length >= count, "insufficient_questions", 409);
        for (let i = questions.length - 1; i > 0; i--) {
          const j = randomInt(i + 1);
          [questions[i], questions[j]] = [questions[j], questions[i]];
        }
        const game = await Game.create(
          {
            teacherId,
            code: gameCode(),
            questionCount: count,
            questionDurationSeconds: duration,
          },
          { transaction },
        );
        await GameQuestion.bulkCreate(
          questions.slice(0, count).map((q, i) => ({
            gameId: game.id,
            questionId: q.id,
            position: i + 1,
            questionSnapshot: questionContent(q),
          })),
          { transaction },
        );
        return game;
      });
    } catch (e) {
      if (!(e instanceof UniqueConstraintError)) throw e;
    }
  throw new AppError("code_exhausted", 503);
}
export async function join(code: string, name: string, avatar: string) {
  return db.transaction(async (transaction) => {
    const game = await Game.findOne({
      where: { code },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    requireThat(game, "game_not_found", 404);
    requireThat(game.status === "LOBBY", "game_closed");
    const token = randomBytes(32).toString("hex");
    const player = await Player.create(
      { gameId: game.id, name, avatar, sessionTokenHash: hash(token) },
      { transaction },
    );
    return { token, gameId: game.id, playerId: player.id, code: game.code };
  });
}
export async function expire(gameId: number) {
  const changed = await db.transaction(async (transaction) => {
    const game = await Game.findByPk(gameId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (
      game?.status === "QUESTION_ACTIVE" &&
      game.questionExpiresAt &&
      Date.now() >= game.questionExpiresAt.getTime()
    ) {
      await game.update({ status: "QUESTION_FINISHED" }, { transaction });
      return true;
    }
    return false;
  });
  if (changed) gameEvents.emit("expired", gameId);
  return changed;
}
export async function command(
  identity: Identity,
  gameId: number,
  event: string,
  data: Record<string, unknown>,
) {
  await expire(gameId);
  try {
    return await db.transaction(async (transaction) => {
      const game = await Game.findByPk(gameId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      requireThat(game, "game_not_found", 404);
      await authorize(identity, game, transaction);
      const teacher = () =>
        requireThat(identity.kind === "teacher", "forbidden", 403);
      const player = () =>
        requireThat(identity.kind === "player", "forbidden", 403);
      const lobby = () => requireThat(game.status === "LOBBY", "game_closed");
      const member = () =>
        TeamMember.findOne({ where: { playerId: identity.id }, transaction });
      const change = async (
        status: typeof game.status,
        extra: Partial<Entity> = {},
      ) => {
        transition(game.status, status);
        await game.update({ status, ...extra }, { transaction });
      };
      switch (event) {
        case "team:request": {
          player();
          lobby();
          const target = await Player.findOne({
            where: { id: Number(data.targetPlayerId), gameId },
            transaction,
          });
          requireThat(target, "player_not_found");
          roles(identity.id, target.id, data.position as Side);
          requireThat(
            !(await TeamMember.count({
              where: { playerId: { [Op.in]: [identity.id, target.id] } },
              transaction,
            })),
            "already_paired",
          );
          requireThat(
            !(await PairRequest.count({
              where: {
                gameId,
                requestStatus: "PENDING",
                [Op.or]: [
                  { requesterPlayerId: { [Op.in]: [identity.id, target.id] } },
                  { targetPlayerId: { [Op.in]: [identity.id, target.id] } },
                ],
              },
              transaction,
            })),
            "pending_request",
          );
          await PairRequest.create(
            {
              gameId,
              requesterPlayerId: identity.id,
              targetPlayerId: target.id,
              targetRelativePosition: data.position as Side,
            },
            { transaction },
          );
          break;
        }
        case "team:respond": {
          player();
          lobby();
          const request = await PairRequest.findOne({
            where: {
              id: Number(data.requestId),
              gameId,
              requestStatus: "PENDING",
            },
            transaction,
          });
          requireThat(request, "stale_request");
          requireThat(request.targetPlayerId === identity.id, "forbidden", 403);
          if (!data.accept) {
            await request.update(
              { requestStatus: "REJECTED" },
              { transaction },
            );
            break;
          }
          requireThat(
            !(await TeamMember.count({
              where: {
                playerId: { [Op.in]: [request.requesterPlayerId, identity.id] },
              },
              transaction,
            })),
            "already_paired",
          );
          const assigned = roles(
            request.requesterPlayerId,
            identity.id,
            request.targetRelativePosition,
          );
          const team = await Team.create(
            { gameId, name: "Equipo " + request.id, ...assigned },
            { transaction },
          );
          await TeamMember.bulkCreate(
            [
              {
                teamId: team.id,
                playerId: assigned.leftPlayerId,
                side: "LEFT",
              },
              {
                teamId: team.id,
                playerId: assigned.rightPlayerId,
                side: "RIGHT",
              },
            ],
            { transaction },
          );
          await request.update({ requestStatus: "ACCEPTED" }, { transaction });
          break;
        }
        case "team:cancel": {
          player();
          lobby();
          await PairRequest.update(
            { requestStatus: "CANCELLED" },
            {
              where: {
                gameId,
                requesterPlayerId: identity.id,
                requestStatus: "PENDING",
              },
              transaction,
            },
          );
          break;
        }
        case "team:set-name": {
          player();
          lobby();
          const m = await member();
          requireThat(m, "no_team");
          await Team.update(
            { name: String(data.name) },
            { where: { id: m.teamId, gameId }, transaction },
          );
          break;
        }
        case "game:start": {
          teacher();
          const teams = await Team.count({ where: { gameId }, transaction });
          requireThat(teams > 0, "no_teams");
          const players = await Player.count({
            where: { gameId },
            transaction,
          });
          requireThat(
            players === teams * 2 || data.confirmSpectators === true,
            "confirm_spectators",
          );
          await change("READY", { startedAt: new Date() });
          await PairRequest.update(
            { requestStatus: "EXPIRED" },
            { where: { gameId, requestStatus: "PENDING" }, transaction },
          );
          break;
        }
        case "question:start": {
          teacher();
          requireThat(
            game.currentQuestionIndex < game.questionCount,
            "no_more_questions",
          );
          const now = new Date();
          await change("QUESTION_ACTIVE", {
            currentQuestionIndex: game.currentQuestionIndex + 1,
            questionStartedAt: now,
            questionExpiresAt: new Date(
              now.getTime() + game.questionDurationSeconds * 1000,
            ),
          });
          break;
        }
        case "question:finish":
          teacher();
          await change("QUESTION_FINISHED");
          break;
        case "ranking:set-view": {
          teacher();
          requireThat(
            ["QUESTION_FINISHED", "SHOWING_RANKING", "FINISHED"].includes(
              game.status,
            ),
            "invalid_transition",
          );
          if (game.status === "QUESTION_FINISHED")
            await change("SHOWING_RANKING");
          await game.update(
            { rankingView: String(data.view) },
            { transaction },
          );
          break;
        }
        case "game:finish":
          teacher();
          requireThat(
            game.currentQuestionIndex === game.questionCount,
            "questions_remaining",
          );
          await change("FINISHED", { finishedAt: new Date() });
          break;
        case "answer:submit": {
          player();
          requireThat(game.status === "QUESTION_ACTIVE", "question_closed");
          const now = Date.now();
          requireThat(
            game.questionExpiresAt &&
              game.questionStartedAt &&
              now <= game.questionExpiresAt.getTime(),
            "timeout",
          );
          requireThat(Number(data.gameQuestionId) > 0, "invalid_question");
          const active = await GameQuestion.findOne({
            where: { gameId, position: game.currentQuestionIndex },
            transaction,
          });
          requireThat(
            active && active.id === data.gameQuestionId,
            "stale_question",
          );
          const m = await member();
          requireThat(m, "spectator");
          const q = active.questionSnapshot;
          requireThat(q, "question_not_found");
          const correct = m.side === q.correctOption;
          await TeamAnswer.create(
            {
              gameId,
              gameQuestionId: active.id,
              teamId: m.teamId,
              answeredByPlayerId: identity.id,
              selectedOption: m.side,
              isCorrect: correct,
              responseTimeMs: now - game.questionStartedAt.getTime(),
              scoreAwarded: score(
                correct,
                game.questionExpiresAt.getTime() - now,
                game.questionDurationSeconds * 1000,
              ),
              answeredAt: new Date(now),
            },
            { transaction },
          );
          const [answers, teams] = await Promise.all([
            TeamAnswer.count({
              where: { gameQuestionId: active.id },
              transaction,
            }),
            Team.count({ where: { gameId }, transaction }),
          ]);
          if (answers === teams) await change("QUESTION_FINISHED");
          break;
        }
        default:
          throw new AppError("unknown_command");
      }
      return { ok: true };
    });
  } catch (e) {
    if (e instanceof UniqueConstraintError)
      throw new AppError(
        event === "answer:submit" ? "already_answered" : "already_paired",
        409,
      );
    throw e;
  }
}
export async function snapshot(
  identity: Identity,
  gameId: number,
  connected: number[] = [],
) {
  await expire(gameId);
  return db.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
    async (transaction) => {
      const game = await Game.findByPk(gameId, { transaction });
      requireThat(game, "game_not_found", 404);
      await authorize(identity, game, transaction);
      const [players, teams, requests, answers, active] = await Promise.all([
        Player.findAll({
          where: { gameId },
          attributes: ["id", "name", "avatar"],
          transaction,
        }),
        Team.findAll({ where: { gameId }, transaction }),
        PairRequest.findAll({
          where: { gameId, requestStatus: "PENDING" },
          transaction,
        }),
        TeamAnswer.findAll({ where: { gameId }, transaction }),
        GameQuestion.findOne({
          where: { gameId, position: game.currentQuestionIndex },
          transaction,
        }),
      ]);
      const revealed = [
        "QUESTION_FINISHED",
        "SHOWING_RANKING",
        "FINISHED",
      ].includes(game.status);
      const q = active?.questionSnapshot ?? null;
      const visibleAnswers = answers.filter(
        (a) => revealed || a.gameQuestionId !== active?.id,
      );
      const stats = (subset: Entity[]) => {
        const ordered = [...subset].sort(
          (a, b) => a.gameQuestionId - b.gameQuestionId,
        );
        let streak = 0;
        for (const answer of ordered)
          streak = answer.isCorrect ? streak + 1 : 0;
        const comeback =
          ordered.length >= 3 && !ordered[0].isCorrect && streak >= 2;
        const correct = subset.filter((a) => a.isCorrect);
        const time = correct.reduce((s, a) => s + a.responseTimeMs, 0);
        return {
          points: subset.reduce((s, a) => s + a.scoreAwarded, 0),
          correct: correct.length,
          attempts: subset.length,
          time,
          comment: comment(
            correct.length,
            subset.length,
            time,
            streak,
            comeback,
          ),
        };
      };
      const order = (
        a: { points: number; correct: number; time: number; id: number },
        b: typeof a,
      ) =>
        b.points - a.points ||
        b.correct - a.correct ||
        a.time - b.time ||
        a.id - b.id;
      const team = teams.find(
        (t) =>
          t.leftPlayerId === identity.id || t.rightPlayerId === identity.id,
      );
      const mine =
        identity.kind === "player" && team
          ? answers.find(
              (a) => a.teamId === team.id && a.gameQuestionId === active?.id,
            )
          : undefined;
      return {
        game: game.toJSON(),
        serverNow: Date.now(),
        me: identity,
        players: players.map((p) => ({
          ...p.toJSON(),
          connected: connected.includes(p.id),
        })),
        teams: teams.map((t) => t.toJSON()),
        requests: requests
          .filter(
            (r) =>
              identity.kind === "teacher" ||
              r.requesterPlayerId === identity.id ||
              r.targetPlayerId === identity.id,
          )
          .map((r) => r.toJSON()),
        question:
          q && active
            ? {
                id: active.id,
                statement: q.statement,
                leftOption: q.leftOption,
                rightOption: q.rightOption,
                category: q.category,
                ...(revealed
                  ? {
                      correctOption: q.correctOption,
                      explanation: q.explanation,
                    }
                  : {}),
              }
            : null,
        answer: mine
          ? {
              selectedOption: mine.selectedOption,
              answeredByPlayerId: mine.answeredByPlayerId,
              ...(revealed
                ? { isCorrect: mine.isCorrect, scoreAwarded: mine.scoreAwarded }
                : {}),
            }
          : null,
        answeredCount: answers.filter((a) => a.gameQuestionId === active?.id)
          .length,
        results: revealed
          ? stats(answers.filter((a) => a.gameQuestionId === active?.id))
          : null,
        teamRanking: teams
          .map((t) => ({
            id: t.id,
            name: t.name,
            ...stats(visibleAnswers.filter((a) => a.teamId === t.id)),
          }))
          .sort(order),
        individualRanking: players
          .map((p) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            team:
              teams.find(
                (t) => t.leftPlayerId === p.id || t.rightPlayerId === p.id,
              )?.name || "Espectador",
            ...stats(
              visibleAnswers.filter((a) => a.answeredByPlayerId === p.id),
            ),
          }))
          .sort(order),
      };
    },
  );
}
