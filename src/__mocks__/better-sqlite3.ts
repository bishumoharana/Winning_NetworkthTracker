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
      const uniqueCol = cols[0];
      const idx = rows.findIndex(r => r[uniqueCol] === row[uniqueCol]);
      if (idx !== -1) {
        if (orIgnore)  return { rows: [], changes: 0, lastInsertRowid: 0 };
        if (orReplace) { rows.splice(idx, 1); }
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

    const setCol   = (setPart.match(/(\w+)\s*=\s*\?/i) ?? [])[1]?.toLowerCase();
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

/**
 * Parse WHERE clause into conditions and advance the param index.
 * Returns { filtered rows, params consumed }.
 * Handles:
 *   col op ?                          (simple)
 *   (col op ? OR col op ?)            (OR group — e.g. adapter_mac = ? OR adapter_name = ?)
 */
function applyWhere(rows: Row[], whereClause: string, params: any[], startIdx: number): { rows: Row[]; pi: number } {
  let pi = startIdx;
  // Split on AND (but not inside parentheses)
  const andParts = splitAndTopLevel(whereClause);

  for (const part of andParts) {
    const trimmed = part.trim();

    // (col op ? OR col op ?) — parenthesised OR group
    const orGroupM = trimmed.match(/^\((.+)\)$/);
    if (orGroupM) {
      const orParts = orGroupM[1].split(/\s+OR\s+/i);
      // Count how many ? are in this group to advance pi correctly
      const qCount = (orGroupM[1].match(/\?/g) ?? []).length;
      const groupParams = params.slice(pi, pi + qCount);
      pi += qCount;

      rows = rows.filter(row => {
        let pj = 0;
        for (const op of orParts) {
          const m = op.trim().match(/(\w+)\s*(<|<=|>|>=|=|!=|<>)\s*\?/i);
          if (m) {
            const col = m[1].toLowerCase();
            const oper = m[2];
            const val = groupParams[pj++];
            if (oper === '!=' || oper === '<>') {
              if (row[col] !== val) return true;
            } else {
              if (compare(row[col], oper, val)) return true;
            }
          }
        }
        return false;
      });
      continue;
    }

    // Simple: col op ?
    const simpleM = trimmed.match(/(\w+)\s*(<|<=|>|>=|=|!=|<>)\s*\?/i);
    if (simpleM) {
      const col  = simpleM[1].toLowerCase();
      const oper = simpleM[2];
      const val  = params[pi++];
      if (oper === '!=' || oper === '<>') {
        rows = rows.filter(r => r[col] !== val);
      } else {
        rows = rows.filter(r => compare(r[col], oper, val));
      }
    }
  }

  return { rows, pi };
}

/** Split a WHERE clause on AND, but not inside parentheses. */
function splitAndTopLevel(clause: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let i = 0;
  while (i < clause.length) {
    if (clause[i] === '(') { depth++; current += clause[i++]; }
    else if (clause[i] === ')') { depth--; current += clause[i++]; }
    else if (depth === 0 && clause.slice(i).match(/^\s+AND\s+/i)) {
      const m = clause.slice(i).match(/^(\s+AND\s+)/i)!;
      parts.push(current);
      current = '';
      i += m[1].length;
    } else {
      current += clause[i++];
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/** Execute a SELECT statement and return matching rows. */
function execSelect(store: Store, sql: string, params: any[]): Row[] {
  // Extract table name
  const tblM = sql.match(/FROM\s+(\w+)/i);
  if (!tblM) return [];
  const tbl = tblM[1].toLowerCase();
  let rows  = [...(store.get(tbl) ?? [])];

  // Apply WHERE — track how many params it consumed so we know the
  // index of the trailing LIMIT ? param (if any).
  const whereM = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|$)/i);
  let pi = 0;
  if (whereM) {
    const result = applyWhere(rows, whereM[1].trim(), params, 0);
    rows = result.rows;
    pi   = result.pi;
  }

  // SELECT col list (or *) — detect aggregates/DISTINCT before ORDER BY / LIMIT
  const selM = sql.match(/^SELECT\s+(.*?)\s+FROM/i);
  if (selM && selM[1].trim() !== '*') {
    const selRaw = selM[1].trim();
    if (/COUNT|SUM|AVG|MAX|MIN|DISTINCT/i.test(selRaw)) {
      return execAggregate(rows, selRaw, sql, params, pi);
    }
    // ORDER BY then LIMIT on plain projection
    rows = applyOrderBy(rows, sql);
    rows = applyLimit(rows, sql, params, pi);
    return projectColumns(rows, selRaw);
  }

  // SELECT *
  rows = applyOrderBy(rows, sql);
  rows = applyLimit(rows, sql, params, pi);
  return rows;
}

function applyOrderBy(rows: Row[], sql: string): Row[] {
  const orderM = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
  if (!orderM) return rows;
  const col  = orderM[1].toLowerCase();
  const desc = (orderM[2] ?? '').toUpperCase() === 'DESC';
  return [...rows].sort((a, b) => {
    if (a[col] < b[col]) return desc ? 1 : -1;
    if (a[col] > b[col]) return desc ? -1 : 1;
    return 0;
  });
}

/**
 * Apply LIMIT to rows.
 * Supports both literal digits (LIMIT 10) and placeholders (LIMIT ?).
 * When the SQL contains LIMIT ?, the limit value is read from params[pi].
 */
function applyLimit(rows: Row[], sql: string, params: any[] = [], pi = 0): Row[] {
  // Literal digit: LIMIT 10
  const literalM = sql.match(/LIMIT\s+(\d+)/i);
  if (literalM) return rows.slice(0, parseInt(literalM[1], 10));

  // Placeholder: LIMIT ?
  if (/LIMIT\s+\?/i.test(sql)) {
    const n = Number(params[pi]);
    if (!isNaN(n) && n >= 0) return rows.slice(0, n);
  }

  return rows;
}

function projectColumns(rows: Row[], selRaw: string): Row[] {
  const cols = selRaw.split(',').map(c => {
    const alias = c.match(/(\w+)\s+AS\s+(\w+)/i);
    // FIX: preserve alias case — do NOT toLowerCase() the alias
    if (alias) return { from: alias[1].toLowerCase(), to: alias[2] };
    const col = c.trim().toLowerCase();
    return { from: col, to: col };
  });
  return rows.map(r => {
    const out: Row = {};
    for (const { from, to } of cols) out[to] = r[from];
    return out;
  });
}

/** Handle aggregate SELECT (COUNT, SUM, AVG, MAX, MIN, DISTINCT). */
function execAggregate(rows: Row[], selRaw: string, fullSql: string, params: any[] = [], pi = 0): Row[] {
  // ── SELECT DISTINCT col1, col2, ... (no GROUP BY, no aggregate fns) ──────
  // e.g. SELECT DISTINCT adapter_mac AS adapter_id, adapter_name
  const isDistinctOnly = /^DISTINCT\s+/i.test(selRaw.trim()) && !/COUNT|SUM|AVG|MAX|MIN/i.test(selRaw);
  if (isDistinctOnly) {
    // Remove DISTINCT prefix then project + deduplicate
    const colsPart = selRaw.replace(/^DISTINCT\s+/i, '');
    const projected = projectColumns(rows, colsPart);
    // Deduplicate on all projected columns
    const seen = new Set<string>();
    return projected.filter(r => {
      const key = JSON.stringify(r);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ── GROUP BY ─────────────────────────────────────────────────────────────
  const groupM = fullSql.match(/GROUP\s+BY\s+(\w+)/i);
  if (groupM) {
    const groupCol = groupM[1].toLowerCase();
    const groups   = new Map<any, Row[]>();
    for (const r of rows) {
      const key = r[groupCol];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    let result = [...groups.entries()].map(([key, grp]) =>
      computeAggRow(selRaw, grp, groupCol, key)
    );
    result = applyOrderBy(result, fullSql);
    result = applyLimit(result, fullSql, params, pi);
    return result;
  }

  // ── No GROUP BY — single aggregate row ───────────────────────────────────
  // When there are no rows, still return a zero-filled row for .get() to consume
  const aggRow = computeAggRow(selRaw, rows, null, null);
  return [aggRow];
}

/** Compute one aggregate result row from a group of rows. */
function computeAggRow(selRaw: string, rows: Row[], groupCol: string | null, groupVal: any): Row {
  const out: Row = {};
  if (groupCol) out[groupCol] = groupVal;

  const exprs = selRaw.split(',');
  for (const expr of exprs) {
    const e = expr.trim();
    const aliasM = e.match(/(.+)\s+AS\s+(\w+)/i);
    // FIX: preserve alias case exactly — do NOT toLowerCase()
    const alias  = aliasM ? aliasM[2] : null;
    const body   = (aliasM ? aliasM[1] : e).trim();

    // COUNT(*) or COUNT(col)
    if (/^COUNT\s*\(/i.test(body)) {
      const colInner = (body.match(/^COUNT\s*\(\s*DISTINCT\s+(\w+)\s*\)/i) ?? [])[1];
      const key = alias ?? 'count(*)';
      if (colInner) {
        out[key] = new Set(rows.map(r => r[colInner.toLowerCase()])).size;
      } else {
        out[key] = rows.length;
      }
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
    // CAST(AVG(col) AS INTEGER) — statsService uses this pattern
    const castAvgM = body.match(/^CAST\s*\(\s*AVG\s*\((\w+)\)\s*AS\s+INTEGER\s*\)/i);
    if (castAvgM) {
      const col = castAvgM[1].toLowerCase();
      const key = alias ?? `avg(${col})`;
      const avg = rows.length ? rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0) / rows.length : 0;
      out[key] = Math.trunc(avg);
      continue;
    }
    // MAX(col)
    const maxM = body.match(/^MAX\s*\((\w+)\)/i);
    if (maxM) {
      const col = maxM[1].toLowerCase();
      const key = alias ?? `max(${col})`;
      out[key] = rows.length ? rows.reduce((acc, r) => Math.max(acc, Number(r[col]) || 0), -Infinity) : null;
      continue;
    }
    // MIN(col)
    const minM = body.match(/^MIN\s*\((\w+)\)/i);
    if (minM) {
      const col = minM[1].toLowerCase();
      const key = alias ?? `min(${col})`;
      out[key] = rows.length ? rows.reduce((acc, r) => Math.min(acc, Number(r[col]) || 0), Infinity) : null;
      continue;
    }
    // DISTINCT col (inside aggregate context — kept for non-leading DISTINCT)
    const distM = body.match(/^DISTINCT\s+(\w+)/i);
    if (distM) {
      const col = distM[1].toLowerCase();
      const key = alias ?? col;
      out[key] = [...new Set(rows.map(r => r[col]))];
      continue;
    }
    // Plain column reference (e.g. adapter_name AS adapterId inside a GROUP BY query)
    const plainCol = body.toLowerCase();
    if (groupCol && plainCol === groupCol) {
      out[alias ?? plainCol] = groupVal;
      continue;
    }
    out[alias ?? plainCol] = rows[0]?.[plainCol];
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
