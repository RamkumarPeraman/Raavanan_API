const express = require("express");
const {
  body,
  param
} = require("express-validator");
const {
  authenticate,
  authorize
} = require("../middleware/auth");
const {
  handleValidation
} = require("../middleware/validation");
const {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignRole,
  getPermissions,
  getRoleStats
} = require("../controllers/roleController");
const router = express.Router();
router.use(authenticate);

/**
 * GET /api/roles/permissions
 * List all available permissions grouped by resource.
 * Accessible by admin and above.
 */
router.get("/permissions", authorize("ADMIN", "SUPER_ADMIN"), getPermissions);

/**
 * GET /api/roles/stats
 * Get each role with its assigned user count.
 * Accessible by admin and above.
 */
router.get("/stats", authorize("ADMIN", "SUPER_ADMIN"), getRoleStats);

/**
 * GET /api/roles
 * List all roles. Supports ?status=active|inactive|all and ?search=
 * Accessible by admin and above.
 */
router.get("/", authorize("ADMIN", "SUPER_ADMIN"), listRoles);

/**
 * GET /api/roles/:id
 * Get a single role by ID.
 * Accessible by admin and above.
 */
router.get("/:id", [param("id").matches(/^(?:[a-f0-9]{24}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i).withMessage("Invalid role ID."), handleValidation], authorize("ADMIN", "SUPER_ADMIN"), getRoleById);

/**
 * POST /api/roles
 * Create a new custom role.
 * Super admin only.
 */
router.post("/", authorize("SUPER_ADMIN"), [body("name").trim().notEmpty().withMessage("Role name is required.").matches(/^[a-z0-9_]+$/).withMessage("Role name must be lowercase letters, numbers, and underscores only."), body("displayName").trim().notEmpty().withMessage("Display name is required."), body("description").optional().isString(), body("permissions").optional().isArray().withMessage("Permissions must be an array."), body("color").optional().isString(), body("status").optional().isIn(["active", "inactive"]).withMessage("Status must be active or inactive."), handleValidation], createRole);

/**
 * PUT /api/roles/:id
 * Update a role. Cannot rename system roles.
 * Super admin only.
 */
router.put("/:id", authorize("SUPER_ADMIN"), [param("id").matches(/^(?:[a-f0-9]{24}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i).withMessage("Invalid role ID."), body("name").optional().trim().matches(/^[a-z0-9_]+$/).withMessage("Role name must be lowercase letters, numbers, and underscores only."), body("displayName").optional().trim().notEmpty().withMessage("Display name cannot be empty."), body("permissions").optional().isArray().withMessage("Permissions must be an array."), body("status").optional().isIn(["active", "inactive"]).withMessage("Status must be active or inactive."), handleValidation], updateRole);

/**
 * DELETE /api/roles/:id
 * Delete a custom role. System roles and roles in use cannot be deleted.
 * Super admin only.
 */
router.delete("/:id", authorize("SUPER_ADMIN"), [param("id").matches(/^(?:[a-f0-9]{24}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i).withMessage("Invalid role ID."), handleValidation], deleteRole);

/**
 * PATCH /api/roles/assign/:userId
 * Assign a role to a user.
 * Admin and above. Users cannot change their own role (except super_admin).
 */
router.patch("/assign/:userId", authorize("ADMIN", "SUPER_ADMIN"), [param("userId").matches(/^(?:[a-f0-9]{24}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i).withMessage("Invalid user ID."), body("roleId").matches(/^(?:[a-f0-9]{24}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i).withMessage("Valid role ID is required."), handleValidation], assignRole);
module.exports = router;
