/**
 * Jest mock for better-sqlite3.
 *
 * Problem: @electron/rebuild recompiles better-sqlite3 for Electron's ABI.
 * Jest runs under plain Node — a completely different ABI — so the rebuilt
 * binary crashes immediately.  We cannot use the real binary in CI tests.
 *
 * Solution: a pure-JavaScript in-memory store that faithfully implements
 * the better-sqlite3 synchronous API surface used by this project:
 *   - pragma / exec  (DDL — parsed to build table schemas)
 *   - prepare(sql)   → Statement with .run() / .get() / .all()
 *   - transaction(fn) → wrapped function
 *
 * The store is a Map<tableName, row[]>.  SQL is parsed with lightweight
 * regexes — good enough for the fixed queries in this codebase.
 *
 * ESM-interop: with esModuleInterop:true, ts-jest resolves
 *   import Database from 'better-sqlite3'  →  module.default
 * so we set DatabaseStub.default = DatabaseStub.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Tiny SQL interpreter — only the statements used in this project
// ---------------------------------------------------------------------------

type Row = Record<string, any>;
type Store = Map<string, Row[]>;

/** Parse column names from a CREATE TABLE statement. */
function parseColumns(createSql: string): string[] {
  const body = createSql.replace(/[\r\n]+/g, ' ');
  const m = body.match(/\(([^)]+)\)/);
  if (!m) return [];
  return m[1]
    .split(',')
    .map(c => c.trim().split(/\s+/)[0].toLowerCase())
    .filter(c => c && !c.startsWith('primary') && !c.startsWith('unique')
               && !c.startsWith('foreign') && !c.startsWith('check')
               && !c.startsWith('constraint'));
}

