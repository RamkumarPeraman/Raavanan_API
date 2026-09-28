const { deleteById } = require("../database/records");
const express = require("express");
const bcrypt = require("bcryptjs");
const {
  body
} = require("express-validator");
const {
  handleValidation
} = require("../middleware/validation");
const {
  authenticate
} = require("../middleware/auth");
const User = require("../models/User");
const {
  createMembershipId,
  resolveMembershipType,
  resolveSignupRole,
  sanitizeUser,
  signToken
} = require("../utils/userHelpers");
const router = express.Router();
router.post("/signup", [body("name").trim().notEmpty().withMessage("Name is required."), body("email").isEmail().withMessage("Valid email is required."), body("password").isLength({
  min: 6
}).withMessage("Password must be at least 6 characters."), handleValidation], async (req, res) => {
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
  const role = resolveSignupRole(req.body.role);
  const user = await User.create({
    name: req.body.name.trim(),
    email,
    phone: req.body.phone || "",
    role,
    passwordHash: await bcrypt.hash(req.body.password, 10),
    status: "active",
    department: req.body.department || "",
    location: req.body.location || "",
    bio: req.body.bio || "",
    dateOfBirth: req.body.dateOfBirth || "",
    gender: req.body.gender || "",
    address: req.body.address || {},
    interests: Array.isArray(req.body.interests) ? req.body.interests : [],
    preferences: req.body.preferences || {},
    membershipId: createMembershipId(),
    membershipType: resolveMembershipType(role, req.body.membershipType),
    lastActive: new Date()
  });
  const safeUser = sanitizeUser(user);
  const token = signToken(user);
  return res.status(201).json({
    success: true,
    message: "Registration successful.",
    token,
    user: safeUser
  });
});
router.post("/login", [body("email").isEmail().withMessage("Valid email is required."), body("password").notEmpty().withMessage("Password is required."), handleValidation], async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({
    where: {
      email
    }
  });
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password."
    });
  }
  if (user.status === "inactive") {
    return res.status(403).json({
      success: false,
      message: "Your account is inactive. Please contact an administrator."
    });
  }
  const passwordMatches = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password."
    });
  }
  user.lastActive = new Date();
  await user.save();
  const token = signToken(user);
  return res.json({
    success: true,
    token,
    user: sanitizeUser(user)
  });
});
router.get("/me", authenticate, async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }
  return res.json({
    success: true,
    user: sanitizeUser(user)
  });
});
router.put("/me", authenticate, [body("name").optional().trim().notEmpty().withMessage("Name cannot be empty."), body("email").optional().isEmail().withMessage("Valid email is required."), handleValidation], async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }
  const allowedFields = ["name", "email", "phone", "profileImage", "bio", "dateOfBirth", "gender", "bloodGroup", "address", "occupation", "organization", "location", "socialLinks", "interests", "skills", "preferences", "privacy"];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      user[field] = req.body[field];
    }
  }
  if (req.body.email) {
    user.email = req.body.email.trim().toLowerCase();
  }
  user.lastActive = new Date();
  await user.save();
  return res.json({
    success: true,
    message: "Profile updated successfully.",
    user: sanitizeUser(user)
  });
});
router.put("/change-password", authenticate, [body("currentPassword").notEmpty().withMessage("Current password is required."), body("newPassword").isLength({
  min: 6
}).withMessage("New password must be at least 6 characters."), handleValidation], async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }
  const passwordMatches = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
  if (!passwordMatches) {
    return res.status(400).json({
      success: false,
      message: "Current password is incorrect."
    });
  }
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
  await user.save();
  return res.json({
    success: true,
    message: "Password updated successfully."
  });
});
router.delete("/me", authenticate, [body("password").notEmpty().withMessage("Password is required."), handleValidation], async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }
  const passwordMatches = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(400).json({
      success: false,
      message: "Password is incorrect."
    });
  }
  await deleteById(User, user._id);
  return res.json({
    success: true,
    message: "Account deleted successfully."
  });
});
module.exports = router;
