import { randomUUID } from "node:crypto";
import { Repository, QueryOptions, Filter } from "../../ports.js";

/**
 * In-memory implementation of Repository.
 * Useful for testing and development.
 */
export class MemoryRepository<
  T extends { id: string },
> implements Repository<T> {
  private data: Map<string, T> = new Map();

  async create(data: Omit<T, "id">): Promise<T> {
    const id = randomUUID();
    const entity = { ...data, id } as T;
    this.data.set(id, entity);
    return entity;
  }

  async findById(id: string): Promise<T | null> {
    return this.data.get(id) ?? null;
  }

  async findMany(options?: QueryOptions<T>): Promise<T[]> {
    let results = Array.from(this.data.values());

    // Apply filter
    if (options?.filter) {
      results = results.filter((item) =>
        this.matchesFilter(item, options.filter!),
      );
    }

    // Apply sort
    if (options?.sort) {
      const { field, order } = options.sort;
      results.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return order === "asc" ? comparison : -comparison;
      });
    }

    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit;

    if (limit !== undefined) {
      results = results.slice(offset, offset + limit);
    } else if (offset > 0) {
      results = results.slice(offset);
    }

    return results;
  }

  async update(id: string, data: Partial<Omit<T, "id">>): Promise<T> {
    const existing = this.data.get(id);
    if (!existing) {
      throw new Error(`Entity with id ${id} not found`);
    }
    const updated = { ...existing, ...data } as T;
    this.data.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.data.has(id)) {
      throw new Error(`Entity with id ${id} not found`);
    }
    this.data.delete(id);
  }

  async count(filter?: Filter<T>): Promise<number> {
    if (!filter) {
      return this.data.size;
    }
    const results = Array.from(this.data.values());
    return results.filter((item) => this.matchesFilter(item, filter)).length;
  }

  /**
   * Check if an item matches a filter.
   */
  private matchesFilter(item: T, filter: Filter<T>): boolean {
    for (const [key, condition] of Object.entries(filter)) {
      const itemValue = item[key as keyof T];

      // Simple equality
      if (typeof condition !== "object" || condition === null) {
        if (itemValue !== condition) {
          return false;
        }
        continue;
      }

      // Operator-based conditions
      const operators = condition as any;

      if ("$in" in operators && !operators.$in.includes(itemValue)) {
        return false;
      }
      if ("$gt" in operators && !(itemValue > operators.$gt)) {
        return false;
      }
      if ("$gte" in operators && !(itemValue >= operators.$gte)) {
        return false;
      }
      if ("$lt" in operators && !(itemValue < operators.$lt)) {
        return false;
      }
      if ("$lte" in operators && !(itemValue <= operators.$lte)) {
        return false;
      }
      if ("$ne" in operators && itemValue === operators.$ne) {
        return false;
      }
    }

    return true;
  }

  /**
   * Clear all data (useful for testing).
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Get all data (useful for complex queries via execute()).
   */
  getAll(): T[] {
    return Array.from(this.data.values());
  }
}
