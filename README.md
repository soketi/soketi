# soketi

<img src="assets/logo.png" width="120" />

![CI](https://github.com/soketi/soketi/workflows/CI/badge.svg?branch=master)
[![codecov](https://codecov.io/gh/soketi/soketi/branch/master/graph/badge.svg)](https://codecov.io/gh/soketi/soketi/branch/master)
[![Latest Stable Version](https://img.shields.io/github/v/release/soketi/soketi)](https://www.npmjs.com/package/@soketi/soketi)
[![Total Downloads](https://img.shields.io/npm/dt/@soketi/soketi)](https://www.npmjs.com/package/@soketi/soketi)
[![License](https://img.shields.io/npm/l/@soketi/soketi)](https://www.npmjs.com/package/@soketi/soketi)

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/soketi)](https://artifacthub.io/packages/search?repo=soketi)

[![Discord](https://img.shields.io/discord/957380329985958038?color=%235865F2&label=Discord&logo=discord&logoColor=%23fff)](https://discord.gg/VgfKCQydjb)

Next-gen, Pusher-compatible, open-source WebSockets server. Simple, fast, and resilient. 📣

## 🤝 Supporting

Soketi is meant to be open source, forever and ever. It solves issues that many developers face - the one of wanting to be limitless while testing locally or performing benchmarks. More than that, itt is also suited for production usage, either it is public for your frontend applications or internal to your team.

The frequency of releases and maintenance is based on the available time, which is tight as hell. Recently, there were issues with the maintenance and this caused infrequent updates, as well as infrequent support.

To cover some of the expenses of handling new features or having to maintain the project, we would be more than happy if you can donate towards the goal. This will ensure that Soketi will be taken care of at its full extent.

**[💰 Sponsor the development via Github Sponsors](https://github.com/sponsors/rennokki)**

<p align="center">
  <a href="https://github.com/sponsors/rennokki">
    <img src='https://cdn.jsdelivr.net/gh/rennokki/sponsorkit-assets@main/assets/sponsors.svg' alt="Logos from Sponsors" />
  </a>
</p>

## Soketi

### Blazing fast speed ⚡

The server is built on top of [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js) - a C application ported to Node.js. uWebSockets.js is demonstrated to perform at levels [_8.5x that of Fastify_](https://alexhultman.medium.com/serving-100k-requests-second-from-a-fanless-raspberry-pi-4-over-ethernet-fdd2c2e05a1e) and at least [_10x that of Socket.IO_](https://medium.com/swlh/100k-secure-websockets-with-raspberry-pi-4-1ba5d2127a23). ([_source_](https://github.com/uNetworking/uWebSockets.js))

### Cheaper than most competitors 🤑

For a $49 plan on Pusher, you get a limited amount of connections (500) and messages (30M).

With Soketi, for the price of an instance on Vultr or DigitalOcean ($5-$10), you get virtually unlimited connections, messages, and some more!

Soketi is capable to hold thousands of active connections with high traffic on less than **1 GB and 1 CPU** in the cloud. You can also [get free $100 on Vultr to try out soketi →](https://www.vultr.com/?ref=9032189-8H)

### Easy to use 👶

Whether you run your infrastructure in containers or monoliths, soketi is portable. There are multiple ways to [install](https://docs.soketi.app/getting-started/installation) and [configure](https://docs.soketi.app/getting-started/environment-variables) soketi, from single instances for development, to tens of active instances at scale with hundreds or thousands of active users.

### Pusher Protocol 📡

soketi implements the [Pusher Protocol v7](https://pusher.com/docs/channels/library\_auth\_reference/pusher-websockets-protocol#version-7-2017-11). Your existing projects that connect to Pusher requires minimal code change to make it work with Soketi - you just add the host and port and swap the credentials.

### App-based access 🔐

Just like Pusher, you can access the API and WebSockets through the [apps you define](https://docs.soketi.app/app-management/introduction). Store the data with the built-in support for static arrays, DynamoDB and SQL-based servers like Postgres.

### Production-ready! 🤖

In addition to being a good companion during local development, soketi comes with the resiliency and speed required for demanding production applications. At scale with Redis, you get the breeze of scaling as you grow.

### Built-in monitoring 📈

You just have to scrape the Prometheus metrics. Soketi offers a lot of metrics to monitor the deployment and 

## See it in action

- [Laravel chat app](https://github.com/soketi/laravel-chat-app)
- [ETH History chart](https://github.com/soketi/laravel-eth-history)

### Deployments

- [Deploy with Railway](https://github.com/soketi/soketi-railway-deploy-example)
- [Deploy with Cleavr](https://cleavr.io/cleavr-slice/how-to-install-soketi)

## Community projects

- [Soketi UI](https://github.com/Daynnnnn/soketi-ui) - manage Soketi apps via UI
- [Soketi App Manager for Filament](https://github.com/rahulhaque/soketi-app-manager-filament) - manage Soketi apps via Filament
- [Basement Chat](https://github.com/basement-chat/basement-chat) - add chat to your Laravel application
- [Simple Chat](https://github.com/kitar/simplechat) - showcased chat app built with Soketi and DynamoDB

## 📃 Documentation

[The entire documentation is available on Gitbook 🌍](https://rennokki.gitbook.io/soketi-docs/)

## 🌟 Stargazers

We really appreciate how this project turned to be such a great success. It will always remain open-source, free, and maintained. This is the real-time as it should be.

[![Stargazers over time](https://starchart.cc/soketi/soketi.svg)](https://starchart.cc/soketi/soketi)

## 🤝 Contributing

Please see [CONTRIBUTING](CONTRIBUTING.md) for details.

## ⁉ Ideas or Discussions?

Have any ideas that can make into the project? Perhaps you have questions? [Jump into the discussions board](https://github.com/soketi/soketi/discussions) or [join the Discord channel](https://discord.gg/VgfKCQydjb)

## 🔒  Security

If you discover any security related issues, please email alex@renoki.org instead of using the issue tracker.

## 🎉 Credits

- [Alex Renoki](https://github.com/rennokki)
- [Pusher Protocol](https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol)
- [All Contributors](../../contributors)
- Thank you to Bunny! 🌸
