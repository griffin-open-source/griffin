#!/usr/bin/env node

import { Command } from 'commander';
import { executeRunLocal } from './commands/run-local';
import { executeConfigureRunnerHost } from './commands/configure-runner-host';
import { executeDeploy } from './commands/deploy';
import { executeLogs } from './commands/logs';
import { executeExecuteRemote } from './commands/execute-remote';

const program = new Command();

program
  .name('1test')
  .description('1test CLI - API Testing Tool')
  .version('0.1.0');

program
  .command('run-local')
  .description('Run tests locally using endpoint_host from test files')
  .option('--env <environment>', 'Environment to use (loads from __1test__/env.ts)')
  .action(async (options) => {
    await executeRunLocal(options.env);
  });

program
  .command('configure-runner-host')
  .description('Configure remote runner host')
  .argument('<host>', 'Runner host URL')
  .action(async (host: string) => {
    await executeConfigureRunnerHost(host);
  });

program
  .command('deploy')
  .description('Deploy tests to the configured runner')
  .action(async () => {
    await executeDeploy();
  });

program
  .command('logs')
  .description('View logs for a specific check')
  .argument('<check-name>', 'Name of the check')
  .action(async (checkName: string) => {
    await executeLogs(checkName);
  });

program
  .command('execute-remote')
  .description('Execute a check remotely')
  .argument('<check-name>', 'Name of the check')
  .action(async (checkName: string) => {
    await executeExecuteRemote(checkName);
  });

program.parse();
