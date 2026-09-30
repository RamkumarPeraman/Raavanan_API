const { deleteById } = require("../database/records");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomInt } = require("node:crypto");
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
const SignupOtp = require("../models/SignupOtp");
const PasswordResetOtp = require("../models/PasswordResetOtp");
const { sequelize } = require("../config/db");
const { sendPasswordResetOtp, sendSignupOtp } = require("../utils/mailer");
const {
  createMembershipId,
  resolveMembershipType,
  resolveSignupRole,
  sanitizeUser,
  signToken
} = require("../utils/userHelpers");
const router = express.Router();
const SIGNUP_OTP_TTL_MINUTES = 10;
const SIGNUP_OTP_RESEND_SECONDS = 60;
const SIGNUP_OTP_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_OTP_TTL_MINUTES = 10;
const PASSWORD_RESET_OTP_RESEND_SECONDS = 60;
const PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5;

const generateOtp = () => String(randomInt(100000, 1000000));

const signupPayload = async (body) => {
  const role = resolveSignupRole(body.role);
  return {
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    phone: body.phone || "",
    role,
    passwordHash: await bcrypt.hash(body.password, 10),
    status: "active",
    department: body.department || "",
    location: body.location || "",
    bio: body.bio || "",
    dateOfBirth: body.dateOfBirth || "",
    gender: body.gender || "",
    address: body.address || {},
    interests: Array.isArray(body.interests) ? body.interests : [],
    preferences: body.preferences || {},
    membershipType: resolveMembershipType(role, body.membershipType)
  };
};

const ensureEmailAvailable = async (email, res) => {
  const existingUser = await User.findOne({ where: { email } });
  if (!existingUser) return true;
  res.status(409).json({ success: false, message: "User already exists." });
  return false;
};

const signupValidators = [
  body("name").trim().notEmpty().withMessage("Name is required."),
  body("email").isEmail().withMessage("Valid email is required."),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
  handleValidation
];

router.post("/signup/request-otp", signupValidators, async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  if (!(await ensureEmailAvailable(email, res))) return;

  const existingOtp = await SignupOtp.findOne({ where: { email } });
  if (existingOtp && Date.now() - new Date(existingOtp.lastSentAt).getTime() < SIGNUP_OTP_RESEND_SECONDS * 1000) {
    return res.status(429).json({ success: false, message: "Please wait before requesting another code." });
  }

  const otp = generateOtp();
  const pendingData = await signupPayload(req.body);
  const values = {
    email,
    otpHash: await bcrypt.hash(otp, 8),
    signupData: pendingData,
    expiresAt: new Date(Date.now() + SIGNUP_OTP_TTL_MINUTES * 60 * 1000),
    lastSentAt: new Date(),
    attempts: 0
  };

  const pending = existingOtp
    ? await existingOtp.update(values)
    : await SignupOtp.create(values);

  try {
    await sendSignupOtp({ email, name: pendingData.name, otp, expiresInMinutes: SIGNUP_OTP_TTL_MINUTES });
  } catch (error) {
    await pending.destroy();
    throw error;
  }

  return res.json({
    success: true,
    message: "Verification code sent to your email.",
    email,
    expiresIn: SIGNUP_OTP_TTL_MINUTES * 60,
    resendAfter: SIGNUP_OTP_RESEND_SECONDS
  });
});

router.post("/signup/resend-otp", [body("email").isEmail().withMessage("Valid email is required."), handleValidation], async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const pending = await SignupOtp.unscoped().findOne({ where: { email } });
  if (!pending) return res.status(404).json({ success: false, message: "No pending registration was found." });

  if (Date.now() - new Date(pending.lastSentAt).getTime() < SIGNUP_OTP_RESEND_SECONDS * 1000) {
    return res.status(429).json({ success: false, message: "Please wait before requesting another code." });
  }

  const otp = generateOtp();
  await pending.update({
    otpHash: await bcrypt.hash(otp, 8),
    expiresAt: new Date(Date.now() + SIGNUP_OTP_TTL_MINUTES * 60 * 1000),
    lastSentAt: new Date(),
    attempts: 0
  });
  await sendSignupOtp({ email, name: pending.signupData.name, otp, expiresInMinutes: SIGNUP_OTP_TTL_MINUTES });

  return res.json({
    success: true,
    message: "A new verification code was sent.",
    expiresIn: SIGNUP_OTP_TTL_MINUTES * 60,
    resendAfter: SIGNUP_OTP_RESEND_SECONDS
  });
});

