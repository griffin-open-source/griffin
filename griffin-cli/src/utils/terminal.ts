import pc from "picocolors";
import ora, { Ora } from "ora";
import enquirer from "enquirer";
import Table from "cli-table3";

/**
 * Color utilities
 */
export const colors = {
  cyan: pc.cyan,
  green: pc.green,
  yellow: pc.yellow,
  red: pc.red,
  blue: pc.blue,
  magenta: pc.magenta,
  gray: pc.gray,
  dim: pc.dim,
  bold: pc.bold,
  underline: pc.underline,
} as const;

/**
 * Unified Terminal interface for all CLI interactions
 */
export class Terminal {
  /**
   * Log info message with icon
   */
  info(message: string): void {
    console.log(pc.blue("ℹ"), message);
  }

  /**
   * Log success message with icon
   */
  success(message: string): void {
    console.log(pc.green("✔"), message);
  }

  /**
   * Log warning message with icon
   */
  warn(message: string): void {
    console.log(pc.yellow("⚠"), message);
  }

  /**
   * Log error message with icon to stderr
   */
  error(message: string): void {
    console.error(pc.red("✖"), message);
  }

  /**
   * Log plain message (no styling)
   */
  log(message: string): void {
    console.log(message);
  }

  /**
   * Log dimmed/secondary message
   */
  dim(message: string): void {
    console.log(pc.dim(message));
  }

  /**
   * Log a blank line
   */
  blank(): void {
    console.log("");
  }

  /**
   * Create a spinner for async operations
   */
  spinner(text: string): Ora {
    return ora(text);
  }

  /**
   * Ask for confirmation (yes/no)
   */
  async confirm(message: string, initial = false): Promise<boolean> {
    const response = await enquirer.prompt<{ confirmed: boolean }>({
      type: "confirm",
      name: "confirmed",
      message,
      initial,
    });
    return response.confirmed;
  }

  /**
   * Prompt user to select from a list
   */
  async select<T extends string>(message: string, choices: T[]): Promise<T> {
    const response = await enquirer.prompt<{ selected: T }>({
      type: "select",
      name: "selected",
      message,
      choices,
    });
    return response.selected;
  }

  /**
   * Prompt user for text input
   */
  async input(message: string, initial?: string): Promise<string> {
    const response = await enquirer.prompt<{ value: string }>({
      type: "input",
      name: "value",
      message,
      initial,
    });
    return response.value;
  }

  /**
   * Create a formatted table
   */
  table(options?: { head?: string[]; colWidths?: number[] }): Table.Table {
    return new Table({
      head: options?.head,
      style: { head: ["cyan"] },
    });
  }

  /**
   * Print a formatted table
   */
  printTable(data: Array<Record<string, any>>, columns?: string[]): void {
    if (data.length === 0) {
      this.dim("(no data)");
      return;
    }

    const cols = columns || Object.keys(data[0]);
    const table = this.table({ head: cols });

    for (const row of data) {
      table.push(cols.map((col) => row[col]?.toString() || ""));
    }

    console.log(table.toString());
  }

  /**
   * Access to color functions
   */
  get colors() {
    return colors;
  }

  /**
   * Exit process with error code
   */
  exit(code: number): never {
    process.exit(code);
  }
}

/**
 * Default terminal instance
 */
export const terminal = new Terminal();
