const { createHash } = require("node:crypto");

const hash = sql => createHash("sha256").update(sql).digest("hex");
const normalize = sql => sql.replace(/\r\n/g, "\n");

const migrationChecksum = sql => hash(normalize(sql));

function matchesMigrationChecksum(sql, checksum) {
  const normalized = normalize(sql);
  // Accept checksums recorded before normalization on either platform.
  return [hash(sql), hash(normalized), hash(normalized.replace(/\n/g, "\r\n"))].includes(checksum);
}

module.exports = { migrationChecksum, matchesMigrationChecksum };
