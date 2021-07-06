CREATE TABLE IF NOT EXISTS `apps` (
    `id` varchar(255) NOT NULL,
    `key` varchar(255) NOT NULL,
    `secret` varchar(255) NOT NULL,
    `max_connections` integer(10) NOT NULL,
    `enable_stats` tinyint(1) NOT NULL,
    `enable_client_messages` tinyint(1) NOT NULL,
    `max_backend_events_per_sec` integer(10) NOT NULL,
    `max_client_events_per_sec` integer(10) NOT NULL,
    `max_read_req_per_sec` integer(10) NOT NULL,
    `webhooks` json DEFAULT "[]",
    PRIMARY KEY (`id`)
);

INSERT INTO apps (
    id,
    `key`,
    secret,
    max_connections,
    enable_stats,
    enable_client_messages,
    max_backend_events_per_sec,
    max_client_events_per_sec,
    max_read_req_per_sec,
    webhooks
) VALUES (
    'app-id',
    'app-key',
    'app-secret',
    200,
    1,
    1,
    -1,
    -1,
    -1,
    '[]'
);
