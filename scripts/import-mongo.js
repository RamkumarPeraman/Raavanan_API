require("dotenv").config();
if (process.env.MONGODB_DNS_SERVER) {
  require("node:dns").setServers(process.env.MONGODB_DNS_SERVER.split(",").map(value => value.trim()));
}
// Import into a separate database when the API's current database already has data.
// Apply this before loading the shared Sequelize connection.
if (require.main === module && process.env.MONGO_IMPORT_DATABASE) {
  if (!/^[a-z][a-z0-9_]*$/.test(process.env.MONGO_IMPORT_DATABASE)) {
    throw new Error("MONGO_IMPORT_DATABASE must contain only lowercase letters, digits and underscores, starting with a letter.");
  }
  const target = new URL(process.env.DATABASE_URL);
  target.pathname = `/${process.env.MONGO_IMPORT_DATABASE}`;
  process.env.DATABASE_URL = target.href;
}
const fs = require("node:fs/promises");
const path = require("node:path");
const { MongoClient, BSON } = require("mongodb");
const { EJSON } = BSON;
const connectDB = require("../config/db");
const { sequelize } = connectDB;
const { migrate } = require("../database/migrate");
const definitions = require("../database/definitions.json");
const { defineModel } = require("../database/model");
const { normalizeRole } = require("../utils/userHelpers");

const collectionsToModels = {
  roles: "Role", users: "User", volunteers: "Volunteer", projects: "Project", events: "Event",
  blogs: "Blog", reports: "Report", volunteeropportunities: "VolunteerOpportunity",
  donations: "Donation", services: "Service", adminsettings: "AdminSettings",
  conversations: "Conversation", messages: "Message", notifications: "Notification",
};

function plain(value) {
  if (value == null || value instanceof Date) return value;
  if (value._bsontype === "ObjectId") return value.toHexString();
  if (["Decimal128", "Long", "Int32", "Double"].includes(value._bsontype)) return value.toString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
}

async function importCollections(collections) {
  const counts = {};
  return sequelize.transaction(async transaction => {
    await sequelize.query("SELECT pg_advisory_xact_lock(7318429)", { transaction });
    // Prevent concurrent API writes during the one-time import.
    const tables = [...Object.values(definitions).map(def => `"${def.table}"`), "legacy_documents"];
    await sequelize.query(`LOCK TABLE ${tables.join(", ")} IN ACCESS EXCLUSIVE MODE`, { transaction });
    for (const name of Object.keys(definitions)) {
      if (await defineModel(name).count({ transaction })) throw new Error("Import requires an empty target database. Use a new PostgreSQL database and import before starting the API.");
    }
    const [archived] = await sequelize.query("SELECT count(*)::int AS count FROM legacy_documents", { transaction });
    if (archived[0].count) throw new Error("The target already contains an import archive.");

    // Archive every source field and collection, including data outside current models.
    for (const [collection, documents] of Object.entries(collections)) {
      counts[collection] = documents.length;
      for (const document of documents) {
        if (document._id == null) throw new Error(`Missing _id in ${collection}.`);
        await sequelize.query("INSERT INTO legacy_documents (collection, source_id, document) VALUES ($1, $2, $3::jsonb)", {
          bind: [collection, String(plain(document._id)), JSON.stringify(EJSON.serialize(document, { relaxed: false }))], transaction,
        });
      }
    }
    for (const [collection, name] of Object.entries(collectionsToModels)) {
      const Model = defineModel(name);
      for (const document of collections[collection] || []) {
        const data = plain(document);
        data._id = String(data._id);
        if (name === "User") {
          data.role = normalizeRole(data.role || "member");
          // Older deployments may predate the roles collection.
          await defineModel("Role").findOrCreate({ where: { name: data.role }, defaults: { displayName: data.role.replaceAll("_", " "), permissions: [], isSystem: true }, transaction });
        }
        await Model.unscoped().create(data, { transaction });
      }
      if (name !== "Role") {
        const imported = await Model.count({ transaction });
        if (imported !== (counts[collection] || 0)) throw new Error(`Count verification failed for ${collection}.`);
      }
    }
    const [verified] = await sequelize.query("SELECT collection, count(*)::int AS count FROM legacy_documents GROUP BY collection", { transaction });
    for (const row of verified) if (row.count !== counts[row.collection]) throw new Error(`Archive verification failed for ${row.collection}.`);
    return counts;
  });
}

async function readExport(directory) {
  const collections = {};
  for (const file of await fs.readdir(directory)) {
    if (!/\.(json|jsonl|ndjson)$/i.test(file)) continue;
    const content = (await fs.readFile(path.join(directory, file), "utf8")).trim();
    const name = decodeURIComponent(file.replace(/\.(json|jsonl|ndjson)$/i, ""));
    collections[name] = !content ? [] : content.startsWith("[") ? EJSON.parse(content) : content.split(/\r?\n/).filter(Boolean).map(line => EJSON.parse(line));
    if (!Array.isArray(collections[name])) throw new Error(`Expected an array or JSON lines in ${file}.`);
  }
  return collections;
}

async function main() {
  let client;
  try {
    let collections;
    if (process.env.MONGO_EXPORT_DIR) collections = await readExport(path.resolve(process.env.MONGO_EXPORT_DIR));
    else {
      if (!process.env.MONGODB_URI || !process.env.MONGODB_DATABASE) throw new Error("Set MONGODB_URI and MONGODB_DATABASE, or MONGO_EXPORT_DIR. An Atlas website URL is not a driver connection string.");
      client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
      await client.connect();
      const db = client.db(process.env.MONGODB_DATABASE);
      collections = {};
      for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
        if (name.startsWith("system.")) continue;
        collections[name] = await db.collection(name).find({}).toArray();
      }
    }
    if (!Object.values(collections).some(documents => documents.length)) throw new Error("Source contains no records; nothing was imported.");
    const backup = path.join(__dirname, "..", "backups", `mongo-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    await fs.mkdir(backup, { recursive: true });
    for (const [name, documents] of Object.entries(collections)) {
      // Collection names are not trusted filesystem paths.
      await fs.writeFile(path.join(backup, `${encodeURIComponent(name)}.json`), EJSON.stringify(documents, { relaxed: false }), { flag: "wx" });
    }
    console.log(`Source backup saved to ${backup}`);
    await connectDB();
    await migrate();
    const counts = await importCollections(collections);
    console.log(`Import committed to PostgreSQL database ${new URL(process.env.DATABASE_URL).pathname.slice(1)}; source records were not modified.`);
    console.table(counts);
  } finally {
    if (client) await client.close();
    await sequelize.close();
  }
}

if (require.main === module) main().catch(error => {
  console.error("Import failed; target data transaction was rolled back:", error.name, error.original?.code || "", error.name === "Error" ? error.message : "Check the source data and connection settings.");
  process.exitCode = 1;
});
module.exports = { importCollections, readExport, plain };
