export interface Game {
  id: number;
  code: string;
  status: string;
  questionCount: number;
  questionDurationSeconds: number;
  currentQuestionIndex: number;
  questionExpiresAt: string | null;
  rankingView: string;
}
export interface Player {
  id: number;
  name: string;
  avatar: string;
  connected: boolean;
}
export interface Team {
  id: number;
  name: string;
  leftPlayerId: number;
  rightPlayerId: number;
}
export interface Rank {
  id: number;
  name: string;
  points: number;
  correct: number;
  attempts: number;
  comment: string;
  avatar?: string;
  team?: string;
}
export interface State {
  game: Game;
  serverNow: number;
  me: { kind: string; id: number };
  players: Player[];
  teams: Team[];
  requests: {
    id: number;
    requesterPlayerId: number;
    targetPlayerId: number;
    targetRelativePosition: string;
  }[];
  question: null | {
    id: number;
    statement: string;
    leftOption: string;
    rightOption: string;
    category: string;
    correctOption?: string;
    explanation?: string;
  };
  answer: null | {
    selectedOption: string;
    answeredByPlayerId: number;
    isCorrect?: boolean;
    scoreAwarded?: number;
  };
  answeredCount: number;
  results: null | { correct: number; attempts: number };
  teamRanking: Rank[];
}
