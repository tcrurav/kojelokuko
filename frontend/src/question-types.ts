export interface QuestionInput {
  statement: string;
  leftOption: string;
  rightOption: string;
  correctOption: "LEFT" | "RIGHT";
  explanation: string;
  category: string;
  difficulty: string;
}
export interface BankQuestion extends QuestionInput {
  id: number;
  version: number;
}
export interface QuestionList {
  items: BankQuestion[];
  total: number;
  page: number;
  pageSize: number;
}
