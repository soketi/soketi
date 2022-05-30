#! /usr/bin/env node

const { Cli } = require('./../dist/cli/cli');

process.title = 'soketi-server';

if (process.argv[3] && process.argv[3].indexOf("--config=") > -1) {
  console.log(process.argv[3]);
    config = {config: process.argv[3].replace("--config=", "")}
    Cli.startWithPm2(config);
} else {
    Cli.startWithPm2();
}
