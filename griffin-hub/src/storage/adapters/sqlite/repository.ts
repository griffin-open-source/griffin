import { Repository, QueryOptions, Filter } from "../../ports.js";

/**
 * SQLite implementation of Repository.
 *
 * TODO: Implement using better-sqlite3 or sql.js
 * - Serialize objects to JSON for storage
 * - Build WHERE clauses from Filter
 * - Handle transactions properly
 */
export class SqliteRepository<
  T extends { id: string },
> implements Repository<T> {
  constructor(
    private db: any, // TODO: Type this as Database from better-sqlite3
    private tableName: string,
  ) {}

  async create(data: Omit<T, "id">): Promise<T> {
    throw new Error("SqliteRepository.create not yet implemented");
  }

  async findById(id: string): Promise<T | null> {
    throw new Error("SqliteRepository.findById not yet implemented");
  }

  async findMany(options?: QueryOptions<T>): Promise<T[]> {
    throw new Error("SqliteRepository.findMany not yet implemented");
  }

  async update(id: string, data: Partial<Omit<T, "id">>): Promise<T> {
    throw new Error("SqliteRepository.update not yet implemented");
  }

  async delete(id: string): Promise<void> {
    throw new Error("SqliteRepository.delete not yet implemented");
  }

  async count(filter?: Filter<T>): Promise<number> {
    throw new Error("SqliteRepository.count not yet implemented");
  }
}
