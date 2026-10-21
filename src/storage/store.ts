import type Dexie from "dexie";
import type {
  Course,
  Doc,
  Note,
  Reviewer,
  Goal,
  Session,
  Timer,
} from "../models";

export type Records = {
  courses: Course;
  documents: Doc;
  notes: Note;
  reviewers: Reviewer;
  goals: Goal;
  sessions: Session;
  timers: Timer;
  settings: { id: string; value: any };
};
export const tableNames = [
  "courses",
  "documents",
  "notes",
  "reviewers",
  "goals",
  "sessions",
  "timers",
  "settings",
] as const;
export type TableName = keyof Records;
export interface Collection<T> {
  toArray(): Promise<T[]>;
  first(): Promise<T | undefined>;
  reverse(): Collection<T>;
  limit(count: number): Collection<T>;
  modify(changes: Partial<T>): Promise<number>;
}
export interface StudyTable<T extends { id: string }> {
  name: string;
  get(id: string): Promise<T | undefined>;
  toArray(): Promise<T[]>;
  count(): Promise<number>;
  add(record: T): Promise<unknown>;
  put(record: T): Promise<unknown>;
  bulkAdd(records: T[]): Promise<unknown>;
  update(id: string, changes: Partial<T>): Promise<number>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  where(index: string): { equals(value: string): Collection<T> };
  orderBy(index: string): Collection<T>;
}
export type StudyStore = { [K in TableName]: StudyTable<Records[K]> } & {
  tables: StudyTable<any>[];
  table(name: string): StudyTable<any>;
  atomic<T>(
    mode: "r" | "rw",
    tables: StudyTable<any>[],
    run: (tx: StudyStore) => Promise<T>,
  ): Promise<T>;
  close(): void;
};

// Keep native transaction contexts explicit: asynchronous UI events cannot
// accidentally join another operation's transaction.
export function webStore(db: Dexie): StudyStore {
  const store: StudyStore = {
    courses: db.table("courses"),
    documents: db.table("documents"),
    notes: db.table("notes"),
    reviewers: db.table("reviewers"),
    goals: db.table("goals"),
    sessions: db.table("sessions"),
    timers: db.table("timers"),
    settings: db.table("settings"),
    tables: db.tables,
    table: (name: string) => db.table(name),
    atomic: <T>(
      mode: "r" | "rw",
      tables: StudyTable<any>[],
      run: (tx: StudyStore) => Promise<T>,
    ) =>
      db.transaction(
        mode,
        tables.map((t) => db.table(t.name)),
        () => run(store),
      ),
    close: () => db.close(),
  };
  return store;
}
