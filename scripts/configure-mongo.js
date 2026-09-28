const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline/promises");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

async function hiddenPassword() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Run this command in an interactive terminal so the password can be hidden.");
  }
  process.stdout.write("MongoDB database password (input hidden): ");
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const onData = chunk => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Cancelled."));
          return;
        }
        if (character === "\b" || character === "\u007f") value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

async function main() {
  const file = path.join(__dirname, "..", ".env");
  const content = await fs.readFile(file, "utf8");
  const config = dotenv.parse(content);
  if (!config.MONGODB_URI) throw new Error("MONGODB_URI is missing from API/.env.");
  const url = new URL(config.MONGODB_URI);
  if (!["mongodb:", "mongodb+srv:"].includes(url.protocol)) throw new Error("MONGODB_URI is not a MongoDB connection string.");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let username;
  try {
    username = (await rl.question("MongoDB database username: ")).trim();
  } finally {
    rl.close();
  }
  if (!username) throw new Error("Username cannot be empty.");
  const password = await hiddenPassword();
  if (!password) throw new Error("Password cannot be empty.");
  // MongoDB URLs use a custom scheme, for which WHATWG URL does not reliably
  // escape @ and : in credentials. Build the user-info explicitly.
  const schemeEnd = config.MONGODB_URI.indexOf("://") + 3;
  const hostStart = config.MONGODB_URI.lastIndexOf("@") + 1;
  if (schemeEnd < 3 || hostStart <= schemeEnd) throw new Error("MONGODB_URI has no host.");
  const connectionString = `${config.MONGODB_URI.slice(0, schemeEnd)}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${config.MONGODB_URI.slice(hostStart)}`;

  if (config.MONGODB_DNS_SERVER) {
    require("node:dns").setServers(config.MONGODB_DNS_SERVER.split(",").map(value => value.trim()));
  }
  const client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 12000 });
  try {
    await client.connect();
    await client.db(config.MONGODB_DATABASE || "raavana_trust").listCollections({}, { nameOnly: true }).toArray();
  } finally {
    await client.close();
  }

  const updated = content.replace(/^MONGODB_URI=.*$/m, `MONGODB_URI=${connectionString}`);
  await fs.writeFile(file, updated, { mode: 0o600 });
  console.log("MongoDB credentials verified and saved to API/.env.");
}

main().catch(error => {
  // Database errors sometimes contain connection details; keep secrets off screen.
  console.error(error.name === "MongoServerError" && error.code === 8000
    ? "Atlas rejected this database username or password. API/.env was not changed."
    : `Setup failed: ${error.name}. API/.env was not changed.`);
  process.exitCode = 1;
});
