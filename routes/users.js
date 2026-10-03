const { deleteById, containsText } = require("../database/records");
const { Op } = require("sequelize");
const express = require("express");
const bcrypt = require("bcryptjs");
const {
  body
} = require("express-validator");
const {
  authenticate,
  authorizePermission
} = require("../middleware/auth");
const {
  handleValidation
} = require("../middleware/validation");
const User = require("../models/User");
const { sequelize } = require("../config/db");
const {
  DEFAULT_PASSWORD,
  createMembershipId,
  resolveMembershipType,
  sanitizeUser
} = require("../utils/userHelpers");
const router = express.Router();
router.use(authenticate);
router.use((req, res, next) => {
  const action = req.method === "GET" ? "read" : req.method === "DELETE" ? "delete" : "write";
  return authorizePermission(`users:${action}`)(req, res, next);
});
router.get("/stats", async (req, res) => {
  const [rows] = await sequelize.query("SELECT * FROM public.raavanan_user_stats()");
  const stats = Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]));
  return res.json({
    success: true,
    data: stats
  });
});
router.get("/", async (req, res) => {
  const {
    search = "",
    role,
    department,
    status
  } = req.query;
  const query = {};
  if (role && role !== "all") {
    query.role = role;
  }
  if (department && department !== "all") {
    query.department = department;
  }
  if (status && status !== "all") {
    query.status = status;
  }
  if (search) {
    query[Op.or] = [{
      name: {
        [Op.iLike]: containsText(search)
      }
    }, {
      email: {
        [Op.iLike]: containsText(search)
      }
    }, {
      phone: {
        [Op.iLike]: containsText(search)
      }
    }, {
      location: {
        [Op.iLike]: containsText(search)
      }
    }];
  }
  const users = await User.findAll({
    where: query,
    order: [["createdAt", "DESC"]]
  });
  return res.json({
    success: true,
    data: users.map(sanitizeUser)
  });
});
router.get("/:id", async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }
  return res.json({
    success: true,
    data: sanitizeUser(user)
  });
});
router.post("/", [body("name").trim().notEmpty().withMessage("Name is required."), body("email").isEmail().withMessage("Valid email is required."), body("password").optional().isLength({
  min: 6
}).withMessage("Password must be at least 6 characters."), handleValidation], async (req, res) => {
  if (!["admin", "super_admin"].includes(req.user.role) && req.body.role && req.body.role !== "member") {
    return res.status(403).json({ success: false, message: "You cannot assign roles." });
  }
  const email = req.body.email.trim().toLowerCase();
  const existingUser = await User.findOne({
    where: {
      email
    }
  });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "User already exists."
    });
  }
  const password = req.body.password || req.body.phone || DEFAULT_PASSWORD;
  const role = req.body.role || "member";
  const user = await User.create({
    ...req.body,
    email,
    role,
    passwordHash: await bcrypt.hash(password, 10),
    membershipId: req.body.membershipId || createMembershipId(),
    membershipType: resolveMembershipType(role, req.body.membershipType),
    joinDate: req.body.joinDate || new Date().toISOString().split("T")[0],
    lastActive: new Date()
  });
  return res.status(201).json({
    success: true,
    message: "User created successfully.",
    data: sanitizeUser(user)
  });
});
router.put("/:id", [body("name").optional().trim().notEmpty().withMessage("Name cannot be empty."), body("email").optional().isEmail().withMessage("Valid email is required."), handleValidation], async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }
  if (!["admin", "super_admin"].includes(req.user.role) && (req.body.role !== undefined || ["admin", "super_admin"].includes(user.role))) {
    return res.status(403).json({ success: false, message: "You cannot change this user's role or account." });
  }
  if (req.body.email) {
    user.email = req.body.email.trim().toLowerCase();
  }
  const allowedFields = ["name", "phone", "role", "status", "department", "location", "profileImage", "bio", "dateOfBirth", "gender", "bloodGroup", "address", "occupation", "organization", "joinDate", "membershipId", "membershipType", "socialLinks", "interests", "skills", "preferences", "privacy", "stats"];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      user[field] = req.body[field];
    }
  }
  if (req.body.password) {
    user.passwordHash = await bcrypt.hash(req.body.password, 10);
  }
  user.lastActive = new Date();
  await user.save();
  return res.json({
    success: true,
    message: "User updated successfully.",
    data: sanitizeUser(user)
  });
});
router.patch("/:id/status", async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }
  if (!["admin", "super_admin"].includes(req.user.role) && ["admin", "super_admin"].includes(user.role)) {
    return res.status(403).json({ success: false, message: "You cannot change this account." });
  }
  user.status = req.body.status === "inactive" ? "inactive" : "active";
  await user.save();
  return res.json({
    success: true,
    message: "User status updated successfully.",
    data: sanitizeUser(user)
  });
});
router.delete("/:id", async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({
      success: false,
      message: "You cannot delete your own account here."
    });
  }
  const target = await User.findByPk(req.params.id);
  if (target && !["admin", "super_admin"].includes(req.user.role) && ["admin", "super_admin"].includes(target.role)) {
    return res.status(403).json({ success: false, message: "You cannot delete this account." });
  }
  const user = await deleteById(User, req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }
  return res.json({
    success: true,
    message: "User deleted successfully."
  });
});
module.exports = router;
