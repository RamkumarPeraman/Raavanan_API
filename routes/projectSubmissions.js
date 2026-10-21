const express = require("express");
const { Op } = require("sequelize");
const { authenticate, authorize, authorizePermission } = require("../middleware/auth");
const ProjectSubmission = require("../models/ProjectSubmission");

const router = express.Router();
const fields = {
  proposal: ["submittedByName", "position", "departmentWing", "submissionDate", "objective", "summary", "targetGroup", "timeline", "estimatedBudget", "expenseItems", "resourceNeeds", "partnerships", "approvalDirector", "approvalWingSecretary", "approvalTreasury", "finalApproval"],
  report: ["conductedBy", "datesLocation", "objectiveRecap", "activities", "attendeeCount", "targetAudience", "volunteers", "achievements", "notableExperiences", "milestones", "mediaEvidence", "feedback", "challenges", "recommendations", "preparedName", "preparedRole", "preparedSignature", "preparedDate", "reviewDirector", "reviewWingSecretary", "reviewGeneralSecretary"]
};
const required = {
  proposal: ["submittedByName", "departmentWing", "submissionDate", "objective", "summary", "targetGroup", "timeline", "estimatedBudget", "resourceNeeds"],
  report: ["conductedBy", "datesLocation", "objectiveRecap", "activities", "attendeeCount", "targetAudience", "volunteers", "achievements", "preparedName", "preparedDate"]
};
const serialize = record => {
  const { _id, ...data } = record.toJSON();
  return { id: _id, ...data };
};
const validateForm = (kind, title, answers) => {
  if (!Object.hasOwn(fields, kind)) return { error: "Select Project Proposal or Project Report." };
  if (typeof title !== "string" || !title.trim() || title.trim().length > 200) return { error: "Enter a project title of 200 characters or fewer." };
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return { error: "Complete the form questions." };
  if (required[kind].some(key => typeof answers[key] !== "string" || !answers[key].trim())) return { error: "Complete all required questions before submitting." };
  if (fields[kind].some(key => answers[key] !== undefined && (typeof answers[key] !== "string" || answers[key].length > 5000))) return { error: "One or more answers are too long or invalid." };
  let budgetItems = [];
  if (kind === "report") {
    if (answers.budgetItems !== undefined && !Array.isArray(answers.budgetItems)) return { error: "Budget items must be a list." };
    budgetItems = (answers.budgetItems || []).filter(item => item && Object.values(item).some(value => String(value ?? "").trim()));
    if (budgetItems.length > 30 || budgetItems.some(item => !["item", "estimated", "actual", "remarks"].every(key => typeof item[key] === "string" && item[key].length <= 500))) return { error: "Check the budget rows." };
  }
  const clean = Object.fromEntries(fields[kind].map(key => [key, (answers[key] || "").trim()]));
  if (kind === "report") clean.budgetItems = budgetItems;
  return { title: title.trim(), answers: clean };
};

router.use(authenticate, authorizePermission("page:project_forms"));

router.get("/", async (req, res) => {
  const kind = req.query.kind;
  if (kind && !Object.hasOwn(fields, kind)) return res.status(400).json({ success: false, message: "Invalid form type." });
  const isAdmin = ["admin", "super_admin"].includes(req.user.role);
  const search = String(req.query.search || "").trim().slice(0, 120);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 100));
  const where = { ...(kind ? { kind } : {}), ...(!isAdmin ? { submittedBy: req.user.id } : {}), ...(search ? { title: { [Op.iLike]: `%${search.replace(/[\\%_]/g, "\\$&")}%` } } : {}) };
  const [rows, totalRowCount] = await Promise.all([
    ProjectSubmission.findAll({ where, order: [["createdAt", "DESC"]], limit: pageSize, offset: (page - 1) * pageSize }),
    ProjectSubmission.count({ where }),
  ]);
  return res.json({ success: true, data: rows.map(serialize), totalRowCount });
});

router.get("/:id", async (req, res) => {
  const row = await ProjectSubmission.findByPk(req.params.id);
  if (!row || (!(["admin", "super_admin"].includes(req.user.role)) && row.submittedBy !== req.user.id)) {
    return res.status(404).json({ success: false, message: "Submission not found." });
  }
  return res.json({ success: true, data: serialize(row) });
});

router.post("/", async (req, res) => {
  const { kind, title, answers } = req.body;
  const checked = validateForm(kind, title, answers);
  if (checked.error) return res.status(400).json({ success: false, message: checked.error });
  const row = await ProjectSubmission.create({ kind, ...checked, submittedBy: req.user.id });
  return res.status(201).json({ success: true, message: "Form submitted successfully.", data: serialize(row) });
});

router.put("/:id", authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const row = await ProjectSubmission.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: "Submission not found." });
  const checked = validateForm(row.kind, req.body.title, req.body.answers);
  if (checked.error) return res.status(400).json({ success: false, message: checked.error });
  await row.update(checked);
  return res.json({ success: true, message: "Submission updated.", data: serialize(row) });
});

router.patch("/:id/status", authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  if (!["approved", "rejected"].includes(req.body.status)) return res.status(400).json({ success: false, message: "Choose approve or reject." });
  const row = await ProjectSubmission.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: "Submission not found." });
  await row.update({ status: req.body.status, reviewedBy: req.user.id, reviewedAt: new Date() });
  return res.json({ success: true, message: `Submission ${req.body.status}.`, data: serialize(row) });
});

router.delete("/:id", authorize("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const row = await ProjectSubmission.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: "Submission not found." });
  await row.destroy();
  return res.json({ success: true, message: "Submission deleted." });
});

module.exports = router;
