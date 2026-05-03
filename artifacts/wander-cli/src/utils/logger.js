import chalk from 'chalk';

// ─── Structured terminal logger ───────────────────────────────────────────────
// All terminal output in the CLI goes through here — never raw console.log.

export const logger = {
  info:    (msg) => console.log(chalk.cyan('ℹ') + '  ' + chalk.white(msg)),
  success: (msg) => console.log(chalk.green('✔') + '  ' + chalk.white(msg)),
  warn:    (msg) => console.log(chalk.yellow('⚠') + '  ' + chalk.yellow(msg)),
  error:   (msg) => console.error(chalk.red('✖') + '  ' + chalk.red(msg)),
  dim:     (msg) => console.log(chalk.dim(msg)),
  blank:   ()    => console.log(''),
};
