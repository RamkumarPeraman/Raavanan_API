const express = require("express");
const {
  body
} = require("express-validator");
const {
  listVolunteers,
  getVolunteerById,
  registerVolunteer,
  volunteerLogin,
  updateVolunteer,
  updateVolunteerStatus,
  deleteVolunteer
} = require("../controllers/volunteerController");
const {
  authenticate,
  authorize
} = require("../middleware/auth");
const {
  handleValidation
} = require("../middleware/validation");
const router = express.Router();
router.get("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), listVolunteers);
router.get("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), getVolunteerById);
router.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), updateVolunteer);
router.post("/register", [body("fullName").trim().notEmpty().withMessage("Full name is required."), body("email").isEmail().withMessage("Valid email is required."), body("phone").trim().notEmpty().withMessage("Phone number is required."), body("motivation").optional().trim(), handleValidation], registerVolunteer);
router.post("/login", [body("email").isEmail().withMessage("Valid email is required."), body("password").notEmpty().withMessage("Password is required."), handleValidation], volunteerLogin);
router.put("/:id/status", [authenticate, authorize("ADMIN", "SUPER_ADMIN", "VOLUNTEER_COORDINATOR"), body("status").isIn(["pending", "approved", "rejected"]).withMessage("Valid volunteer status is required."), handleValidation], updateVolunteerStatus);
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), deleteVolunteer);
module.exports = router;
