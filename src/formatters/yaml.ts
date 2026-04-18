import { stringify } from "yaml";

export function renderYaml(data: unknown): string {
  return stringify(data, { indent: 2 });
}
