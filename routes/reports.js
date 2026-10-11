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
const { saveReportPdf, getReportPdfPath } = require("../utils/reportFiles");
const router = express.Router();
router.get("/", listReports);
router.post("/upload", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await saveReportPdf(req.body) });
  } catch (error) { next(error); }
});
router.get("/files/:filename", (req, res, next) => {
  const filePath = getReportPdfPath(req.params.filename);
  if (!filePath) return res.status(404).json({ success: false, message: "File not found." });
  res.sendFile(filePath, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline" } }, (error) => {
    if (!error) return;
    if (res.headersSent) return next(error);
    if (error.status === 404 || error.code === "ENOENT") return res.status(404).json({ success: false, message: "File not found." });
    next(error);
  });
});
router.get("/:id", getReportById);
router.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), [body("title").trim().notEmpty().withMessage("Title is required."), body("type").isIn(["annual", "quarterly", "impact", "financial", "project", "field_visit", "sustainability", "publication"]).withMessage("Valid report type is required."), body("description").trim().notEmpty().withMessage("Description is required."), body("publishedDate").notEmpty().withMessage("Published date is required."), handleValidation], createReport);
router.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), updateReport);
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), deleteReport);
module.exports = router;
