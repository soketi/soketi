pWS - Pusher (over) [uWS](https://github.com/uNetworking/uWebSockets.js)
========================================================================

![CI](https://github.com/soketi/pws/workflows/CI/badge.svg?branch=master)
[![codecov](https://codecov.io/gh/soketi/pws/branch/master/graph/badge.svg)](https://codecov.io/gh/soketi/pws/branch/master)
[![Latest Stable Version](https://img.shields.io/github/v/release/soketi/pws)](https://www.npmjs.com/package/@soketi/pws)
[![Total Downloads](https://img.shields.io/npm/dt/@soketi/pws)](https://www.npmjs.com/package/@soketi/pws)
[![License](https://img.shields.io/npm/l/@soketi/pws)](https://www.npmjs.com/package/@soketi/pws)

pWS is a free, scalable and resilient open-source Pusher drop-in alternative. 📡

The server is built on top of [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js) - a C application ported to Node.js, that claims to be running _[8.5x that of Fastify](https://alexhultman.medium.com/serving-100k-requests-second-from-a-fanless-raspberry-pi-4-over-ethernet-fdd2c2e05a1e) and at least [10x that of Socket.IO](https://medium.com/swlh/100k-secure-websockets-with-raspberry-pi-4-1ba5d2127a23). ([_source_](https://github.com/uNetworking/uWebSockets.js))_

pWS implements the [Pusher Protocol v7](https://pusher.com/docs/channels/library\_auth\_reference/pusher-websockets-protocol#version-7-2017-11) - meaning that any Pusher-maintained client can connect to it, bringing portability and plug-and-play functionality for the already-built frontend apps that you already implemented.

## 🤝 Supporting

**If you are using one or more Renoki Co. open-source packages in your production apps, in presentation demos, hobby projects, school projects or so, sponsor our work with [Github Sponsors](https://github.com/sponsors/rennokki). 📦**

## 📃 Documentation

[The entire documentation is available on Gitbook 🌍](https://rennokki.gitbook.io/soketi-pws)

## 🤝 Contributing

Please see [CONTRIBUTING](CONTRIBUTING.md) for details.

## 🔒  Security

If you discover any security related issues, please email alex@renoki.org instead of using the issue tracker.

## 🎉 Credits

- [Alex Renoki](https://github.com/rennokki)
- [Pusher Protocol](https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol)
- [All Contributors](../../contributors)
