const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { migrationChecksum, matchesMigrationChecksum } = require("../database/migrationChecksum");

test("migration checksums accept LF and legacy CRLF across platforms", () => {
  const lf = "CREATE TABLE example (id int);\nSELECT 1;\n";
  const crlf = lf.replace(/\n/g, "\r\n");
  const legacyHash = sql => createHash("sha256").update(sql).digest("hex");
  assert.equal(migrationChecksum(lf), migrationChecksum(crlf));
  for (const stored of [legacyHash(lf), legacyHash(crlf)]) {
    assert.equal(matchesMigrationChecksum(lf, stored), true);
    assert.equal(matchesMigrationChecksum(crlf, stored), true);
    assert.equal(matchesMigrationChecksum(lf.replace("SELECT 1", "SELECT 2"), stored), false);
  }
});
