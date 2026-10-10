const express = require("express");
const {
  getAdminSettings,
  getDonationQr,
  updateAdminSettings
} = require("../controllers/adminSettingsController");
const {
  authenticate,
  authorize
} = require("../middleware/auth");
const router = express.Router();
router.get("/", getAdminSettings);
router.get("/donation-qr", getDonationQr);
router.put("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), updateAdminSettings);
module.exports = router;
