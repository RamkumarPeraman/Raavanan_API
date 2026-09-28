const { defineModel } = require("../database/model");

module.exports = defineModel("Role");
module.exports.AVAILABLE_PERMISSIONS = require("../database/definitions.json").Role.permissions;
