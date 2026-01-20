#!/usr/bin/env node

import { Command } from "commander";
import { executeInit } from "./commands/init.js";
import { executeValidate } from "./commands/validate.js";
import { executeGenerateKey } from "./commands/generate-key.js";

// Local commands
import { executeRunLocal } from "./commands/local/run.js";

// Hub commands
import { executeConnect } from "./commands/hub/connect.js";
import { executeStatus } from "./commands/hub/status.js";
import { executeRuns } from "./commands/hub/runs.js";
import { executePlan } from "./commands/hub/plan.js";
import { executeApply } from "./commands/hub/apply.js";
import { executeRun } from "./commands/hub/run.js";

const program = new Command();

program
  .name("griffin")
  .description("Griffin CLI - Monitoring as Code")
  .version("1.0.0");

// Top-level commands
program
  .command("init")
  .description("Initialize griffin in the current directory")
  .option(
    "--project <name>",
    "Project ID (defaults to package.json name or directory name)",
  )
  .action(async (options) => {
    await executeInit(options);
  });

program
  .command("validate")
  .description("Validate test plan files without syncing")
  .action(async () => {
    await executeValidate();
  });

program
  .command("generate-key")
  .description("Generate a cryptographically secure API key for authentication")
  .action(async () => {
    await executeGenerateKey();
  });

// Local command group
const local = program.command("local").description("Local test execution");

local
  .command("run")
  .description("Run tests locally against an environment")
  .option(
    "--env <name>",
    "Environment to run against (uses default if not specified)",
  )
  .action(async (options) => {
    await executeRunLocal(options);
  });

// Hub command group
const hub = program.command("hub").description("Griffin Hub operations");

hub
  .command("connect")
  .description("Configure hub connection")
  .requiredOption("--url <url>", "Hub URL")
  .option("--token <token>", "API authentication token")
  .action(async (options) => {
    await executeConnect(options);
  });

hub
  .command("status")
  .description("Show hub connection status")
  .action(async () => {
    await executeStatus();
  });

hub
  .command("runs")
  .description("Show recent runs from the hub")
  .option("--plan <name>", "Filter by plan name")
  .option("--limit <number>", "Number of runs to show", "10")
  .action(async (options) => {
    await executeRuns({
      ...options,
      limit: parseInt(options.limit, 10),
    });
  });

hub
  .command("plan")
  .description("Show what changes would be applied")
  .option(
    "--env <name>",
    "Environment to plan for (uses default if not specified)",
  )
  .option("--json", "Output in JSON format")
  .action(async (options) => {
    await executePlan(options);
  });

hub
  .command("apply")
  .description("Apply changes to the hub")
  .option(
    "--env <name>",
    "Environment to apply to (uses default if not specified)",
  )
  .option("--auto-approve", "Skip confirmation prompt")
  .option("--dry-run", "Show what would be done without making changes")
  .action(async (options) => {
    await executeApply(options);
  });

hub
  .command("run")
  .description("Trigger a plan run on the hub")
  .requiredOption("--plan <name>", "Plan name to run")
  .requiredOption("--env <name>", "Target environment")
  .option("--wait", "Wait for run to complete")
  .action(async (options) => {
    await executeRun(options);
  });

// Parse arguments
program.parse();
