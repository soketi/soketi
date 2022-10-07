#! /usr/bin/env node

import { Cli } from './../dist/cli/cli.js';

process.title = 'soketi-server';

Cli.startWithPm2();
