import type { Repository } from "../storage/ports.js";
import { RunnerConfig } from "../schemas/runner-config.js";

/**
 * Service for managing runner configurations.
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
