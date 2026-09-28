const { Sequelize } = require("sequelize");
const fs = require("node:fs");

const ssl = process.env.PGSSLMODE === "verify-full"
  ? { ca: fs.readFileSync(process.env.PGSSLROOTCERT, "utf8"), rejectUnauthorized: true }
  : process.env.PGSSLMODE === "require"
    ? { rejectUnauthorized: false }
    : undefined;

const sequelize = new Sequelize(process.env.DATABASE_URL || "postgresql://localhost/raavanan_migrated", {
  dialect: "postgres",
  logging: process.env.DB_LOG_SQL === "true" ? console.log : false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: ssl ? { ssl } : {},
});

const connectDB = async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. See API/.env.example.");
  await sequelize.authenticate();
  console.log("PostgreSQL connected.");
  return sequelize;
};

module.exports = connectDB;
module.exports.sequelize = sequelize;
