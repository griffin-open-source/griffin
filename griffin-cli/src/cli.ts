#!/usr/bin/env node

import { Command } from "commander";
import { executeInit } from "./commands/init.js";
import { executeValidate } from "./commands/validate.js";
import { executeGenerateKey } from "./commands/generate-key.js";
import { executeEnvList } from "./commands/env.js";

// Local commands
import { executeRunLocal } from "./commands/local/run.js";

// Hub commands
import { executeConnect } from "./commands/hub/connect.js";
import { executeStatus } from "./commands/hub/status.js";
import { executeRuns } from "./commands/hub/runs.js";
import { executePlan } from "./commands/hub/plan.js";
import { executeApply } from "./commands/hub/apply.js";
import { executeRun } from "./commands/hub/run.js";
import { executeLogin } from "./commands/hub/login.js";
import { executeLogout } from "./commands/hub/logout.js";

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

// Environment command group
const env = program.command("env").description("Manage environments");

env
  .command("list")
  .description("List all available environments")
  .action(async () => {
    await executeEnvList();
  });

// Local command group
const local = program.command("local").description("Local test execution");

local
  .command("run [env]")
  .description("Run tests locally against an environment")
  .action(async (env, options) => {
    await executeRunLocal({ env });
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
  .command("plan [env]")
  .description("Show what changes would be applied")
  .option("--json", "Output in JSON format")
  .action(async (env, options) => {
    await executePlan({ ...options, env });
  });

hub
  .command("apply [env]")
  .description("Apply changes to the hub")
  .option("--auto-approve", "Skip confirmation prompt")
  .option("--dry-run", "Show what would be done without making changes")
  .option("--prune", "Delete plans on hub that don't exist locally")
  .action(async (env, options) => {
    await executeApply({ ...options, env });
  });

hub
  .command("run <env>")
  .description("Trigger a plan run on the hub")
  .requiredOption("--plan <name>", "Plan name to run")
  .option("--wait", "Wait for run to complete")
  .option("--force", "Run even if local plan differs from hub")
  .action(async (env, options) => {
    await executeRun({ ...options, env });
  });
hub
  .command("login")
  .description("Login to the hub")
  .action(async () => {
    await executeLogin();
  });

hub
  .command("logout")
  .description("Remove stored credentials")
  .action(async (options) => {
    await executeLogout(options);
  });

// Parse arguments
program.parse();
