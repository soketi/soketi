import { Cli } from './cli';

let cli = new Cli();

let yargs = require('yargs')
    .usage('Usage: uws-server <command> [options]')
    .command('start', 'Start the server.', yargs => cli.start(yargs))
    .demandCommand(1, 'Please provide a valid command.')
    .help('help')
    .alias('help', 'h');

yargs.$0 = '';

let argv = yargs.argv;
