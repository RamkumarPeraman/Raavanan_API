const jwt = require("jsonwebtoken");
const DEFAULT_PASSWORD = "Password@123";
const ROLE_ALIASES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MANAGER: "manager",
  VOLUNTEER_COORDINATOR: "volunteer_coordinator",
  MEMBER: "member",
  VOLUNTEER: "volunteer",
  DONOR: "donor"
};
const roleToMembershipType = {
  super_admin: "Leadership",
  admin: "Staff Member",
  manager: "Manager",
  volunteer_coordinator: "Coordinator",
  member: "Regular Member",
  volunteer: "Volunteer",
  donor: "Donor"
};
const createMembershipId = () => `RT${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;
const normalizeRole = role => {
  if (typeof role !== "string") {
    return role;
  }
  const normalized = role.trim();
  if (!normalized) {
    return normalized;
  }
  return ROLE_ALIASES[normalized.toUpperCase()] || normalized.toLowerCase();
};
const sanitizeUser = userDocument => {
  if (!userDocument) {
    return null;
  }
  const user = typeof userDocument.toJSON === "function" ? userDocument.toJSON() : {
    ...userDocument
  };
  const {
    passwordHash,
    __v,
    _id,
    ...safeUser
  } = user;
  return {
    ...safeUser,
    role: normalizeRole(safeUser.role),
    id: _id?.toString?.() || safeUser.id
  };
};
const signToken = user => jwt.sign({
  id: user._id?.toString?.() || user.id,
  email: user.email,
  role: normalizeRole(user.role)
}, process.env.JWT_SECRET || "raavanan-dev-secret", {
  expiresIn: process.env.JWT_EXPIRE || "7d"
});
const resolveSignupRole = role => {
  const allowedRoles = new Set(["member", "volunteer", "donor"]);
  const normalizedRole = normalizeRole(role);
  return allowedRoles.has(normalizedRole) ? normalizedRole : "member";
};
const resolveMembershipType = (role, explicitType) => explicitType || roleToMembershipType[normalizeRole(role)] || "Regular Member";
module.exports = {
  DEFAULT_PASSWORD,
  normalizeRole,
  createMembershipId,
  resolveMembershipType,
  resolveSignupRole,
  sanitizeUser,
  signToken
};
