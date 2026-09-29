const test = require("node:test");
const assert = require("node:assert/strict");
const { Client } = require("pg");
const { randomUUID } = require("node:crypto");

test("PostgreSQL migration and API integration", { skip: !process.env.TEST_DATABASE_URL }, async t => {
  // Every run gets a new database; existing databases are never cleared.
  const maintenance = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await maintenance.connect();
  const database = `raavanan_test_${randomUUID().replaceAll("-", "")}`;
  await maintenance.query(`CREATE DATABASE "${database}"`);
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.pathname = `/${database}`;
  process.env.DATABASE_URL = url.href;
  process.env.JWT_SECRET = "integration-test-secret";
  const { sequelize } = require("../config/db");
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await sequelize.close();
    await maintenance.query(`DROP DATABASE "${database}"`);
    await maintenance.end();
  });
  const { migrate } = require("../database/migrate");
  const { importCollections } = require("../scripts/import-mongo");
  const { ObjectId } = require("mongodb");
  const bcrypt = require("bcryptjs");
  const { defineModel } = require("../database/model");
  const User = defineModel("User");
  const Role = defineModel("Role");
  await t.test("schema migrations are repeatable", async () => {
    await migrate();
    await migrate();
    const [rows] = await sequelize.query("SELECT count(*)::int AS count FROM schema_migrations");
    assert.equal(rows[0].count, 3);
  });
  const legacyId = new ObjectId();
  const oldDate = new Date("2023-03-04T00:00:00Z");
  const hash = await bcrypt.hash("LegacyPassword123", 4);
  await t.test("failed import rolls back records and archive", async () => {
    await assert.rejects(importCollections({ users: [{ _id: legacyId, name: "Invalid", email: "bad@example.com" }] }));
    assert.equal(await User.count(), 0);
    assert.equal(await Role.count(), 0);
    const [rows] = await sequelize.query("SELECT count(*)::int AS count FROM legacy_documents");
    assert.equal(rows[0].count, 0);
  });
  await t.test("import preserves IDs, hashes, dates, nested and unknown fields", async () => {
    const counts = await importCollections({ users: [{ _id: legacyId, name: "Legacy Admin", email: "legacy@example.com", role: "super_admin", passwordHash: hash, createdAt: oldDate, updatedAt: oldDate, address: { city: "Chennai" }, oldExtraField: "kept in archive" }], old_collection: [{ _id: new ObjectId(), value: "keep" }] });
    assert.equal(counts.users, 1);
    const user = await User.findByPk(legacyId.toHexString());
    assert.equal(user.passwordHash, hash);
    assert.equal(user.createdAt.toISOString(), oldDate.toISOString());
    assert.equal(user.address.city, "Chennai");
    const [rows] = await sequelize.query("SELECT document FROM legacy_documents WHERE collection = 'users'");
    assert.equal(rows[0].document.oldExtraField, "kept in archive");
    await assert.rejects(importCollections({ users: [] }), /empty target/);
  });
  let deliveredSignupOtp;
  const mailer = require("../utils/mailer");
  mailer.sendSignupOtp = async message => { deliveredSignupOtp = message; };
  const { app, seedRoles } = require("../server");
  await seedRoles();
  await seedRoles();
  assert.equal(await Role.count(), 7);
  server = await new Promise(resolve => { const http = app.listen(0, "127.0.0.1", () => resolve(http)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(method, route, body, token) {
    const response = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    return { status: response.status, ...data };
  }
  let adminToken, memberToken, memberId, otherToken, otherId;
  await t.test("legacy login, signup, defaults and unique email", async () => {
    const admin = await request("POST", "/auth/login", { email: "legacy@example.com", password: "LegacyPassword123" });
    assert.equal(admin.status, 200); adminToken = admin.token;
    assert.equal(admin.user.id, legacyId.toHexString());
    assert.equal(admin.user.passwordHash, undefined);
    const member = await request("POST", "/auth/signup", { name: "Member", email: "member@example.com", password: "Password123", address: { city: "Madurai" } });
    assert.equal(member.status, 201); memberToken = member.token; memberId = member.user.id;
    assert.match(memberId, /^[\da-f-]{36}$/);
    assert.equal(member.user.address.country, "India");
    const other = await request("POST", "/auth/signup", { name: "Other", email: "other@example.com", password: "Password123" });
    otherToken = other.token; otherId = other.user.id;
    assert.equal((await request("POST", "/auth/signup", { name: "Duplicate", email: "MEMBER@example.com", password: "Password123" })).status, 409);
    assert.equal((await request("GET", "/health")).database, "postgresql");
  });
  await t.test("signup OTP is emailed, hashed in the database and required before account creation", async () => {
    const email = "verified-signup@example.com";
    const requested = await request("POST", "/auth/signup/request-otp", { name: "Verified Member", email, password: "Password123!" });
    assert.equal(requested.status, 200);
    assert.equal(deliveredSignupOtp.email, email);
    assert.match(deliveredSignupOtp.otp, /^\d{6}$/);

    const SignupOtp = defineModel("SignupOtp");
    const pending = await SignupOtp.unscoped().findOne({ where: { email } });
    assert.ok(pending);
    assert.notEqual(pending.otpHash, deliveredSignupOtp.otp);
    assert.notEqual(pending.signupData.passwordHash, "Password123!");
    assert.equal((await request("POST", "/auth/signup/verify-otp", { email, otp: "000000" })).status, 400);

    const verified = await request("POST", "/auth/signup/verify-otp", { email, otp: deliveredSignupOtp.otp });
    assert.equal(verified.status, 201);
    assert.equal(verified.user.email, email);
    assert.ok(verified.token);
    assert.equal(await SignupOtp.count({ where: { email } }), 0);
    assert.ok(await User.findOne({ where: { email } }));
  });
  await t.test("project CRUD, literal search, dates, validation and SQL injection resistance", async () => {
    const project = await request("POST", "/projects", { title: "100% Project", description: "Testing", category: "Education", startDate: "2024-01-01", impact: { students: 10 } }, adminToken);
    assert.equal(project.status, 201); assert.ok(project.data.id);
    const id = project.data.id;
    assert.equal((await request("GET", "/projects?search=%25")).data.length, 1);
    assert.equal((await request("GET", "/projects?search=" + encodeURIComponent("'; DROP TABLE users; --"))).data.length, 0);
    assert.equal((await request("GET", "/projects?category=education")).data.length, 1);
    const updated = await request("PUT", `/projects/${id}`, { startDate: "", progress: 50 }, adminToken);
    assert.equal(updated.data.startDate, null); assert.equal(updated.data.progress, 50);
    assert.equal((await request("PUT", `/projects/${id}`, { progress: 101 }, adminToken)).status, 400);
    assert.equal((await request("DELETE", `/projects/${id}`, undefined, adminToken)).status, 200);
    assert.equal((await request("GET", `/projects/${id}`)).status, 404);
  });
  await t.test("event registration persists JSON and prevents oversubscription", async () => {
    const event = await request("POST", "/events", { title: "One seat", description: "Testing", type: "workshop", date: "2026-12-01", time: "10:00", location: "Chennai", capacity: 1 }, adminToken);
    assert.equal(event.status, 201);
    const results = await Promise.all([request("POST", `/events/${event.data.id}/register`, {}, memberToken), request("POST", `/events/${event.data.id}/register`, {}, otherToken)]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 400]);
    const stored = await defineModel("Event").findByPk(event.data.id);
    assert.equal(stored.attendees.length, 1);
    assert.equal(stored.registered, 1);
    const winningToken = results[0].status === 201 ? memberToken : otherToken;
    assert.equal((await request("GET", "/events/registered/me", undefined, winningToken)).data.length, 1);
  });
  await t.test("messenger participants, access, reads, notifications and cascade deletion", async () => {
    const direct = await request("POST", "/messenger/conversations/direct", { participantId: memberId }, adminToken);
    assert.equal(direct.status, 201); const id = direct.data.id;
    assert.equal(direct.data.name, "Member");
    assert.equal((await request("GET", "/messenger/conversations", undefined, memberToken)).data[0].id, id);
    assert.equal((await request("GET", `/messenger/conversations/${id}`, undefined, otherToken)).status, 404);
    const message = await request("POST", `/messenger/conversations/${id}/messages`, { content: "Hello PostgreSQL" }, adminToken);
    assert.equal(message.status, 201); assert.equal(message.data.sender.id, legacyId.toHexString());
    assert.equal((await request("GET", `/messenger/conversations/${id}`, undefined, memberToken)).data.unreadCount, 1);
    assert.equal((await request("GET", "/messenger/notifications", undefined, memberToken)).data[0].isRead, false);
    for (let i = 0; i < 2; i++) assert.equal((await request("POST", `/messenger/conversations/${id}/read`, {}, memberToken)).status, 200);
    const messages = await request("GET", `/messenger/conversations/${id}/messages`, undefined, memberToken);
    assert.equal(messages.data[0].readBy.length, 2);
    assert.equal((await request("GET", `/messenger/conversations/${id}`, undefined, memberToken)).data.unreadCount, 0);
    assert.equal((await request("DELETE", `/messenger/messages/${message.data.id}`, undefined, memberToken)).status, 403);
    assert.equal((await request("DELETE", `/messenger/messages/${message.data.id}`, undefined, adminToken)).status, 200);
    assert.equal((await request("GET", `/messenger/conversations/${id}`, undefined, memberToken)).data.lastMessage, "");
    await request("POST", `/messenger/conversations/${id}/messages`, { content: "Cascade" }, adminToken);
    assert.equal((await request("DELETE", `/messenger/conversations/${id}`, undefined, adminToken)).status, 200);
    assert.equal(await defineModel("Message").count(), 0);
    assert.equal(await defineModel("Notification").count(), 0);
    const group = await request("POST", "/messenger/conversations/group", { name: "Team", participantIds: [memberId, otherId] }, adminToken);
    assert.equal(group.status, 201);
    const updated = await request("PUT", `/messenger/conversations/${group.data.id}/group`, { name: "Renamed", participantIds: [memberId] }, adminToken);
    assert.equal(updated.data.participants.length, 2);
  });
  await t.test("donation decimal totals, settings merge, volunteer password privacy and custom roles", async () => {
    for (const amount of [10.1, 20.2]) assert.equal((await request("POST", "/donations", { name: "Donor", email: "donor@example.com", phone: "1234567890", amount })).status, 201);
    const stats = await request("GET", "/donations/stats", undefined, adminToken);
    assert.equal(stats.data.totalAmount, 30.3); assert.equal(stats.data.totalDonations, 2);
    await request("PUT", "/admin-settings", { bankDetails: { branch: "Chennai" } }, adminToken);
    const settings = await request("GET", "/admin-settings");
    assert.equal(settings.data.bankDetails.branch, "Chennai"); assert.equal(settings.data.bankDetails.bank, "Canara Bank");
    const volunteer = await request("POST", "/volunteers/register", { fullName: "Volunteer", email: "volunteer@example.com", phone: "1234567890", password: "Password123" });
    assert.equal(volunteer.status, 201); assert.equal(volunteer.data.passwordHash, undefined);
    assert.equal((await request("POST", "/volunteers/login", { email: "volunteer@example.com", password: "Password123" })).status, 200);
    const role = await request("POST", "/roles", { name: "custom_role", displayName: "Custom Role", permissions: ["projects:read"] }, adminToken);
    assert.equal(role.status, 201);
    const assigned = await request("PATCH", `/roles/assign/${memberId}`, { roleId: role.data.id }, adminToken);
    assert.equal(assigned.status, 200); assert.equal(assigned.data.role, "custom_role");
  });
  await t.test("every content model supports validated PostgreSQL writes", async () => {
    const seeds = require("../data/contentSeeds");
    for (const [name, rows] of [["Blog", seeds.blogSeeds], ["Report", seeds.reportSeeds], ["VolunteerOpportunity", seeds.volunteerOpportunitySeeds]]) {
      for (const row of rows) {
        const record = await defineModel(name).create(row);
        assert.ok(record._id);
      }
    }
    assert.equal((await request("GET", "/reports?search=" + encodeURIComponent("%"))).status, 200);
    const service = await request("POST", "/services", { name: "Help", email: "help@example.com", phone: "1234567890", message: "Assistance" });
    assert.equal(service.status, 201);
    for (const route of ["/blogs", "/reports", "/volunteer-opportunities", "/users", "/roles", "/volunteers", "/services"]) assert.equal((await request("GET", route, undefined, adminToken)).status, 200, route);
  });
});