router.post("/signup/verify-otp", [
  body("email").isEmail().withMessage("Valid email is required."),
  body("otp").matches(/^\d{6}$/).withMessage("Enter the 6-digit verification code."),
  handleValidation
], async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const pending = await SignupOtp.unscoped().findOne({ where: { email } });
  if (!pending) return res.status(404).json({ success: false, message: "No pending registration was found." });

  if (new Date(pending.expiresAt).getTime() < Date.now()) {
    await pending.destroy();
    return res.status(410).json({ success: false, message: "Verification code expired. Request a new code." });
  }
  if (pending.attempts >= SIGNUP_OTP_MAX_ATTEMPTS) {
    return res.status(429).json({ success: false, message: "Too many incorrect attempts. Request a new code." });
  }

  const validOtp = await bcrypt.compare(req.body.otp, pending.otpHash);
  if (!validOtp) {
    await pending.increment("attempts");
    return res.status(400).json({ success: false, message: "Incorrect verification code." });
  }
  if (!(await ensureEmailAvailable(email, res))) {
    await pending.destroy();
    return;
  }

  const user = await sequelize.transaction(async (transaction) => {
    const createdUser = await User.create({
      ...pending.signupData,
      membershipId: createMembershipId(),
      lastActive: new Date()
    }, { transaction });
    await SignupOtp.destroy({ where: { email }, transaction });
    return createdUser;
  });

  return res.status(201).json({
    success: true,
    message: "Email verified and account created successfully.",
    token: signToken(user),
    user: sanitizeUser(user)
  });
});

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
router.post("/forgot-password", [
  body("email").isEmail().withMessage("Valid email is required."),
  handleValidation
], async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(404).json({ success: false, message: "No account was found with this email address." });
  }

  const existingOtp = await PasswordResetOtp.findOne({ where: { email } });
  if (existingOtp && Date.now() - new Date(existingOtp.lastSentAt).getTime() < PASSWORD_RESET_OTP_RESEND_SECONDS * 1000) {
    return res.status(429).json({ success: false, message: "Please wait before requesting another code." });
  }

  const otp = generateOtp();
  const values = {
    email,
    otpHash: await bcrypt.hash(otp, 8),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000),
    lastSentAt: new Date(),
    attempts: 0,
    verifiedAt: null
  };
  const pending = existingOtp
    ? await existingOtp.update(values)
    : await PasswordResetOtp.create(values);

  try {
    await sendPasswordResetOtp({
      email,
      name: user.name,
      otp,
      expiresInMinutes: PASSWORD_RESET_OTP_TTL_MINUTES
    });
  } catch (error) {
    await pending.destroy();
    throw error;
  }

  return res.json({
    success: true,
    message: "Password reset code sent to your email.",
    expiresIn: PASSWORD_RESET_OTP_TTL_MINUTES * 60,
    resendAfter: PASSWORD_RESET_OTP_RESEND_SECONDS
  });
});
router.post("/verify-otp", [
  body("email").isEmail().withMessage("Valid email is required."),
  body("otp").matches(/^\d{6}$/).withMessage("Enter the 6-digit verification code."),
  handleValidation
], async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const pending = await PasswordResetOtp.unscoped().findOne({ where: { email } });
  if (!pending) {
    return res.status(404).json({ success: false, message: "No pending password reset was found." });
  }
  if (new Date(pending.expiresAt).getTime() < Date.now()) {
    await pending.destroy();
    return res.status(410).json({ success: false, message: "Verification code expired. Request a new code." });
  }
  if (pending.attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
    return res.status(429).json({ success: false, message: "Too many incorrect attempts. Request a new code." });
  }

  const validOtp = await bcrypt.compare(req.body.otp, pending.otpHash);
  if (!validOtp) {
    await pending.increment("attempts");
    return res.status(400).json({ success: false, message: "Incorrect verification code." });
  }

  pending.verifiedAt = new Date();
  await pending.save();
  const resetToken = jwt.sign(
    { email, purpose: "password-reset" },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
  return res.json({ success: true, message: "Verification code confirmed.", resetToken });
});
router.post("/reset-password", [
  body("email").isEmail().withMessage("Valid email is required."),
  body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters."),
  body("resetToken").notEmpty().withMessage("Password reset verification is required."),
  handleValidation
], async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  let token;
  try {
    token = jwt.verify(req.body.resetToken, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: "Password reset verification expired. Request a new code." });
  }
  if (token.purpose !== "password-reset" || token.email !== email) {
    return res.status(401).json({ success: false, message: "Invalid password reset verification." });
  }

  const pending = await PasswordResetOtp.findOne({ where: { email } });
  if (!pending?.verifiedAt || new Date(pending.expiresAt).getTime() < Date.now()) {
    return res.status(401).json({ success: false, message: "Verify a current password reset code first." });
  }
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(404).json({ success: false, message: "User not found." });

  await sequelize.transaction(async transaction => {
    user.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    await user.save({ transaction });
    await PasswordResetOtp.destroy({ where: { email }, transaction });
  });
  return res.json({ success: true, message: "Password reset successfully." });
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
