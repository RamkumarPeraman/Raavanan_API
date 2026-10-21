const express = require("express");
const { body, param } = require("express-validator");
const { authenticate, authorize, authorizePermission } = require("../middleware/auth");
const { handleValidation } = require("../middleware/validation");
const Wing = require("../models/Wing");
const SubWing = require("../models/SubWing");
const User = require("../models/User");
const { sequelize } = require("../config/db");

const router = express.Router();
const idRule = name => param(name).isUUID().withMessage(`Invalid ${name}.`);
const nameRule = body("name").trim().notEmpty().withMessage("Name is required.").isLength({ max: 120 }).withMessage("Name must be 120 characters or less.");
const optionalNameRule = body("name").optional().trim().notEmpty().withMessage("Name cannot be empty.").isLength({ max: 120 });
const descriptionRule = body("description").optional().isString().isLength({ max: 1000 });
const serialize = record => {
  const { _id, ...data } = record.toJSON();
  return { id: _id, ...data };
};
const notFound = (res, label) => res.status(404).json({ success: false, message: `${label} not found.` });

router.use(authenticate);

router.get("/", authorizePermission("page:wings"), async (req, res) => {
  const [wings, subWings] = await Promise.all([
    Wing.findAll({ order: [["name", "ASC"]] }),
    SubWing.findAll({ attributes: ["wingId"] }),
  ]);
  const counts = subWings.reduce((result, subWing) => {
    result[subWing.wingId] = (result[subWing.wingId] || 0) + 1;
    return result;
  }, {});
  res.json({ success: true, data: wings.map(wing => ({ ...serialize(wing), subWingCount: counts[wing._id] || 0 })) });
});

router.post("/", authorize("ADMIN", "SUPER_ADMIN"), [nameRule, descriptionRule, handleValidation], async (req, res) => {
  const wing = await Wing.create({ name: req.body.name, description: req.body.description || "" });
  res.status(201).json({ success: true, message: "Wing created successfully.", data: { ...serialize(wing), subWingCount: 0 } });
});

router.put("/:wingId", authorize("ADMIN", "SUPER_ADMIN"), [idRule("wingId"), optionalNameRule, descriptionRule, handleValidation], async (req, res) => {
  const wing = await Wing.findByPk(req.params.wingId);
  if (!wing) return notFound(res, "Wing");
  await wing.update(Object.fromEntries(["name", "description"].filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]])));
  res.json({ success: true, message: "Wing updated successfully.", data: serialize(wing) });
});

router.delete("/:wingId", authorize("ADMIN", "SUPER_ADMIN"), [idRule("wingId"), handleValidation], async (req, res) => {
  const wing = await Wing.findByPk(req.params.wingId);
  if (!wing) return notFound(res, "Wing");
  if (await SubWing.count({ where: { wingId: wing._id } })) {
    return res.status(409).json({ success: false, message: "Delete this wing's departments first." });
  }
  await wing.destroy();
  res.json({ success: true, message: "Wing deleted successfully." });
});

router.get("/:wingId/sub-wings", authorizePermission("page:wings"), [idRule("wingId"), handleValidation], async (req, res) => {
  const wing = await Wing.findByPk(req.params.wingId);
  if (!wing) return notFound(res, "Wing");
  const subWings = await SubWing.findAll({ where: { wingId: wing._id }, order: [["name", "ASC"]] });
  res.json({ success: true, data: subWings.map(serialize) });
});

router.post("/:wingId/sub-wings", authorize("ADMIN", "SUPER_ADMIN"), [idRule("wingId"), nameRule, descriptionRule, handleValidation], async (req, res) => {
  const wing = await Wing.findByPk(req.params.wingId);
  if (!wing) return notFound(res, "Wing");
  const subWing = await SubWing.create({ wingId: wing._id, name: req.body.name, description: req.body.description || "" });
  res.status(201).json({ success: true, message: "Department created successfully.", data: serialize(subWing) });
});

router.put("/sub-wings/:subWingId", authorize("ADMIN", "SUPER_ADMIN"), [idRule("subWingId"), optionalNameRule, descriptionRule, handleValidation], async (req, res) => {
  const subWing = await SubWing.findByPk(req.params.subWingId);
  if (!subWing) return notFound(res, "Department");
  await sequelize.transaction(async transaction => {
    await subWing.update(Object.fromEntries(["name", "description"].filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]])), { transaction });
    if (req.body.name !== undefined) await User.update({ department: subWing.name }, { where: { departmentId: subWing._id }, transaction });
  });
  res.json({ success: true, message: "Department updated successfully.", data: serialize(subWing) });
});

router.delete("/sub-wings/:subWingId", authorize("ADMIN", "SUPER_ADMIN"), [idRule("subWingId"), handleValidation], async (req, res) => {
  const subWing = await SubWing.findByPk(req.params.subWingId);
  if (!subWing) return notFound(res, "Department");
  if (await User.count({ where: { departmentId: subWing._id } })) {
    return res.status(409).json({ success: false, message: "This department is assigned to members and cannot be deleted." });
  }
  await subWing.destroy();
  res.json({ success: true, message: "Department deleted successfully." });
});

module.exports = router;
