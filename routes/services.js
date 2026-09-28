const express = require("express");
const {
  body
} = require("express-validator");
const {
  listServices,
  getServiceById,
  createService,
  updateServiceStatus
} = require("../controllers/serviceController");
const {
  authenticate,
  authorize
} = require("../middleware/auth");
const {
  handleValidation
} = require("../middleware/validation");
const router = express.Router();
router.get("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), listServices);
router.get("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), getServiceById);
router.post("/", [body("name").trim().notEmpty().withMessage("Name is required."), body("email").isEmail().withMessage("Valid email is required."), body("phone").trim().notEmpty().withMessage("Phone number is required."), body("message").trim().isLength({
  min: 10
}).withMessage("Message must be at least 10 characters."), handleValidation], createService);
router.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), updateServiceStatus);
module.exports = router;
