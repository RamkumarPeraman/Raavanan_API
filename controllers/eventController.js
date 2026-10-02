const { sequelize } = require("../config/db");
const { Op } = require("sequelize");
const {
  updateById,
  deleteById,
  containsText,
  exactText
} = require("../database/records");
const Event = require("../models/Event");
const { listRecords } = require("../database/pagination");
const User = require("../models/User");
const serializeEvent = event => {
  const data = event.toJSON ? event.toJSON() : event;
  return {
    ...data,
    id: String(data._id),
    registered: typeof data.registered === "number" ? data.registered : Array.isArray(data.attendees) ? data.attendees.length : 0
  };
};
const listEvents = async (req, res) => {
  const where = req.query.search ? {
    [Op.or]: ["title", "type", "location"].map(field => ({ [field]: { [Op.iLike]: containsText(req.query.search) } }))
  } : {};
  return res.json(await listRecords(Event, {
    where,
    order: [["date", "ASC"], ["createdAt", "DESC"]]
  }, req.query, serializeEvent));
};
const listMyRegisteredEvents = async (req, res) => {
  const events = await Event.findAll({
    where: {
      attendees: { [Op.contains]: [{ userId: req.user.id }] }
    },
    order: [["date", "ASC"], ["createdAt", "DESC"]]
  });
  return res.json({
    success: true,
    data: events.map(serializeEvent)
  });
};
const getEventById = async (req, res) => {
  const event = await Event.findByPk(req.params.id);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event not found."
    });
  }
  return res.json({
    success: true,
    data: serializeEvent(event)
  });
};
const createEvent = async (req, res) => {
  const payload = {
    ...req.body,
    registered: Array.isArray(req.body.attendees) ? req.body.attendees.length : req.body.registered || 0
  };
  const event = await Event.create(payload);
  return res.status(201).json({
    success: true,
    message: "Event created successfully.",
    data: serializeEvent(event)
  });
};
const updateEvent = async (req, res) => {
  const payload = {
    ...req.body,
    registered: req.body.registered !== undefined ? req.body.registered : Array.isArray(req.body.attendees) ? req.body.attendees.length : undefined
  };
  const event = await updateById(Event, req.params.id, payload);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event not found."
    });
  }
  return res.json({
    success: true,
    message: "Event updated successfully.",
    data: serializeEvent(event)
  });
};
const deleteEvent = async (req, res) => {
  const event = await deleteById(Event, req.params.id);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event not found."
    });
  }
  return res.json({
    success: true,
    message: "Event deleted successfully."
  });
};
const registerForEvent = async (req, res) => {
  const result = await sequelize.transaction(async transaction => {
  const event = await Event.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event not found."
    });
  }
  const user = await User.findByPk(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }
  const alreadyRegistered = event.attendees.some(attendee => String(attendee.userId) === String(req.user.id));
  if (alreadyRegistered) {
    return res.status(409).json({
      success: false,
      message: "You are already registered for this event."
    });
  }
  if (event.capacity > 0 && event.attendees.length >= event.capacity) {
    return res.status(400).json({
      success: false,
      message: "This event is already full."
    });
  }
  event.attendees = [...event.attendees, {
    userId: user._id,
    name: user.name,
    email: user.email, registeredAt: new Date()
  }];
  event.registered = event.attendees.length;
  await event.save({ transaction });
  return {
    success: true,
    message: "Registration successful.",
    data: {
      eventId: String(event._id),
      attendee: {
        userId: String(user._id),
        name: user.name,
        email: user.email
      },
      registered: event.registered
    }
  };
  });
  if (!res.headersSent) return res.status(201).json(result);
};
module.exports = {
  listEvents,
  listMyRegisteredEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  registerForEvent
};
