import type { InstanceConfig } from "../config.ts";
import { createAuthProvider } from "../auth/index.ts";
import { ServiceNowClient } from "./index.ts";
import { logger } from "../utils/logger.ts";

export interface InstanceInfo {
  name: string;
  url: string;
  isDefault: boolean;
  description?: string;
}

/**
 * Registry of ServiceNow clients keyed by instance name.
 * Immutable after construction — each tool call resolves its client per-request.
 */
export class InstanceRegistry {
  private readonly clients: Map<string, ServiceNowClient>;
  private readonly meta: Map<string, InstanceInfo>;
  private readonly defaultName: string;

  constructor(instances: InstanceConfig[]) {
    this.clients = new Map();
    this.meta = new Map();

    // Determine default: the one marked default, or the first one
    const explicitDefault = instances.find((i) => i.default);
    this.defaultName = explicitDefault?.name ?? instances[0]!.name;

    for (const inst of instances) {
      if (this.clients.has(inst.name)) {
        throw new Error(`Duplicate instance name: "${inst.name}"`);
      }

      const auth = createAuthProvider(inst.url, inst.auth);
      const client = new ServiceNowClient(inst.url, auth, inst.requestTimeoutMs);

      this.clients.set(inst.name, client);
      this.meta.set(inst.name, {
        name: inst.name,
        url: inst.url,
        isDefault: inst.name === this.defaultName,
        description: inst.description,
      });

      logger.info(
        `Registered instance: ${inst.name} (${inst.url})${inst.name === this.defaultName ? " [default]" : ""}`
      );
    }
  }

  /**
   * Resolve a client by instance name.
   * If `instanceName` is undefined/empty, returns the default instance client.
   * Throws a descriptive error if the instance is not found.
   */
  resolve(instanceName?: string): ServiceNowClient {
    const name = instanceName || this.defaultName;
    const client = this.clients.get(name);
    if (!client) {
      const available = [...this.clients.keys()].join(", ");
      throw new Error(
        `Unknown ServiceNow instance: "${name}". Available instances: ${available}`
      );
    }
    return client;
  }

  /**
   * Get the name of the default instance.
   */
  getDefaultName(): string {
    return this.defaultName;
  }

  /**
   * List all registered instances with metadata.
   */
  listInstances(): InstanceInfo[] {
    return [...this.meta.values()];
  }

  /**
   * Get metadata for a specific instance.
   */
  getInstanceInfo(instanceName?: string): InstanceInfo {
    const name = instanceName || this.defaultName;
    const info = this.meta.get(name);
    if (!info) {
      const available = [...this.meta.keys()].join(", ");
      throw new Error(
        `Unknown ServiceNow instance: "${name}". Available instances: ${available}`
      );
    }
    return info;
  }

  /**
   * Number of registered instances.
   */
  get size(): number {
    return this.clients.size;
  }
}
