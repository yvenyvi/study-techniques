import { nativeInvoke } from "../platform";
import { storageChanged } from "./live";
import {
  tableNames,
  type Collection,
  type Records,
  type StudyStore,
  type StudyTable,
  type TableName,
} from "./store";

type Row = { table: TableName; data: Record<string, any>; pdfKey?: string };
type Change = {
  table: TableName;
  id: string;
  kind: "add" | "put" | "delete";
  data?: Record<string, any>;
  pdf?: string;
};
type Cache = Map<TableName, Map<string, Row>>;
export type Bridge = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;
type Coordinator = {
  cache: Cache;
  queue: Promise<unknown>;
  ready?: Promise<void>;
  bridge: Bridge;
};

export function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
function fromBase64(value: string): ArrayBuffer {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0)).buffer;
}
function emptyCache(): Cache {
  return new Map(tableNames.map((name) => [name, new Map()]));
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** SQLite is authoritative. The cache holds metadata, never persisted browser data. */
export class DesktopStore implements StudyStore {
  courses!: StudyTable<Records["courses"]>;
  documents!: StudyTable<Records["documents"]>;
  notes!: StudyTable<Records["notes"]>;
  reviewers!: StudyTable<Records["reviewers"]>;
  goals!: StudyTable<Records["goals"]>;
  sessions!: StudyTable<Records["sessions"]>;
  timers!: StudyTable<Records["timers"]>;
  settings!: StudyTable<Records["settings"]>;
  tables: StudyTable<any>[];
  private coordinator: Coordinator;
  private changes: Change[] = [];
  private pendingPDFs = new Map<string, Records["documents"]["blob"]>();

  constructor(
    bridge: Bridge = nativeInvoke,
    private stage?: Cache,
    coordinator?: Coordinator,
    private writable = false,
    private scope?: Set<string>,
  ) {
    this.coordinator = coordinator || {
      cache: emptyCache(),
      queue: Promise.resolve(),
      bridge,
    };
    this.tables = tableNames.map((name) => new NativeTable(this, name));
    for (const table of this.tables)
      Object.assign(this, { [table.name]: table });
  }
  initialize(): Promise<void> {
    return (this.coordinator.ready ||= this.coordinator
      .bridge<Row[]>("load_library")
      .then((rows) => {
        const cache = emptyCache();
        for (const row of rows) {
          if (!cache.has(row.table))
            throw Error("Unsupported desktop database table.");
          cache.get(row.table)!.set(row.data.id, row);
        }
        this.coordinator.cache = cache;
      }));
  }
  table(name: string): StudyTable<any> {
    const table = this.tables.find((t) => t.name === name);
    if (!table) throw Error("Unknown study table.");
    return table;
  }
  close() {}
  async settle() {
    await this.coordinator.queue;
  }
  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    const next = this.coordinator.queue.catch(() => {}).then(run);
    this.coordinator.queue = next;
    return next;
  }
  async atomic<T>(
    mode: "r" | "rw",
    tables: StudyTable<any>[],
    run: (tx: StudyStore) => Promise<T>,
  ): Promise<T> {
    if (this.stage)
      throw Error("Nested desktop transactions are not supported.");
    return this.enqueue(async () => {
      await this.initialize();
      const stage = new Map(
        [...this.coordinator.cache].map(([name, rows]) => [
          name,
          new Map(rows),
        ]),
      );
      const tx = new DesktopStore(
        this.coordinator.bridge,
        stage,
        this.coordinator,
        mode === "rw",
        new Set(tables.map((t) => t.name)),
      );
      const result = await run(tx);
      if (tx.changes.length) {
        // The backend returns committed rows, including native PDF keys. Nothing
        // is published to React until the entire native transaction succeeds.
        const rows = await this.coordinator.bridge<Row[]>("commit_library", {
          changes: tx.changes,
        });
        for (const change of tx.changes)
          stage.get(change.table)!.delete(change.id);
        for (const row of rows) stage.get(row.table)!.set(row.data.id, row);
        this.coordinator.cache = stage;
        storageChanged();
      }
      return result;
    });
  }
  private checkScope(name: TableName) {
    if (this.scope && !this.scope.has(name))
      throw Error("Table is outside this transaction.");
  }
  async rows<T>(name: TableName): Promise<T[]> {
    await this.initialize();
    this.checkScope(name);
    return [...(this.stage || this.coordinator.cache).get(name)!.values()].map(
      (row) => {
        const data = clone(row.data);
        if (name === "documents") {
          const pending = this.pendingPDFs.get(data.id);
          const key = row.pdfKey;
          data.blob = pending || {
            arrayBuffer: async () =>
              fromBase64(
                await this.coordinator.bridge<string>("read_pdf", { key }),
              ),
            text: async () =>
              new TextDecoder().decode(
                fromBase64(
                  await this.coordinator.bridge<string>("read_pdf", { key }),
                ),
              ),
          };
        }
        return data as T;
      },
    );
  }
  async write<T>(
    name: TableName,
    run: (tx: DesktopStore) => Promise<T>,
  ): Promise<T> {
    if (!this.stage)
      return this.atomic("rw", [this.table(name)], (tx) =>
        run(tx as DesktopStore),
      );
    this.checkScope(name);
    if (!this.writable) throw Error("Cannot write in a read transaction.");
    return run(this);
  }
  async change(
    name: TableName,
    kind: Change["kind"],
    id: string,
    record?: Record<string, any>,
  ): Promise<void> {
    const table = this.stage!.get(name)!;
    if (kind === "add" && table.has(id))
      throw Error("This record already exists.");
    if (kind === "delete") {
      table.delete(id);
      this.pendingPDFs.delete(id);
      this.changes.push({ table: name, id, kind });
      return;
    }
    const { blob, ...metadata } = record!;
    const data = clone({ ...metadata, id });
    let pdf: string | undefined;
    if (name === "documents" && blob) {
      pdf = toBase64(new Uint8Array(await blob.arrayBuffer()));
      this.pendingPDFs.set(id, blob);
    }
    table.set(id, { table: name, data, pdfKey: table.get(id)?.pdfKey });
    this.changes.push({ table: name, id, kind, data, pdf });
  }
}