/** Very small SQL executor against our in-memory store. */
function runSql(
  store: Store,
  schemas: Map<string, string[]>,
  sql: string,
  params: any[],
): { rows: Row[]; changes: number; lastInsertRowid: number } {
  const s = sql.replace(/[\r\n]+/g, ' ').trim();
  const upper = s.toUpperCase();

  // ── CREATE TABLE (IF NOT EXISTS) ─────────────────────────────────────────
  if (upper.startsWith('CREATE TABLE')) {
    const m = s.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
    if (m) {
      const tbl = m[1].toLowerCase();
      if (!store.has(tbl)) {
        store.set(tbl, []);
        schemas.set(tbl, parseColumns(s));
      }
    }
    return { rows: [], changes: 0, lastInsertRowid: 0 };
  }

  // ── CREATE INDEX ─────────────────────────────────────────────────────────
  if (upper.startsWith('CREATE INDEX') || upper.startsWith('CREATE UNIQUE')) {
    return { rows: [], changes: 0, lastInsertRowid: 0 };
  }

  // ── INSERT ────────────────────────────────────────────────────────────────
  if (upper.startsWith('INSERT')) {
    const orReplace = /INSERT\s+OR\s+REPLACE/i.test(s);
    const orIgnore  = /INSERT\s+OR\s+IGNORE/i.test(s);
    const tblM = s.match(/INTO\s+(\w+)\s*\(([^)]+)\)/i);
    if (!tblM) return { rows: [], changes: 0, lastInsertRowid: 0 };
    const tbl  = tblM[1].toLowerCase();
    const cols = tblM[2].split(',').map(c => c.trim().toLowerCase());

    const rows = store.get(tbl) ?? [];
    store.set(tbl, rows);

    // Build the new row
    const row: Row = {};
    cols.forEach((c, i) => { row[c] = params[i] ?? null; });

    // Detect UNIQUE / PRIMARY KEY conflicts for OR REPLACE / OR IGNORE
    // Heuristic: treat first column as the unique key if orReplace/orIgnore
    if (orReplace || orIgnore) {
      // Find a unique-ish key: for app_config it's "key"; generic: first col
      const uniqueCol = cols[0];
      const idx = rows.findIndex(r => r[uniqueCol] === row[uniqueCol]);
      if (idx !== -1) {
        if (orIgnore)  return { rows: [], changes: 0, lastInsertRowid: 0 };
        if (orReplace) { rows.splice(idx, 1); } // fall through to insert
      }
    }

    rows.push(row);
    return { rows: [], changes: 1, lastInsertRowid: rows.length };
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (upper.startsWith('DELETE')) {
    const tblM = s.match(/FROM\s+(\w+)/i);
    if (!tblM) return { rows: [], changes: 0, lastInsertRowid: 0 };
    const tbl  = tblM[1].toLowerCase();
    const rows = store.get(tbl) ?? [];

    // Parse simple WHERE col < ? or col <= ? etc.
    const whereM = s.match(/WHERE\s+(\w+)\s*(<|<=|>|>=|=)\s*\?/i);
    if (!whereM) {
      const before = rows.length;
      store.set(tbl, []);
      return { rows: [], changes: before, lastInsertRowid: 0 };
    }
    const col = whereM[1].toLowerCase();
    const op  = whereM[2];
    const val = params[0];
    const keep = rows.filter(r => !compare(r[col], op, val));
    const deleted = rows.length - keep.length;
    store.set(tbl, keep);
    return { rows: [], changes: deleted, lastInsertRowid: 0 };
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  if (upper.startsWith('UPDATE')) {
    const tblM = s.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
    if (!tblM) return { rows: [], changes: 0, lastInsertRowid: 0 };
    const tbl     = tblM[1].toLowerCase();
    const setPart = tblM[2];
    const wherePart = tblM[3];
    const rows    = store.get(tbl) ?? [];

    // Parse SET col = ?
    const setCol = (setPart.match(/(\w+)\s*=\s*\?/i) ?? [])[1]?.toLowerCase();
    // Parse WHERE col = ?
    const whereCol = (wherePart.match(/(\w+)\s*=\s*\?/i) ?? [])[1]?.toLowerCase();
    if (!setCol || !whereCol) return { rows: [], changes: 0, lastInsertRowid: 0 };

    let changes = 0;
    for (const r of rows) {
      if (r[whereCol] === params[1]) { r[setCol] = params[0]; changes++; }
    }
    return { rows: [], changes, lastInsertRowid: 0 };
  }

  // ── SELECT ────────────────────────────────────────────────────────────────
  if (upper.startsWith('SELECT')) {
    return { rows: execSelect(store, s, params), changes: 0, lastInsertRowid: 0 };
  }

  // ── PRAGMA / other ───────────────────────────────────────────────────────
  return { rows: [], changes: 0, lastInsertRowid: 0 };
}

/** Operator comparator helper */
function compare(a: any, op: string, b: any): boolean {
  switch (op) {
    case '<':  return a < b;
    case '<=': return a <= b;
    case '>':  return a > b;
    case '>=': return a >= b;
    case '=':  return a === b;
    default:   return false;
  }
}

/** Execute a SELECT statement and return matching rows. */
function execSelect(store: Store, sql: string, params: any[]): Row[] {
  // Extract table name
  const tblM = sql.match(/FROM\s+(\w+)/i);
  if (!tblM) return [];
  const tbl  = tblM[1].toLowerCase();
  let rows   = [...(store.get(tbl) ?? [])];

  // Build WHERE conditions
  // Supports: col = ?, col < ?, col <= ?, col > ?, col >= ?
  // Multiple AND conditions
  const whereM = sql.match(/WHERE\s+(.+?)(?:ORDER BY|GROUP BY|LIMIT|$)/i);
  if (whereM) {
    let pi = 0;
    const conditions = whereM[1].split(/\s+AND\s+/i);
    for (const cond of conditions) {
      const m = cond.trim().match(/(\w+)\s*(<|<=|>|>=|=|!=|<>)\s*\?/i);
      if (m) {
        const col = m[1].toLowerCase();
        const op  = m[2];
        const val = params[pi++];
        const invOp = op === '!=' || op === '<>' ? '!=' : op;
        if (invOp === '!=') {
          rows = rows.filter(r => r[col] !== val);
        } else {
          rows = rows.filter(r => compare(r[col], op, val));
        }
      }
    }
  }

  // LIMIT
  const limitM = sql.match(/LIMIT\s+(\d+)/i);
  if (limitM) rows = rows.slice(0, parseInt(limitM[1], 10));

  // ORDER BY col DESC
  const orderM = sql.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
  if (orderM) {
    const col  = orderM[1].toLowerCase();
    const desc = (orderM[2] ?? '').toUpperCase() === 'DESC';
    rows.sort((a, b) => {
      if (a[col] < b[col]) return desc ? 1 : -1;
      if (a[col] > b[col]) return desc ? -1 : 1;
      return 0;
    });
  }

  // SELECT col list (or *)
  const selM = sql.match(/^SELECT\s+(.*?)\s+FROM/i);
  if (selM && selM[1].trim() !== '*') {
    // Handle aggregate functions and aliases for GROUP BY aggregation
    const selRaw = selM[1];
    if (/COUNT|SUM|AVG|MAX|MIN|DISTINCT/i.test(selRaw)) {
      return execAggregate(rows, selRaw, sql, params);
    }
    // Project specific columns
    const cols = selRaw.split(',').map(c => {
      const alias = c.match(/(\w+)\s+AS\s+(\w+)/i);
      if (alias) return { from: alias[1].toLowerCase(), to: alias[2].toLowerCase() };
      const col   = c.trim().toLowerCase();
      return { from: col, to: col };
    });
    return rows.map(r => {
      const out: Row = {};
      for (const { from, to } of cols) out[to] = r[from];
      return out;
    });
  }

  return rows;
}

/** Handle aggregate SELECT (COUNT, SUM, AVG, MAX, MIN, DISTINCT). */
function execAggregate(rows: Row[], selRaw: string, fullSql: string, _params: any[]): Row[] {
  // GROUP BY
  const groupM = fullSql.match(/GROUP\s+BY\s+(\w+)/i);
  if (groupM) {
    const groupCol = groupM[1].toLowerCase();
    const groups   = new Map<any, Row[]>();
    for (const r of rows) {
      const key = r[groupCol];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return [...groups.entries()].map(([key, grp]) =>
      computeAggRow(selRaw, grp, groupCol, key)
    );
  }

  // No GROUP BY — single aggregate row
  if (rows.length === 0) return [];
  return [computeAggRow(selRaw, rows, null, null)];
}

/** Compute one aggregate result row from a group of rows. */
function computeAggRow(selRaw: string, rows: Row[], groupCol: string | null, groupVal: any): Row {
  const out: Row = {};
  if (groupCol) out[groupCol] = groupVal;

  const exprs = selRaw.split(',');
  for (const expr of exprs) {
    const e = expr.trim();
    const aliasM = e.match(/(.+)\s+AS\s+(\w+)/i);
    const alias  = aliasM ? aliasM[2].toLowerCase() : null;
    const body   = (aliasM ? aliasM[1] : e).trim();

    // COUNT(*) or COUNT(col)
    if (/^COUNT\s*\(/i.test(body)) {
      const key = alias ?? 'count(*)';
      out[key] = rows.length;
      continue;
    }
    // SUM(col)
    const sumM = body.match(/^SUM\s*\((\w+)\)/i);
    if (sumM) {
      const col = sumM[1].toLowerCase();
      const key = alias ?? `sum(${col})`;
      out[key] = rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);
      continue;
    }
    // AVG(col)
    const avgM = body.match(/^AVG\s*\((\w+)\)/i);
    if (avgM) {
      const col = avgM[1].toLowerCase();
      const key = alias ?? `avg(${col})`;
      out[key] = rows.length ? rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0) / rows.length : 0;
      continue;
    }
    // MAX(col)
    const maxM = body.match(/^MAX\s*\((\w+)\)/i);
    if (maxM) {
      const col = maxM[1].toLowerCase();
      const key = alias ?? `max(${col})`;
      out[key] = rows.reduce((acc, r) => Math.max(acc, Number(r[col]) || 0), -Infinity);
      continue;
    }
    // MIN(col)
    const minM = body.match(/^MIN\s*\((\w+)\)/i);
    if (minM) {
      const col = minM[1].toLowerCase();
      const key = alias ?? `min(${col})`;
      out[key] = rows.reduce((acc, r) => Math.min(acc, Number(r[col]) || 0), Infinity);
      continue;
    }
    // DISTINCT col
    const distM = body.match(/^DISTINCT\s+(\w+)/i);
    if (distM) {
      const col = distM[1].toLowerCase();
      const key = alias ?? col;
      out[key] = [...new Set(rows.map(r => r[col]))];
      continue;
    }
    // Plain column
    const col = body.toLowerCase();
    if (groupCol && col === groupCol) { out[col] = groupVal; continue; }
    out[alias ?? col] = rows[0]?.[col];
  }
  return out;
}

// ---------------------------------------------------------------------------
// DatabaseStub — implements the better-sqlite3 API surface
// ---------------------------------------------------------------------------

class DatabaseStub {
  private store: Store = new Map();
  private schemas: Map<string, string[]> = new Map();

  constructor(_path: string) {}

  pragma(_s: string): void { /* no-op */ }

  exec(sql: string): void {
    // Execute each semicolon-separated statement
    for (const stmt of sql.split(';')) {
      const t = stmt.trim();
      if (t) runSql(this.store, this.schemas, t, []);
    }
  }

  prepare(sql: string): StatementStub {
    return new StatementStub(sql, this.store, this.schemas);
  }

  transaction(fn: (...args: any[]) => any): (...args: any[]) => any {
    return (...args: any[]) => fn(...args);
  }

  close(): void {
    this.store.clear();
    this.schemas.clear();
  }
}

class StatementStub {
  constructor(
    private sql: string,
    private store: Store,
    private schemas: Map<string, string[]>,
  ) {}

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    const flat = params.flat();
    const r = runSql(this.store, this.schemas, this.sql, flat);
    return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
  }

  get(...params: any[]): Row | undefined {
    const flat = params.flat();
    const r = runSql(this.store, this.schemas, this.sql, flat);
    return r.rows[0];
  }

  all(...params: any[]): Row[] {
    const flat = params.flat();
    const r = runSql(this.store, this.schemas, this.sql, flat);
    return r.rows;
  }

  pluck(): this { return this; }
  bind(): this  { return this; }
}

// ESM-interop: make `.default` resolve to the constructor
(DatabaseStub as any).default = DatabaseStub;

// Always export the stub — the real binary is compiled for Electron ABI
// and cannot run under plain Node (the Jest environment).
module.exports = DatabaseStub;
