#! /usr/bin/env node

const { Cli } = require('./../dist/cli/cli');

process.title = 'soketi-server';

Cli.start();
