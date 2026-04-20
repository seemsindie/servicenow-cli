/**
 * Cross-instance record diff — used by `sn diff <instance-a> <instance-b>`.
 *
 * Given two record arrays and a key field, produces a report of which
 * records are missing from each side and which records exist on both but
 * have different field values.
 */

const DEFAULT_AUDIT_FIELDS: ReadonlySet<string> = new Set([
  "sys_id",
  "sys_created_on",
  "sys_created_by",
  "sys_updated_on",
  "sys_updated_by",
  "sys_mod_count",
]);

export interface CrossDiffOptions {
  /** Field name identifying the same record on both sides. Default: "sys_id". */
  keyField?: string;
  /** If set, only compare these fields. Otherwise compare the union of keys on both sides. */
  fieldSubset?: ReadonlyArray<string>;
  /**
   * Exclude these fields from the comparison. Defaults to the audit fields
   * (sys_created_*, sys_updated_*, sys_mod_count, sys_id). The key field is
   * always implicitly excluded from per-field comparison.
   */
  excludeFields?: ReadonlySet<string>;
}

export interface FieldChange {
  a: unknown;
  b: unknown;
}

export interface DiffedRecord {
  key: string;
  changes: Record<string, FieldChange>;
}

export interface DiffReport {
  keyField: string;
  onlyInA: Array<Record<string, unknown>>;
  onlyInB: Array<Record<string, unknown>>;
  different: DiffedRecord[];
  identicalCount: number;
}

export function diffCross(
  a: ReadonlyArray<Record<string, unknown>>,
  b: ReadonlyArray<Record<string, unknown>>,
  opts: CrossDiffOptions = {}
): DiffReport {
  const keyField = opts.keyField ?? "sys_id";
  const exclude = new Set<string>([
    ...(opts.excludeFields ?? DEFAULT_AUDIT_FIELDS),
    keyField,
  ]);

  const aByKey = indexBy(a, keyField);
  const bByKey = indexBy(b, keyField);

  const onlyInA: Array<Record<string, unknown>> = [];
  const onlyInB: Array<Record<string, unknown>> = [];
  const different: DiffedRecord[] = [];
  let identical = 0;

  for (const [key, rec] of aByKey) {
    const other = bByKey.get(key);
    if (!other) {
      onlyInA.push(rec);
      continue;
    }
    const changes = compareFields(rec, other, opts.fieldSubset, exclude);
    if (Object.keys(changes).length === 0) {
      identical++;
    } else {
      different.push({ key, changes });
    }
  }
  for (const [key, rec] of bByKey) {
    if (!aByKey.has(key)) onlyInB.push(rec);
  }

  return {
    keyField,
    onlyInA,
    onlyInB,
    different,
    identicalCount: identical,
  };
}

function indexBy(
  records: ReadonlyArray<Record<string, unknown>>,
  key: string
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const r of records) {
    const v = r[key];
    if (typeof v !== "string" || v.length === 0) continue;
    map.set(v, r);
  }
  return map;
}

function compareFields(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  subset: ReadonlyArray<string> | undefined,
  exclude: ReadonlySet<string>
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  const fields = subset
    ? subset.filter((f) => !exclude.has(f))
    : uniq([...Object.keys(a), ...Object.keys(b)]).filter((f) => !exclude.has(f));

  for (const f of fields) {
    const av = normalise(a[f]);
    const bv = normalise(b[f]);
    if (av !== bv) {
      changes[f] = { a: a[f] ?? "", b: b[f] ?? "" };
    }
  }
  return changes;
}

function normalise(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}
