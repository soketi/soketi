- [WebSocket Settings](#websocket-settings)
  - [Server](#server)
  - [SSL Settings](#ssl-settings)
  - [HTTP REST API](#http-rest-api)
  - [Adapters](#adapters)
- [Applications](#applications)
  - [Default Application](#default-application)
  - [Apps Manager](#apps-manager)
  - [Metrics](#metrics)
- [Rate Limiting](#rate-limiting)
  - [Events Soft Limits](#events-soft-limits)
- [Channels](#channels)
  - [Presence Channel Limits](#presence-channel-limits)
  - [Channels Soft Limits](#channels-soft-limits)
- [Databases](#databases)
  - [Redis Configuration](#redis-configuration)
- [Debugging](#debugging)
  - [Node Metadata](#node-metadata)


## WebSocket Settings

### Server

Configuration needed to specify the protocol, port and host for the server.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `PORT` | `6001` | - | The host used for both the REST API and the WebSocket server. |

### SSL Settings

Setting one of the following variables will create a SSL version of the app.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `SSL_CERT` | `''` | - | The path for SSL certificate file. |
| `SSL_KEY` | `''` | - | The path for SSL key file. |
| `SSL_PASS` | `''` | - | The passphrase for the SSL key file. |

### HTTP REST API

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `HTTP_MAX_REQUEST_SIZE` | `100` | - | The maximum size, in MB, for the total size of the request before throwing `413 Entity Too Large`. A hard limit has been set to 100 MB. |

### Adapters

For local, single-instance applications, the default local adapter is fine.

However, Redis is needed if you plan to run on multiple instances or processes at the same time to ensure availability.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `ADAPTER_DRIVER` | `local` | `redis`, `local` | The adapter driver to use to store and retrieve each app with channels' persistent data. |
| `ADAPTER_REDIS_PREFIX` | `''` | - | The Redis adapter's Pub/Sub channels prefix. |

- `redis` - Enabled Pub/Sub communication between processes/nodes, can be scaled horizontally without issues.
- `local` - There is no communication or Pub/Sub. Recommended for single-instance, single-process apps.

## Applications

### Default Application

By default, the app is using a predefined list of applications to allow access.

In case you opt-in for another `APP_MANAGER_DRIVER`, these are the variables you can change in order to change the app settings.

For the rate limiting and max connections options, setting limits to `-1` will disable the rate limiting and/or max allowed connections.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `DEFAULT_APP_ID` | `app-id` | - | The default app id for the array driver. |
| `DEFAULT_APP_KEY` | `app-key` | - | The default app key for the array driver. |
| `DEFAULT_APP_SECRET` | `app-secret` | - | The default app secret for the array driver. |
| `DEFAULT_APP_MAX_CONNS` | `-1` | - | The default app's limit of concurrent connections. |
| `DEFAULT_APP_ENABLE_CLIENT_MESSAGES` | `false` | `true`, `false` | Wether client messages should be enabled for the app. |
| `DEFAULT_APP_MAX_BACKEND_EVENTS_PER_MIN` | `-1` | - | The default app's limit of `/events` endpoint events broadcasted per minute. You can [configure rate limiting database store](#rate-limiting) |
| `DEFAULT_APP_MAX_CLIENT_EVENTS_PER_MIN` | `-1` | - | The default app's limit of client events broadcasted per minute, by a single socket. You can [configure rate limiting database store](#rate-limiting) |
| `DEFAULT_APP_MAX_READ_REQ_PER_MIN` | `-1` | - | The default app's limit of read endpoint calls per minute. You can [configure rate limiting database store](#rate-limiting) |

### Apps Manager

The apps manager manages the allowed apps to connect to the WS and the API. Defaults to the local, `array` driver predefined by the `DEFAULT_APP_*` variables.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `METRICS_ENABLED` | `false` | `true`, `false` | Wether to enable the metrics or not. For Prometheus, enabling it will expose a `/metrics` endpoint. |
| `METRICS_DRIVER` | `prometheus` | `prometheus` | The driver used to scrap the metrics. For now, only `prometheus` is available. Soon, Pushgateway will be available. |
| `METRICS_PROMETHEUS_PREFIX` | `pws_` | - | The prefix to add to the metrics in Prometheus to differentiate from other metrics in Prometheus. |

### Metrics

The metrics feature allows you to store metrics at the node level. This can easily be done under the hood with Prometheus. All you need to do is to set up your own Prometheus server and make it scrap the HTTP REST API of the each node that pWS runs on, on the `/metrics` endpoint.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `APP_MANAGER_DRIVER` | `array` | `array` | The driver used to retrieve the app. |

## Rate Limiting

Rate limiting is helping you limit the access for applications at the app level with [app settings, per se](#default-application).

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `RATE_LIMITER_DRIVER` | `local` | `local`, `redis` | The driver used for rate limiting counting. |

- `local` - Rate limiting is stored within the memory and is lost upon process exit.
- `redis` - Rate limiting is centralized in Redis using the key-value store. Recommended when having a multi-node configuration.

### Events Soft Limits

Beside the rate limiting, you can set soft limits for the incoming data, such as the maximum allowed event size or the maximum event name length.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `EVENT_MAX_CHANNELS_AT_ONCE` | `100` | - | The maximum amount of channels that the client can broadcast to from a single `/events` request. |
| `EVENT_MAX_NAME_LENGTH` | `200` | - | The maximum length of the event name that is allowed. |
| `EVENT_MAX_SIZE_IN_KB` | `100` | - | The maximum size, in KB, for the broadcasted payloads incoming from the clients. |


## Channels

### Presence Channel Limits

When dealing with presence channel, connection details must be stored within the app.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `PRESENCE_MAX_MEMBER_SIZE` | `10` | - | The maximum member size, in KB, for each member in a presence channel. |
| `PRESENCE_MAX_MEMBERS` | `100` | - | The maximum amount of members that can simultaneously be connected in a presence channel. |

### Channels Soft Limits

Beside the rate limiting, you can set soft limits for the incoming data, such as the maximum allowed event size or the maximum event name length.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `CHANNEL_MAX_NAME_LENGTH` | `100` | - | The maximum length of the channel name that is allowed. The specific-prefix names are also counted. |

## Databases

### Redis Configuration

Configuration needed to connect to a Redis server.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `DB_REDIS_HOST` | `127.0.0.1` | - | The Redis host used for `redis` driver. |
| `DB_REDIS_PORT` | `6379` | - | The Redis port used for `redis` driver. |
| `DB_REDIS_PASSWORD` | `null` | - | The Redis password used for `redis` driver. |
| `DB_REDIS_PREFIX` | `echo-server` | - | The key prefix for Redis. Only for `redis` driver. |

## Debugging

Options for application debugging. Should be disabled on production environments.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `DEBUG` | `false` | `true`, `false` | Weteher the app should be in debug mode, being very verbose with what happens behind the scenes. |

### Node Metadata

Node settings include assigning identifiers for the running node.

| Environment variable | Default | Available values | Description |
| - | - | - | - |
| `NODE_ID` | random UUIDv4 string | - | An unique ID given to the node in which the process runs. Used by other features to label data. |
| `POD_ID` | `null` | - | The Pod name if the app runs in Kubernetes. Used by other features to label data. |
