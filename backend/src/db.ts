import { config } from "dotenv";
import { resolve } from "node:path";
import { Sequelize, DataTypes as D, Model, ModelStatic } from "sequelize";
import type { Status, Side } from "./domain";
config({ path: resolve(__dirname, "../../.env") });
export const db = new Sequelize(
  process.env.MYSQL_DATABASE || "pair_game",
  process.env.MYSQL_USER || "pair_game",
  process.env.MYSQL_PASSWORD || "",
  {
    dialect: "mysql",
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    logging: false,
  },
);
export interface Row {
  deletedAt: Date | null;
  version: number;
  questionSnapshot: QuestionContent;
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: "teacher" | "admin";
  isActive: boolean;
  sessionVersion: number;
  teacherId: number;
  gameId: number;
  code: string;
  status: Status;
  questionCount: number;
  questionDurationSeconds: number;
  currentQuestionIndex: number;
  questionStartedAt: Date | null;
  questionExpiresAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  rankingView: string;
  showPartnerOption: boolean;
  avatar: string;
  sessionTokenHash: string;
  leftPlayerId: number;
  rightPlayerId: number;
  teamId: number;
  playerId: number;
  side: Side;
  statement: string;
  leftOption: string;
  rightOption: string;
  correctOption: Side;
  explanation: string;
  category: string;
  difficulty: string;
  questionId: number;
  position: number;
  gameQuestionId: number;
  answeredByPlayerId: number;
  selectedOption: Side;
  isCorrect: boolean;
  responseTimeMs: number;
  scoreAwarded: number;
  answeredAt: Date;
  requesterPlayerId: number;
  targetPlayerId: number;
  targetRelativePosition: Side;
  requestStatus: string;
}
export type QuestionContent = Pick<
  Row,
  | "statement"
  | "leftOption"
  | "rightOption"
  | "correctOption"
  | "explanation"
  | "category"
  | "difficulty"
>;
export type Entity = Model<Row, Partial<Row>> & Row;
const id = { type: D.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true };
const integer = { type: D.INTEGER.UNSIGNED, allowNull: false };
const str = { type: D.STRING(120), allowNull: false };
function model(
  name: string,
  fields: Record<string, object>,
): ModelStatic<Entity> {
  const attributes = Object.fromEntries(
    Object.entries({ id, ...fields }).map(([key, value]) => [
      key,
      { ...value },
    ]),
  );
  return db.define(name, attributes, {
    timestamps: false,
    freezeTableName: true,
  }) as ModelStatic<Entity>;
}
export const Teacher = model("Teacher", {
  name: str,
  email: { ...str, unique: true },
  passwordHash: str,
  role: {
    type: D.ENUM("teacher", "admin"),
    allowNull: false,
    defaultValue: "teacher",
  },
  isActive: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
  sessionVersion: {
    type: D.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  deletedAt: { type: D.DATE(3), allowNull: true },
});
export const Game = model("Game", {
  teacherId: integer,
  code: { ...str, unique: true },
  status: {
    type: D.ENUM(
      "LOBBY",
      "READY",
      "QUESTION_ACTIVE",
      "QUESTION_FINISHED",
      "SHOWING_RANKING",
      "FINISHED",
    ),
    defaultValue: "LOBBY",
  },
  questionCount: integer,
  questionDurationSeconds: integer,
  currentQuestionIndex: { type: D.INTEGER, defaultValue: 0 },
  questionStartedAt: { type: D.DATE(3) },
  questionExpiresAt: { type: D.DATE(3) },
  startedAt: { type: D.DATE(3) },
  finishedAt: { type: D.DATE(3) },
  rankingView: { type: D.STRING, defaultValue: "hidden" },
  showPartnerOption: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
});
export const Player = model("Player", {
  gameId: integer,
  name: str,
  avatar: str,
  sessionTokenHash: { ...str, unique: true },
});
export const Team = model("Team", {
  gameId: integer,
  name: str,
  leftPlayerId: integer,
  rightPlayerId: integer,
});
export const TeamMember = model("TeamMember", {
  teamId: integer,
  playerId: { ...integer, unique: true },
  side: { type: D.ENUM("LEFT", "RIGHT"), allowNull: false },
});
export const Question = model("Question", {
  isActive: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
  deletedAt: { type: D.DATE(3), allowNull: true, defaultValue: null },
  version: { type: D.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  statement: { type: D.TEXT, allowNull: false },
  leftOption: str,
  rightOption: str,
  correctOption: { type: D.ENUM("LEFT", "RIGHT"), allowNull: false },
  explanation: { type: D.TEXT, allowNull: false },
  category: str,
  difficulty: str,
});
export const GameQuestion = model("GameQuestion", {
  questionSnapshot: { type: D.JSON, allowNull: false },
  gameId: integer,
  questionId: integer,
  position: integer,
});
export const TeamAnswer = model("TeamAnswer", {
  gameId: integer,
  gameQuestionId: integer,
  teamId: integer,
  answeredByPlayerId: integer,
  selectedOption: { type: D.ENUM("LEFT", "RIGHT"), allowNull: false },
  isCorrect: { type: D.BOOLEAN, allowNull: false },
  responseTimeMs: integer,
  scoreAwarded: integer,
  answeredAt: { type: D.DATE(3), allowNull: false },
});
export const PairRequest = model("PairRequest", {
  gameId: integer,
  requesterPlayerId: integer,
  targetPlayerId: integer,
  targetRelativePosition: { type: D.ENUM("LEFT", "RIGHT"), allowNull: false },
  requestStatus: { type: D.STRING, defaultValue: "PENDING" },
});
