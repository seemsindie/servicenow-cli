import { defineCommand } from "citty";
import list from "./list.ts";
import baseCreate from "./base-create.ts";
import categoryCreate from "./category-create.ts";
import articleList from "./article-list.ts";
import articleGet from "./article-get.ts";
import articleCreate from "./article-create.ts";
import articleUpdate from "./article-update.ts";
import articlePublish from "./article-publish.ts";

export default defineCommand({
  meta: { name: "kb", description: "Manage ServiceNow Knowledge base" },
  subCommands: {
    list,
    "base-create": baseCreate,
    "category-create": categoryCreate,
    "article-list": articleList,
    "article-get": articleGet,
    "article-create": articleCreate,
    "article-update": articleUpdate,
    "article-publish": articlePublish,
  },
});
