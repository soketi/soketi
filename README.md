soketi
======

<img src="assets/logo.png" width="120" />

![CI](https://github.com/soketi/soketi/workflows/CI/badge.svg?branch=master)
[![codecov](https://codecov.io/gh/soketi/soketi/branch/master/graph/badge.svg)](https://codecov.io/gh/soketi/soketi/branch/master)
[![Latest Stable Version](https://img.shields.io/github/v/release/soketi/soketi)](https://www.npmjs.com/package/@soketi/soketi)
[![Total Downloads](https://img.shields.io/npm/dt/@soketi/soketi)](https://www.npmjs.com/package/@soketi/soketi)
[![License](https://img.shields.io/npm/l/@soketi/soketi)](https://www.npmjs.com/package/@soketi/soketi)

soketi is your simple, fast, and resilient open-source WebSockets server. 📣

### Blazing fast speed ⚡

The server is built on top of [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js) - a C application ported to Node.js. uWebSockets.js is demonstrated to perform at levels [_8.5x that of Fastify_](https://alexhultman.medium.com/serving-100k-requests-second-from-a-fanless-raspberry-pi-4-over-ethernet-fdd2c2e05a1e) and at least [_10x that of Socket.IO_](https://medium.com/swlh/100k-secure-websockets-with-raspberry-pi-4-1ba5d2127a23). ([_source_](https://github.com/uNetworking/uWebSockets.js))

### Ease of use 👶

Whether you run your infrastructure in containers or monoliths, soketi got your back. There are multiple ways to [install](getting-started/installation/) and [configure](getting-started/environment-variables.md) soketi, from single instances for development, to tens of active instances at scale with hundreds or thousands of active users.

### Pusher Protocol v7 📡

soketi implements the [Pusher Protocol v7](https://pusher.com/docs/channels/library\_auth\_reference/pusher-websockets-protocol#version-7-2017-11). Therefore, any Pusher-maintained or compatible client can connect to it, bringing a plug-and-play experience for existing applications that are already compatible with this protocol.

### App-based access 🔐

You and your users can access the API and WebSockets through [Pusher-like apps](app-management/introduction.md) which serve keys and secrets to connect or authenticate requests for broadcasting events or checking channels statuses. soketi also comes built-in with support for DynamoDB and SQL-based servers like Postgres.

### Production-ready! 🤖

In addition to being a good companion during local development, soketi comes with the resiliency and speed required for demanding production applications.

### Built-in monitoring 📈

soketi just exposes the metrics to you, you just have to scrape them, whether it's a simple HTTP Client to pull the current usage, or you're using Prometheus to monitor all the connections.

## 🤝 Supporting

**soketi is meant to be free, forever. Having a good companion for developing real-time applications locally and in production should not involve any third-party and having a reliable websocket server to deploy behind a firewall makes soketi a compelling option for many applications.**

**Of course, like many open source software solutions, development is done by investing volunteer time into the project. Therefore, all donations are greatly appreciated. You can sponsor the development via **[**Github Sponsors**](https://github.com/sponsors/rennokki)**.**

## 📃 Documentation

[The entire documentation is available on Gitbook 🌍](https://rennokki.gitbook.io/soketi-docs/)

## 🤝 Contributing

Please see [CONTRIBUTING](CONTRIBUTING.md) for details.

## ⁉ Ideas or Discussions?

Have any ideas that can make into the project? Perhaps you have questions? [Jump into the discussions board](https://github.com/soketi/soketi/discussions)

## 🔒  Security

If you discover any security related issues, please email alex@renoki.org instead of using the issue tracker.

## 🎉 Credits

- [Alex Renoki](https://github.com/rennokki)
- [Pusher Protocol](https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol)
- [All Contributors](../../contributors)
