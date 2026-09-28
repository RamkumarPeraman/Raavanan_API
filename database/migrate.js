require("dotenv").config();
const fs = require("node:fs/promises");
const path = require("node:path");
const { migrationChecksum, matchesMigrationChecksum } = require("./migrationChecksum");
const connectDB = require("../config/db");
const { sequelize } = connectDB;

async function migrate() {
  await sequelize.transaction(async (transaction) => {
    await sequelize.query("SELECT pg_advisory_xact_lock(7318429)", { transaction });
    await sequelize.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())", { transaction });
    const directory = path.join(__dirname, "migrations");
    for (const name of (await fs.readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
      const sql = await fs.readFile(path.join(directory, name), "utf8");
      const checksum = migrationChecksum(sql);
      const [rows] = await sequelize.query("SELECT checksum FROM schema_migrations WHERE name = $1", { bind: [name], transaction });
      if (rows.length) {
        if (!matchesMigrationChecksum(sql, rows[0].checksum)) throw new Error(`Applied migration ${name} has changed. Add a new migration instead.`);
        continue;
      }
      await sequelize.query(sql, { transaction });
      await sequelize.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", { bind: [name, checksum], transaction });
      console.log(`Applied ${name}`);
    }
  });
}

if (require.main === module) {
  connectDB().then(migrate).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => sequelize.close());
}
module.exports = { migrate };
