#! /usr/bin/env node

const { Cli } = require('./../dist/cli/cli');

process.title = 'pws-server';

Cli.start();
