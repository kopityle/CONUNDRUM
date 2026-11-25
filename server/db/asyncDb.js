'use strict';

// Репозитории работают с одним и тем же API независимо от того, где живёт база:
// в локальном SQLite-файле или во внешнем libSQL/Turso. Оба варианта дают
// асинхронный prepare(sql).get/all/run, поэтому вызовы нужно await-ить.

const normalizeArg = (value) => value === undefined ? null : value;

function fromLibsql(client) {
    return {
        __asyncDb: true,
        prepare(sql) {
            return {
                async get(...args) {
                    const result = await client.execute({ sql, args: args.map(normalizeArg) });
                    return result.rows[0] || null;
                },
                async all(...args) {
                    const result = await client.execute({ sql, args: args.map(normalizeArg) });
                    return result.rows;
                },
                async run(...args) {
                    const result = await client.execute({ sql, args: args.map(normalizeArg) });
                    return { changes: Number(result.rowsAffected) };
                }
            };
        },
        async exec(sql) {
            await client.executeMultiple(sql);
        },
        close() {
            client.close();
        }
    };
}

function toAsyncDb(db) {
    if (!db) throw new Error('Database is not initialized');
    if (db.__asyncDb) return db;

    return {
        __asyncDb: true,
        prepare(sql) {
            const statement = db.prepare(sql);
            return {
                async get(...args) {
                    return statement.get(...args.map(normalizeArg)) || null;
                },
                async all(...args) {
                    return statement.all(...args.map(normalizeArg));
                },
                async run(...args) {
                    return statement.run(...args.map(normalizeArg));
                }
            };
        },
        async exec(sql) {
            db.exec(sql);
        },
        close() {
            db.close();
        }
    };
}

module.exports = { fromLibsql, toAsyncDb };
