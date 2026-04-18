/**
 * Natural-language → ServiceNow encoded query translator.
 * Ported from servicenow-mcp-server/src/tools/search.ts.
 */

interface NLPattern {
  regex: RegExp;
  build: (match: RegExpMatchArray) => { query: string; table?: string };
}

const NL_PATTERNS: NLPattern[] = [
  {
    regex: /\b(critical|high|moderate|low)\s+priority\b/i,
    build: (m) => {
      const map: Record<string, string> = { critical: "1", high: "2", moderate: "3", low: "4" };
      return { query: `priority=${map[m[1]!.toLowerCase()] ?? "1"}` };
    },
  },
  { regex: /\bassigned\s+to\s+(\S+)/i, build: (m) => ({ query: `assigned_to.user_name=${m[1]}` }) },
  {
    regex: /\b(opened|created)\s+this\s+week\b/i,
    build: () => ({
      query:
        "sys_created_onONThis week@javascript:gs.beginningOfThisWeek()@javascript:gs.endOfThisWeek()",
    }),
  },
  {
    regex: /\b(opened|created)\s+today\b/i,
    build: () => ({
      query:
        "sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()",
    }),
  },
  {
    regex: /\bupdated\s+this\s+week\b/i,
    build: () => ({
      query:
        "sys_updated_onONThis week@javascript:gs.beginningOfThisWeek()@javascript:gs.endOfThisWeek()",
    }),
  },
  { regex: /\b(open|active)\b/i, build: () => ({ query: "active=true" }) },
  { regex: /\bclosed\b/i, build: () => ({ query: "state=7" }) },
  { regex: /\bresolved\b/i, build: () => ({ query: "state=6" }) },
  { regex: /\bin\s+progress\b/i, build: () => ({ query: "state=2" }) },
  { regex: /\bon\s+hold\b/i, build: () => ({ query: "state=3" }) },
  { regex: /\bnew\b/i, build: () => ({ query: "state=1" }) },
  {
    regex: /\bemergency\s+(changes?|change\s+requests?)\b/i,
    build: () => ({ query: "type=emergency", table: "change_request" }),
  },
  {
    regex: /\bnormal\s+(changes?|change\s+requests?)\b/i,
    build: () => ({ query: "type=normal", table: "change_request" }),
  },
  {
    regex: /\bfrom\s+(\w[\w\s]*?)\s+team\b/i,
    build: (m) => ({ query: `assignment_group.nameLIKE${m[1]}` }),
  },
  {
    regex: /\b(?:about|related\s+to|regarding)\s+['"]?(\w[\w\s]*?)['"]?\s*$/i,
    build: (m) => ({ query: `short_descriptionLIKE${m[1]}^ORdescriptionLIKE${m[1]}` }),
  },
  { regex: /\bP([1-5])\b/, build: (m) => ({ query: `priority=${m[1]}` }) },
  { regex: /\bincidents?\b/i, build: () => ({ query: "", table: "incident" }) },
  { regex: /\bchanges?\b/i, build: () => ({ query: "", table: "change_request" }) },
  { regex: /\bproblems?\b/i, build: () => ({ query: "", table: "problem" }) },
];

export function translateNL(nlQuery: string): { query: string; suggestedTable?: string } {
  const parts: string[] = [];
  let suggestedTable: string | undefined;

  for (const pattern of NL_PATTERNS) {
    const match = nlQuery.match(pattern.regex);
    if (match) {
      const result = pattern.build(match);
      if (result.query) parts.push(result.query);
      if (result.table) suggestedTable = result.table;
    }
  }

  if (parts.length === 0) {
    parts.push(`short_descriptionLIKE${nlQuery}`);
  }

  return { query: parts.join("^"), suggestedTable };
}
