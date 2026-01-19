import type { Repository } from "../storage/ports.js";
import { RunnerConfig } from "../schemas/runner-config.js";

/**
 * Service for managing runner configurations.
 * Provides CRUD operations for target resolution configs.
 */
export class RunnerConfigService {
  constructor(private readonly repository: Repository<RunnerConfig>) {}

  /**
   * Get or create a runner config for an organization and environment.
   * Returns existing config if found, otherwise creates a new empty one.
   */
  async getOrCreate(
    organizationId: string,
    environment: string,
  ): Promise<RunnerConfig> {
    const existing = await this.findOne(organizationId, environment);
    if (existing) {
      return existing;
    }

    return this.repository.create({
      organizationId,
      environment,
      targets: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Find a runner config by organization and environment.
   */
  async findOne(
    organizationId: string,
    environment: string,
  ): Promise<RunnerConfig | null> {
    const results = await this.repository.findMany({
      filter: {
        organizationId,
        environment,
      },
      limit: 1,
    });

    return results[0] || null;
  }

  /**
   * List all runner configs with optional filtering.
   */
  async list(filter?: {
    organizationId?: string;
    environment?: string;
  }): Promise<RunnerConfig[]> {
    return this.repository.findMany({
      filter,
      sort: { field: "updatedAt", order: "desc" },
    });
  }

  /**
   * Set a target for an organization and environment.
   * Creates the config if it doesn't exist.
   */
  async setTarget(
    organizationId: string,
    environment: string,
    targetKey: string,
    baseUrl: string,
  ): Promise<RunnerConfig> {
    const config = await this.getOrCreate(organizationId, environment);

    return this.repository.update(config.id, {
      targets: {
        ...config.targets,
        [targetKey]: baseUrl,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Delete a target from an organization and environment.
   * Returns true if the target was deleted, false if it didn't exist.
   */
  async deleteTarget(
    organizationId: string,
    environment: string,
    targetKey: string,
  ): Promise<boolean> {
    const config = await this.findOne(organizationId, environment);
    if (!config || !(targetKey in config.targets)) {
      return false;
    }

    const { [targetKey]: _, ...remainingTargets } = config.targets;

    await this.repository.update(config.id, {
      targets: remainingTargets,
      updatedAt: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Get a target base URL for an organization and environment.
   * Returns undefined if the target doesn't exist.
   */
  async getTarget(
    organizationId: string,
    environment: string,
    targetKey: string,
  ): Promise<string | undefined> {
    const config = await this.findOne(organizationId, environment);
    return config?.targets[targetKey];
  }

  /**
   * Delete an entire runner config.
   */
  async delete(organizationId: string, environment: string): Promise<boolean> {
    const config = await this.findOne(organizationId, environment);
    if (!config) {
      return false;
    }

    await this.repository.delete(config.id);
    return true;
  }
}
