## What pWS does not implemented (yet) from the Pusher protocol?

### REST API

- HTTP Keep-Alive
- POST Batch Events endpoint
- POST Events and Batch Events does not return channel data in return

#### `/apps/[app_id]/channels/[channel_name]`

- The endpoint does not support `info` query parameter

#### `/apps/[app_id]/channels`

- The enedpoint does not support `filter_by_prefix` and `info` query parameters
- `user_count` parameter for presence channels is not implemented
