const express = require("express");
const {
  body
} = require("express-validator");
const {
  listEvents,
  listMyRegisteredEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  registerForEvent
} = require("../controllers/eventController");
const {
  authenticate,
  authorize
} = require("../middleware/auth");
const {
  handleValidation
} = require("../middleware/validation");
const router = express.Router();
router.get("/", listEvents);
router.get("/registered/me", authenticate, listMyRegisteredEvents);
router.get("/:id", getEventById);
router.post("/:id/register", authenticate, registerForEvent);
router.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), [body("title").trim().notEmpty().withMessage("Title is required."), body("description").trim().notEmpty().withMessage("Description is required."), body("type").trim().notEmpty().withMessage("Event type is required."), body("date").notEmpty().withMessage("Date is required."), body("time").trim().notEmpty().withMessage("Time is required."), body("location").trim().notEmpty().withMessage("Location is required."), handleValidation], createEvent);
router.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), updateEvent);
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), deleteEvent);
module.exports = router;
