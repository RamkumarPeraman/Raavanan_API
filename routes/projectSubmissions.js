const express = require("express");
const { authenticate, authorizePermission } = require("../middleware/auth");
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

router.use(authenticate, authorizePermission("page:project_forms"));

router.get("/", async (req, res) => {
  const kind = req.query.kind;
  if (kind && !Object.hasOwn(fields, kind)) return res.status(400).json({ success: false, message: "Invalid form type." });
  const isAdmin = ["admin", "super_admin"].includes(req.user.role);
  const where = { ...(kind ? { kind } : {}), ...(!isAdmin ? { submittedBy: req.user.id } : {}) };
  const rows = await ProjectSubmission.findAll({ where, order: [["createdAt", "DESC"]], limit: 100 });
  return res.json({ success: true, data: rows.map(serialize) });
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
  if (!Object.hasOwn(fields, kind)) return res.status(400).json({ success: false, message: "Select Project Proposal or Project Report." });
  if (typeof title !== "string" || !title.trim() || title.trim().length > 200) return res.status(400).json({ success: false, message: "Enter a project title of 200 characters or fewer." });
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return res.status(400).json({ success: false, message: "Complete the form questions." });
  if (required[kind].some(key => typeof answers[key] !== "string" || !answers[key].trim())) {
    return res.status(400).json({ success: false, message: "Complete all required questions before submitting." });
  }
  if (fields[kind].some(key => answers[key] !== undefined && (typeof answers[key] !== "string" || answers[key].length > 5000))) {
    return res.status(400).json({ success: false, message: "One or more answers are too long or invalid." });
  }
  let budgetItems = [];
  if (kind === "report") {
    if (answers.budgetItems !== undefined && !Array.isArray(answers.budgetItems)) return res.status(400).json({ success: false, message: "Budget items must be a list." });
    budgetItems = (answers.budgetItems || []).filter(item => item && Object.values(item).some(value => String(value ?? "").trim()));
    if (budgetItems.length > 30 || budgetItems.some(item => !["item", "estimated", "actual", "remarks"].every(key => typeof item[key] === "string" && item[key].length <= 500))) {
      return res.status(400).json({ success: false, message: "Check the budget rows." });
    }
  }
  const clean = Object.fromEntries(fields[kind].map(key => [key, (answers[key] || "").trim()]));
  if (kind === "report") clean.budgetItems = budgetItems;
  const row = await ProjectSubmission.create({ kind, title: title.trim(), answers: clean, submittedBy: req.user.id });
  return res.status(201).json({ success: true, message: "Form submitted successfully.", data: serialize(row) });
});

module.exports = router;
