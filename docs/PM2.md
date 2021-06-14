# Deploying with PM2

The package supports PM2 out-of-the-box, so you can easily use it to scale processes. However, this is still subject of a horizontal scaling environment and you should use the recommended tools, like Redis drivers for any feature, to avoid data duplication and have a better centralized dataset.

```bash
$ pm2 start bin/pm2.js --name=uws-server -i max
```

You can also easily scale the processes in and out:

```bash
$ pm2 scale uws-server 5
```

```
┌─────┬───────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name          │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼───────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0   │ uws-server    │ default     │ 0.0.1   │ cluster │ 10132    │ 3m     │ 0    │ online    │ 0%       │ 49.4mb   │ vagrant  │ disabled │
│ 1   │ uws-server    │ default     │ 0.0.1   │ cluster │ 10139    │ 3m     │ 0    │ online    │ 0%       │ 50.0mb   │ vagrant  │ disabled │
│ 2   │ uws-server    │ default     │ 0.0.1   │ cluster │ 10248    │ 2m     │ 0    │ online    │ 0%       │ 49.4mb   │ vagrant  │ disabled │
│ 3   │ uws-server    │ default     │ 0.0.1   │ cluster │ 10828    │ 28s    │ 0    │ online    │ 0%       │ 48.4mb   │ vagrant  │ disabled │
│ 4   │ uws-server    │ default     │ 0.0.1   │ cluster │ 10835    │ 28s    │ 0    │ online    │ 0%       │ 48.1mb   │ vagrant  │ disabled │
└─────┴───────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

**Remember, if you are scaling processes or nodes, make sure to NOT use the local driver since it won't talk effectively between processes/nodes, and you should use a replicating driver like Redis. [See Environment Variables for adapters](ENV.md#adapters).**
