const express = require("express");
const { Op } = require("sequelize");
const { body } = require("express-validator");
const { sequelize } = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { handleValidation } = require("../middleware/validation");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { sanitizeUser } = require("../utils/userHelpers");
const router = express.Router();
router.use(authenticate);
const userFields = ["_id", "name", "email", "role", "profileImage", "lastActive"];
const hasUser = (conversation, id) => conversation.participants.some(p => p.user === id);
const canManage = (conversation, user) => conversation.createdBy === user.id || ["admin", "super_admin"].includes(user.role);
const missingUser = id => ({ id, name: "Deleted user", email: "", role: "member", profileImage: null, lastActive: null, isDeleted: true });
async function userMap(ids) {
  const users = await User.findAll({ where: { _id: { [Op.in]: [...new Set(ids.filter(Boolean))] } }, attributes: userFields });
  return new Map(users.map(user => [user._id, sanitizeUser(user)]));
}
async function formatConversation(conversation, currentUserId) {
  const users = await userMap(conversation.participants.map(p => p.user));
  const self = conversation.participants.find(p => p.user === currentUserId);
  const unreadCount = await Message.count({ where: { conversation: conversation._id, sender: { [Op.ne]: currentUserId }, createdAt: { [Op.gt]: self?.lastReadAt || new Date(0) } } });
  return {
    id: conversation._id, type: conversation.type,
    name: conversation.type === "group" ? conversation.name : conversation.participants.filter(p => p.user !== currentUserId).map(p => users.get(p.user)?.name || "Deleted user").join(", "),
    participants: conversation.participants.map(p => ({ ...p, user: users.get(p.user) || missingUser(p.user) })),
    createdBy: conversation.createdBy, unreadCount,
    lastMessage: conversation.lastMessage?.text || "",
    lastMessageAt: conversation.lastMessage?.sentAt || conversation.updatedAt,
    lastMessageSenderId: conversation.lastMessage?.sender || null,
  };
}
async function formatMessages(messages) {
  const users = await userMap(messages.map(m => m.sender));
  return messages.map(m => ({ id: m._id, conversationId: m.conversation, sender: users.get(m.sender) || missingUser(m.sender), content: m.content, createdAt: m.createdAt, updatedAt: m.updatedAt, readBy: m.readBy.map(r => ({ userId: r.user, seenAt: r.seenAt })) }));
}
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
async function getConversation(id, user, transaction) {
  const conversation = await Conversation.findByPk(id, transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {});
  if (!conversation || !hasUser(conversation, user.id)) fail(404, "Conversation not found.");
  return conversation;
}
async function validateParticipants(ids, transaction) {
  const count = await User.count({ where: { _id: { [Op.in]: ids }, status: "active" }, transaction });
  if (ids.length < 2 || count !== ids.length) fail(400, "Select at least two valid active users.");
}
router.get("/contacts", async (req, res) => {
  const users = await User.findAll({ where: { _id: { [Op.ne]: req.user.id }, status: "active" }, attributes: userFields, order: [["name", "ASC"]] });
  res.json({ success: true, data: users.map(sanitizeUser) });
});
router.get("/conversations", async (req, res) => {
  const conversations = await Conversation.findAll({ where: { participants: { [Op.contains]: [{ user: req.user.id }] } }, order: [["updatedAt", "DESC"]] });
  res.json({ success: true, data: await Promise.all(conversations.map(c => formatConversation(c, req.user.id))) });
});
router.post("/conversations/direct", [body("participantId").isString().notEmpty(), handleValidation], async (req, res) => {
  const ids = [...new Set([req.user.id, req.body.participantId])];
  await validateParticipants(ids);
  const [conversation] = await Conversation.findOrCreate({ where: { directKey: [...ids].sort().join(":") }, defaults: { type: "direct", createdBy: req.user.id, participants: ids.map(user => ({ user, lastReadAt: user === req.user.id ? new Date() : null })) } });
  res.status(201).json({ success: true, data: await formatConversation(conversation, req.user.id) });
});
router.post("/conversations/group", [body("name").trim().notEmpty(), body("participantIds").isArray({ min: 1 }), body("participantIds.*").isString(), handleValidation], async (req, res) => {
  const ids = [...new Set([req.user.id, ...req.body.participantIds])];
  await validateParticipants(ids);
  const conversation = await Conversation.create({ type: "group", name: req.body.name, createdBy: req.user.id, participants: ids.map(user => ({ user, lastReadAt: user === req.user.id ? new Date() : null })) });
  res.status(201).json({ success: true, data: await formatConversation(conversation, req.user.id) });
});
router.get("/conversations/:id/messages", async (req, res) => {
  const conversation = await getConversation(req.params.id, req.user);
  const messages = await Message.findAll({ where: { conversation: conversation._id }, order: [["createdAt", "ASC"], ["_id", "ASC"]] });
  res.json({ success: true, data: await formatMessages(messages) });
});
router.get("/conversations/:id", async (req, res) => {
  res.json({ success: true, data: await formatConversation(await getConversation(req.params.id, req.user), req.user.id) });
});
router.post("/conversations/:id/messages", [body("content").trim().isLength({ min: 1, max: 3000 }), handleValidation], async (req, res) => {
  const message = await sequelize.transaction(async transaction => {
    const conversation = await getConversation(req.params.id, req.user, transaction);
    const sender = await User.findByPk(req.user.id, { transaction });
    if (!sender) fail(401, "User not found.");
    const message = await Message.create({ conversation: conversation._id, sender: req.user.id, content: req.body.content, readBy: [{ user: req.user.id, seenAt: new Date() }] }, { transaction });
    conversation.lastMessage = { text: message.content, sender: req.user.id, sentAt: message.createdAt };
    conversation.participants = conversation.participants.map(p => ({ ...p, lastReadAt: p.user === req.user.id ? message.createdAt : p.lastReadAt }));
    await conversation.save({ transaction });
    const recipients = conversation.participants.filter(p => p.user !== req.user.id);
    await Notification.bulkCreate(recipients.map(p => ({ user: p.user, type: conversation.type === "group" ? "group_message" : "direct_message", title: conversation.type === "group" ? `${sender.name} in ${conversation.name}` : `New message from ${sender.name}`, message: message.content, conversation: conversation._id, relatedMessage: message._id, sender: req.user.id })), { transaction, validate: true, individualHooks: true });
    return message;
  });
  res.status(201).json({ success: true, data: (await formatMessages([message]))[0] });
});
router.post("/conversations/:id/read", async (req, res) => {
  await sequelize.transaction(async transaction => {
    const conversation = await getConversation(req.params.id, req.user, transaction);
    const seenAt = new Date();
    conversation.participants = conversation.participants.map(p => ({ ...p, lastReadAt: p.user === req.user.id ? seenAt : p.lastReadAt }));
    await conversation.save({ transaction });
    await sequelize.query(`UPDATE messages SET "readBy" = "readBy" || $1::jsonb, "updatedAt" = now() WHERE conversation = $2 AND sender <> $3 AND NOT ("readBy" @> $4::jsonb)`, { bind: [JSON.stringify([{ user: req.user.id, seenAt }]), conversation._id, req.user.id, JSON.stringify([{ user: req.user.id }])], transaction });
    await Notification.update({ isRead: true }, { where: { user: req.user.id, conversation: conversation._id, isRead: false }, transaction });
  });
  res.json({ success: true, message: "Conversation marked as read." });
});
router.put("/conversations/:id/group", [body("name").optional().trim().notEmpty(), body("participantIds").optional().isArray({ min: 1 }), body("participantIds.*").optional().isString(), handleValidation], async (req, res) => {
  const conversation = await sequelize.transaction(async transaction => {
    const conversation = await getConversation(req.params.id, req.user, transaction);
    if (conversation.type !== "group") fail(400, "Only groups can be updated here.");
    if (!canManage(conversation, req.user)) fail(403, "Only a group admin can manage this group.");
    if (req.body.name !== undefined) conversation.name = req.body.name;
    if (req.body.participantIds) {
      const ids = [...new Set([req.user.id, ...req.body.participantIds])];
      await validateParticipants(ids, transaction);
      const existing = new Map(conversation.participants.map(p => [p.user, p]));
      conversation.participants = ids.map(user => existing.get(user) || { user, joinedAt: new Date(), lastReadAt: null });
    }
    return conversation.save({ transaction });
  });
  res.json({ success: true, data: await formatConversation(conversation, req.user.id), message: "Group updated successfully." });
});
router.delete("/conversations/:id", async (req, res) => {
  await sequelize.transaction(async transaction => {
    const conversation = await getConversation(req.params.id, req.user, transaction);
    if (conversation.type === "group" && !canManage(conversation, req.user)) fail(403, "Only a group admin can delete this group.");
    // PostgreSQL cascades message and notification deletion atomically.
    await conversation.destroy({ transaction });
  });
  res.json({ success: true, message: "Conversation deleted successfully." });
});
router.delete("/messages/:id", async (req, res) => {
  await sequelize.transaction(async transaction => {
    const message = await Message.findByPk(req.params.id, { transaction });
    if (!message) fail(404, "Message not found.");
    const conversation = await getConversation(message.conversation, req.user, transaction);
    if (message.sender !== req.user.id) fail(403, "You can delete only your own messages.");
    await message.destroy({ transaction });
    const latest = await Message.findOne({ where: { conversation: conversation._id }, order: [["createdAt", "DESC"], ["_id", "DESC"]], transaction });
    conversation.lastMessage = { text: latest?.content || "", sender: latest?.sender || null, sentAt: latest?.createdAt || null };
    await conversation.save({ transaction });
  });
  res.json({ success: true, message: "Message deleted successfully." });
});
router.get("/notifications", async (req, res) => {
  const notifications = await Notification.findAll({ where: { user: req.user.id }, order: [["createdAt", "DESC"]], limit: 100 });
  const users = await userMap(notifications.map(n => n.sender));
  res.json({ success: true, data: notifications.map(n => ({ id: n._id, type: n.type, title: n.title, message: n.message, isRead: n.isRead, createdAt: n.createdAt, conversationId: n.conversation, sender: users.get(n.sender) || null })) });
});
router.post("/notifications/read-all", async (req, res) => {
  await Notification.update({ isRead: true }, { where: { user: req.user.id, isRead: false } });
  res.json({ success: true, message: "Notifications marked as read." });
});
router.post("/notifications/:id/read", async (req, res) => {
  const [count] = await Notification.update({ isRead: true }, { where: { _id: req.params.id, user: req.user.id } });
  if (!count) fail(404, "Notification not found.");
  res.json({ success: true, message: "Notification marked as read." });
});
module.exports = router;
