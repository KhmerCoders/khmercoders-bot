CREATE TABLE IF NOT EXISTS blacklist_topic (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_thread_id TEXT NOT NULL UNIQUE
);
