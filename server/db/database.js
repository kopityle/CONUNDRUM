'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DEFAULT_FILENAME = path.join(__dirname, '..', 'data', 'conundrum.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    username TEXT,
    occupation TEXT,
    gender TEXT,
    created_at DATETIME
);

CREATE TABLE IF NOT EXISTS puzzles (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    share_id TEXT UNIQUE,
    name TEXT,
    game_type TEXT,
    game_data TEXT,
    tags TEXT,
    created_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS puzzle_attempts (
    id TEXT PRIMARY KEY,
    puzzle_id TEXT,
    student_name TEXT,
    score REAL,
    duration_sec INTEGER,
    wrong_words TEXT,
    created_at DATETIME,
    FOREIGN KEY (puzzle_id) REFERENCES puzzles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lti_configurations (
    resource_link_id TEXT PRIMARY KEY,
    generation_params TEXT,
    user_id TEXT,
    updated_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_puzzles_user_id_created ON puzzles(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_puzzle_id ON puzzle_attempts(puzzle_id);
`;

let database = null;

function resolveFilename(filename) {
    if (!filename || filename === ':memory:') return filename || DEFAULT_FILENAME;
    if (filename === DEFAULT_FILENAME || path.isAbsolute(filename)) return filename;
    return path.resolve(filename);
}

function createDatabase(filename = DEFAULT_FILENAME) {
    const resolved = resolveFilename(filename);
    if (resolved !== ':memory:') {
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
    }

    const db = new Database(resolved);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
    return db;
}

function getDatabase() {
    return database;
}

function initDatabase() {
    if (!database) database = createDatabase(process.env.DB_PATH || DEFAULT_FILENAME);
    return database;
}

function closeDatabase() {
    if (database) {
        database.close();
        database = null;
    }
}

module.exports = {
    createDatabase,
    getDatabase,
    initDatabase,
    closeDatabase,
    DEFAULT_FILENAME
};
