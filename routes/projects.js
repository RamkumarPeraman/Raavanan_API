const express = require("express");
const {
  body
} = require("express-validator");
const {
  listProjects,
  getProjectById,
  getProjectMetrics,
  createProject,
  updateProject,
  deleteProject
} = require("../controllers/projectController");
const {
  authenticate,
  authorize
} = require("../middleware/auth");
const {
  handleValidation
} = require("../middleware/validation");
const router = express.Router();
router.get("/metrics", getProjectMetrics);
router.get("/", listProjects);
router.get("/:id", getProjectById);
router.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), [body("title").trim().notEmpty().withMessage("Title is required."), body("description").trim().notEmpty().withMessage("Description is required."), body("category").trim().notEmpty().withMessage("Category is required."), body("status").optional().isIn(["ongoing", "completed", "planned"]).withMessage("Invalid project status."), body("progress").optional().isFloat({
  min: 0,
  max: 100
}).withMessage("Progress must be between 0 and 100."), handleValidation], createProject);
router.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), [body("title").optional().trim().notEmpty().withMessage("Title cannot be empty."), body("description").optional().trim().notEmpty().withMessage("Description cannot be empty."), body("category").optional().trim().notEmpty().withMessage("Category cannot be empty."), body("status").optional().isIn(["ongoing", "completed", "planned"]).withMessage("Invalid project status."), body("progress").optional().isFloat({
  min: 0,
  max: 100
}).withMessage("Progress must be between 0 and 100."), handleValidation], updateProject);
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), deleteProject);
module.exports = router;
