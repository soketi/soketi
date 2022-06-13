#! /usr/bin/env node

const { Cli } = require('./../dist/cli/cli');

let yargs = require('yargs')
    .usage('Usage: soketi <command> [options]')
    .command('start', 'Start the server.', yargs => {
        return yargs.option('config', { describe: 'The path for the config file. (optional)'});
    }, (argv) => Cli.startWithPm2(argv))
    .demandCommand(1, 'Please provide a valid command.')
    .help('help')
    .alias('help', 'h');

yargs.$0 = '';

let argv = yargs.argv;

process.title = 'soketi-server';
