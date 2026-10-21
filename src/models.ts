export type Ref = { documentId: string; page: number; quote: string };
export type Course = {
  id: string;
  name: string;
  description: string;
  color: string;
};
export type Doc = {
  id: string;
  title: string;
  courseId: string;
  tags: string;
  blob: Pick<Blob, "arrayBuffer" | "text">;
  hash: string;
  pages: number;
  page: number;
  created: number;
  lastOpened?: number;
};
export type Note = {
  id: string;
  title: string;
  courseId: string;
  documentId?: string;
  content: any;
  updated: number;
};
export type Section = {
  id: string;
  kind: string;
  fields: Record<string, string>;
  refs: Ref[];
};
export type Reviewer = {
  id: string;
  title: string;
  courseId: string;
  tags: string;
  sections: Section[];
  updated: number;
};
export type Goal = {
  id: string;
  title: string;
  criterion: string;
  courseId: string;
  materialIds: string[];
  done: boolean;
  created: number;
  completed?: number;
};
export type Session = {
  id: string;
  goalId: string;
  started: number;
  ended: number;
  duration: number;
  outcome: string;
  note: string;
};
export type Timer = {
  id: string;
  phase: "focus" | "break";
  running: boolean;
  deadline: number;
  remaining: number;
  goalId: string;
  started: number;
  elapsed: number;
};
