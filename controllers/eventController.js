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
  const event = await Event.create(req.body);
  return res.status(201).json({
    success: true,
    message: "Event created successfully.",
    data: serializeEvent(event)
  });
};
const updateEvent = async (req, res) => {
  const event = await updateById(Event, req.params.id, req.body);
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
  const [rows] = await sequelize.query(
    'SELECT * FROM public.raavanan_register_for_event($1, $2)',
    { bind: [req.params.id, req.user.id] }
  );
  const result = rows[0];
  const failures = {
    event_not_found: [404, "Event not found."],
    user_not_found: [404, "User not found."],
    already_registered: [409, "You are already registered for this event."],
    full: [400, "This event is already full."]
  };
  if (failures[result.result]) {
    const [status, message] = failures[result.result];
    return res.status(status).json({ success: false, message });
  }
  return res.status(201).json({
    success: true,
    message: "Registration successful.",
    data: {
      eventId: req.params.id,
      attendee: {
        userId: result.attendee.userId,
        name: result.attendee.name,
        email: result.attendee.email
      },
      registered: result.registration_count
    }
  });
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
