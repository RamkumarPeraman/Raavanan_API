const { deleteById, containsText } = require("../database/records");
const { Op } = require("sequelize");
const Role = require("../models/Role");
const {
  AVAILABLE_PERMISSIONS
} = require("../models/Role");
const User = require("../models/User");
const isProtectedRole = role => role.isSystem || ["super_admin", "admin", "member"].includes(role.name);
const {
  sanitizeUser,
  normalizeRole,
  resolveMembershipType
} = require("../utils/userHelpers");
const serializeRole = role => {
  const data = role.toJSON ? role.toJSON() : role;
  const {
    _id,
    __v,
    ...rest
  } = data;
  return {
    ...rest,
    id: String(_id)
  };
};
const listRoles = async (req, res) => {
  const {
    status,
    search
  } = req.query;
  const query = {};
  if (status && status !== "all") {
    query.status = status;
  }
  if (search) {
    query[Op.or] = [{
      name: {
        [Op.iLike]: containsText(search)
      }
    }, {
      displayName: {
        [Op.iLike]: containsText(search)
      }
    }, {
      description: {
        [Op.iLike]: containsText(search)
      }
    }];
  }
  const roles = await Role.findAll({
    where: query,
    order: [["isSystem", "DESC"], ["createdAt", "ASC"]]
  });
  return res.json({
    success: true,
    data: roles.map(serializeRole)
  });
};
const getRoleById = async (req, res) => {
  const role = await Role.findByPk(req.params.id);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: "Role not found."
    });
  }
  return res.json({
    success: true,
    data: serializeRole(role)
  });
};
const createRole = async (req, res) => {
  const {
    name,
    displayName,
    description,
    permissions,
    color,
    status
  } = req.body;
  const existing = await Role.findOne({
    where: {
      name: name.trim().toLowerCase()
    }
  });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "A role with this name already exists."
    });
  }
  const role = await Role.create({
    name: name.trim().toLowerCase(),
    displayName: displayName.trim(),
    description: description || "",
    permissions: permissions || [],
    color: color || "#0d9488",
    status: status || "active",
    isSystem: false
  });
  return res.status(201).json({
    success: true,
    message: "Role created successfully.",
    data: serializeRole(role)
  });
};
const updateRole = async (req, res) => {
  const role = await Role.findByPk(req.params.id);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: "Role not found."
    });
  }
  const {
    name,
    displayName,
    description,
    permissions,
    color,
    status
  } = req.body;
  if (name && isProtectedRole(role) && name.trim().toLowerCase() !== role.name) {
    return res.status(400).json({
      success: false,
      message: "Cannot rename a system role."
    });
  }
  if (name) {
    const conflict = await Role.findOne({
      where: {
        name: name.trim().toLowerCase(),
        _id: {
          [Op.ne]: role._id
        }
      }
    });
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: "A role with this name already exists."
      });
    }
    if (!isProtectedRole(role)) {
      role.name = name.trim().toLowerCase();
    }
  }
  if (displayName !== undefined) role.displayName = displayName.trim();
  if (description !== undefined) role.description = description;
  if (permissions !== undefined) role.permissions = permissions;
  if (color !== undefined) role.color = color;
  if (status !== undefined) role.status = status;
  await role.save();
  return res.json({
    success: true,
    message: "Role updated successfully.",
    data: serializeRole(role)
  });
};
const deleteRole = async (req, res) => {
  const role = await Role.findByPk(req.params.id);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: "Role not found."
    });
  }
  if (isProtectedRole(role)) {
    return res.status(400).json({
      success: false,
      message: "System roles cannot be deleted."
    });
  }
  const usersWithRole = await User.count({
    where: {
      role: role.name
    }
  });
  if (usersWithRole > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete role. ${usersWithRole} user(s) are currently assigned this role.`
    });
  }
  await deleteById(Role, req.params.id);
  return res.json({
    success: true,
    message: "Role deleted successfully."
  });
};
const assignRole = async (req, res) => {
  const {
    roleId
  } = req.body;
  const role = await Role.findByPk(roleId);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: "Role not found."
    });
  }
  if (role.status !== "active") {
    return res.status(400).json({
      success: false,
      message: "Cannot assign an inactive role."
    });
  }
  const user = await User.findByPk(req.params.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }
  if (req.params.userId === req.user.id && req.user.role !== "super_admin") {
    return res.status(400).json({
      success: false,
      message: "You cannot change your own role."
    });
  }
  user.role = role.name;
  user.membershipType = resolveMembershipType(role.name);
  await user.save();
  return res.json({
    success: true,
    message: `Role '${role.displayName}' assigned to user successfully.`,
    data: sanitizeUser(user)
  });
};
const getPermissions = async (req, res) => {
  const grouped = AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
    const [resource] = perm.split(":");
    if (!acc[resource]) acc[resource] = [];
    acc[resource].push(perm);
    return acc;
  }, {});
  return res.json({
    success: true,
    data: {
      all: AVAILABLE_PERMISSIONS,
      grouped
    }
  });
};
const getRoleStats = async (req, res) => {
  const roles = await Role.findAll({});
  const users = await User.findAll({});
  const stats = await Promise.all(roles.map(async role => {
    const userCount = users.filter(u => normalizeRole(u.role) === role.name).length;
    return {
      ...serializeRole(role),
      userCount
    };
  }));
  return res.json({
    success: true,
    data: stats
  });
};
module.exports = {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignRole,
  getPermissions,
  getRoleStats
};