class NativeTable<T extends { id: string }> implements StudyTable<T> {
  constructor(
    readonly store: DesktopStore,
    public name: TableName,
  ) {}
  toArray() {
    return this.store.rows<T>(this.name);
  }
  async get(id: string) {
    return (await this.toArray()).find((row) => row.id === id);
  }
  async count() {
    return (await this.toArray()).length;
  }
  add(record: T) {
    return this.store.write(this.name, (tx) =>
      tx.change(this.name, "add", record.id, record),
    );
  }
  put(record: T) {
    return this.store.write(this.name, (tx) =>
      tx.change(this.name, "put", record.id, record),
    );
  }
  bulkAdd(records: T[]) {
    return this.store.write(this.name, async (tx) => {
      for (const row of records) await tx.change(this.name, "add", row.id, row);
    });
  }
  delete(id: string) {
    return this.store.write(this.name, (tx) =>
      tx.change(this.name, "delete", id),
    );
  }
  clear() {
    return this.store.write(this.name, async (tx) => {
      for (const row of await tx.rows<T>(this.name))
        await tx.change(this.name, "delete", row.id);
    });
  }
  update(id: string, changes: Partial<T>) {
    return this.store.write(this.name, async (tx) => {
      const row = (await tx.rows<T>(this.name)).find((r) => r.id === id);
      if (!row) return 0;
      // Preserve the existing native PDF file when only metadata changes.
      const { blob: _blob, ...metadata } = row as T & { blob?: unknown };
      await tx.change(this.name, "put", id, { ...metadata, ...changes, id });
      return 1;
    });
  }
  where(index: string) {
    return {
      equals: (value: string) =>
        new NativeCollection<T>(this, (row) => (row as any)[index] === value),
    };
  }
  orderBy(index: string) {
    return new NativeCollection<T>(this, undefined, index);
  }
}
class NativeCollection<T extends { id: string }> implements Collection<T> {
  constructor(
    private table: NativeTable<T>,
    private predicate?: (row: T) => boolean,
    private index?: string,
    private descending = false,
    private max = Infinity,
  ) {}
  async toArray() {
    let rows = await this.table.toArray();
    if (this.predicate) rows = rows.filter(this.predicate);
    if (this.index) {
      const index = this.index;
      rows.sort((a: any, b: any) =>
        a[index] < b[index]
          ? -1
          : a[index] > b[index]
            ? 1
            : a.id.localeCompare(b.id),
      );
    }
    if (this.descending) rows.reverse();
    return rows.slice(0, this.max);
  }
  async first() {
    return (await this.limit(1).toArray())[0];
  }
  reverse() {
    return new NativeCollection(
      this.table,
      this.predicate,
      this.index,
      !this.descending,
      this.max,
    );
  }
  limit(count: number) {
    return new NativeCollection(
      this.table,
      this.predicate,
      this.index,
      this.descending,
      count,
    );
  }
  async modify(changes: Partial<T>) {
    // Table-level transaction ensures course changes cannot leave a half-updated set.
    const store = this.table.store;
    return store.write(this.table.name, async (tx) => {
      const table = tx.table(this.table.name) as NativeTable<T>;
      const rows = await new NativeCollection(
        table,
        this.predicate,
        this.index,
        this.descending,
        this.max,
      ).toArray();
      for (const row of rows) await table.update(row.id, changes);
      return rows.length;
    });
  }
}
