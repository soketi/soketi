#! /usr/bin/env node

const { Cli } = require('./../dist/cli/cli');

process.title = 'uws-server';

(new Cli).start();
