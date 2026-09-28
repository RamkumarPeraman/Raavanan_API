const express = require("express");
const {
  body
} = require("express-validator");
const {
  listReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport
} = require("../controllers/reportController");
const {
  authenticate,
  authorize
} = require("../middleware/auth");
const {
  handleValidation
} = require("../middleware/validation");
const router = express.Router();
router.get("/", listReports);
router.get("/:id", getReportById);
router.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), [body("title").trim().notEmpty().withMessage("Title is required."), body("type").isIn(["annual", "quarterly", "impact", "financial", "project", "field_visit", "sustainability", "publication"]).withMessage("Valid report type is required."), body("description").trim().notEmpty().withMessage("Description is required."), body("publishedDate").notEmpty().withMessage("Published date is required."), handleValidation], createReport);
router.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), updateReport);
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), deleteReport);
module.exports = router;
