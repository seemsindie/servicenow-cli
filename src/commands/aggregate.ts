import { defineLeaf } from "./_leaf.ts";
import { output } from "../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "aggregate",
    description: "Aggregate queries (COUNT/SUM/AVG/MIN/MAX) via /api/now/stats/<table>",
  },
  args: {
    table: { type: "positional", description: "Table name (e.g. incident)", required: true },
    stat: {
      type: "positional",
      description: "count | sum | avg | min | max",
      required: false,
    },
    query: { type: "string", description: "Encoded query to filter records" },
    "aggregate-field": {
      type: "string",
      description: "Field to aggregate (required for sum/avg/min/max)",
    },
    "group-by": { type: "string", description: "Field to group results by" },
    "having-count": { type: "string", description: "Only return groups with count >= N" },
    "order-by": { type: "string" },
    "order-direction": { type: "string", description: "asc | desc" },
  },
  async run(ctx, args) {
    const statRaw = (args.stat as string | undefined) ?? "count";
    const stat = statRaw.toUpperCase();
    if (!["COUNT", "SUM", "AVG", "MIN", "MAX"].includes(stat)) {
      throw new Error(`Invalid stat: ${statRaw}. Use count, sum, avg, min, or max.`);
    }

    const params = new URLSearchParams();
    params.set("sysparm_count", "true");
    if (args.query) params.set("sysparm_query", args.query as string);
    if (args["group-by"]) params.set("sysparm_group_by", args["group-by"] as string);
    if (args["aggregate-field"]) {
      params.set(`sysparm_${stat.toLowerCase()}_fields`, args["aggregate-field"] as string);
    }
    if (args["having-count"]) {
      params.set("sysparm_having_count", String(parseInt(args["having-count"] as string, 10)));
    }
    if (args["order-by"]) {
      const dir = args["order-direction"] === "desc" ? "DESC" : "ASC";
      params.set("sysparm_orderby", `${dir}${args["order-by"]}`);
    }
    params.set("sysparm_display_value", "true");

    const response = await ctx.client().requestRaw(
      "GET",
      `/api/now/stats/${args.table}?${params.toString()}`
    );
    const data = (await response.json()) as { result: unknown };

    output(ctx, { table: args.table, stat, result: data.result }, { single: true });
  },
});
