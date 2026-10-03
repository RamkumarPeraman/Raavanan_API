const jwt = require("jsonwebtoken");
const { normalizeRole } = require("../utils/userHelpers");
const Role = require("../models/Role");
const User = require("../models/User");

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication token is required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "raavanan-dev-secret");
    req.user = {
      ...payload,
      role: normalizeRole(payload.role),
    };
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};

const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "raavanan-dev-secret");
    req.user = {
      ...payload,
      role: normalizeRole(payload.role),
    };
  } catch (error) {
    req.user = null;
  }

  return next();
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  const allowedRoles = roles.map(normalizeRole);

  if (allowedRoles.length > 0 && !allowedRoles.includes(normalizeRole(req.user.role))) {
    return res.status(403).json({ success: false, message: "You do not have permission for this action." });
  }

  return next();
};

const authorizePermission = permission => async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Authentication required." });
    const user = await User.findByPk(req.user.id);
    if (!user || user.status === "inactive") return res.status(403).json({ success: false, message: "Account is inactive or unavailable." });
    const roleName = normalizeRole(user.role);
    req.user.role = roleName;
    if (["admin", "super_admin"].includes(roleName)) return next();
    const role = await Role.findOne({ where: { name: roleName, status: "active" } });
    if (!role?.permissions?.includes(permission)) return res.status(403).json({ success: false, message: "You do not have permission for this action." });
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { authenticate, optionalAuthenticate, authorize, authorizePermission };
