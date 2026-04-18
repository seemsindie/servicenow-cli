/**
 * ServiceNow encoded query builder.
 *
 * Operators reference (from sn-11ty / GlideRecord docs):
 *   =, !=, <, <=, >, >=
 *   LIKE, NOT LIKE, STARTSWITH, ENDSWITH
 *   IN, NOT IN
 *   ISEMPTY, ISNOTEMPTY
 *   BETWEEN
 *   SAMEAS, NSAMEAS
 *   VALCHANGES, CHANGESFROM, CHANGESTO
 *   GT_FIELD, LT_FIELD
 *   MORETHAN, LESSTHAN
 *   ANYTHING
 *   RELATIVEGE, RELATIVELE
 *   DATEPART, DYNAMIC
 *
 * Logical:
 *   ^ (AND), ^OR (OR), ^NQ (new query)
 *   ORDERBY, ORDERBYDESC
 */

export class QueryBuilder {
  private parts: string[] = [];

  /** Add a condition: field operator value */
  where(field: string, operator: string, value: string | number): this {
    this.parts.push(`${field}${operator}${value}`);
    return this;
  }

  /** field = value */
  equals(field: string, value: string | number): this {
    return this.where(field, "=", value);
  }

  /** field != value */
  notEquals(field: string, value: string | number): this {
    return this.where(field, "!=", value);
  }

  /** field LIKE value */
  like(field: string, value: string): this {
    return this.where(field, "LIKE", value);
  }

  /** field STARTSWITH value */
  startsWith(field: string, value: string): this {
    return this.where(field, "STARTSWITH", value);
  }

  /** field ENDSWITH value */
  endsWith(field: string, value: string): this {
    return this.where(field, "ENDSWITH", value);
  }

  /** field IN value1,value2,value3 */
  isIn(field: string, values: string[]): this {
    return this.where(field, "IN", values.join(","));
  }

  /** field ISEMPTY */
  isEmpty(field: string): this {
    this.parts.push(`${field}ISEMPTY`);
    return this;
  }

  /** field ISNOTEMPTY */
  isNotEmpty(field: string): this {
    this.parts.push(`${field}ISNOTEMPTY`);
    return this;
  }

  /** field > value */
  greaterThan(field: string, value: string | number): this {
    return this.where(field, ">", value);
  }

  /** field < value */
  lessThan(field: string, value: string | number): this {
    return this.where(field, "<", value);
  }

  /** AND — joins next condition with ^ */
  and(): this {
    if (this.parts.length > 0) {
      this.parts.push("^");
    }
    return this;
  }

  /** OR — joins next condition with ^OR */
  or(): this {
    if (this.parts.length > 0) {
      this.parts.push("^OR");
    }
    return this;
  }

  /** ORDERBY field */
  orderBy(field: string): this {
    this.parts.push(`ORDERBY${field}`);
    return this;
  }

  /** ORDERBYDESC field */
  orderByDesc(field: string): this {
    this.parts.push(`ORDERBYDESC${field}`);
    return this;
  }

  /** Build the final encoded query string */
  build(): string {
    return this.parts.join("");
  }
}

/**
 * Convenience: create a new query builder.
 */
export function query(): QueryBuilder {
  return new QueryBuilder();
}

/**
 * Join multiple encoded query fragments with AND (^).
 */
export function joinQueries(...queries: (string | undefined | null)[]): string {
  return queries.filter(Boolean).join("^");
}
