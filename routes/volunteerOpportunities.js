const express = require("express");
const {
  body
} = require("express-validator");
const {
  listVolunteerOpportunities,
  createVolunteerOpportunity,
  updateVolunteerOpportunity,
  deleteVolunteerOpportunity
} = require("../controllers/volunteerOpportunityController");
const {
  authenticate,
  authorize
} = require("../middleware/auth");
const {
  handleValidation
} = require("../middleware/validation");
const router = express.Router();
router.get("/", listVolunteerOpportunities);
router.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), [body("title").trim().notEmpty().withMessage("Title is required."), body("category").trim().notEmpty().withMessage("Category is required."), body("location").trim().notEmpty().withMessage("Location is required."), body("commitment").trim().notEmpty().withMessage("Commitment is required."), body("description").trim().notEmpty().withMessage("Description is required."), handleValidation], createVolunteerOpportunity);
router.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), updateVolunteerOpportunity);
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), deleteVolunteerOpportunity);
module.exports = router;
