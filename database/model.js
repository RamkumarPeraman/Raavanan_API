const { DataTypes, ValidationError } = require("sequelize");
const { randomUUID } = require("node:crypto");
const { sequelize } = require("../config/db");
const definitions = require("./definitions.json");
const { normalizeRole } = require("../utils/userHelpers");

function normalize(value, field, name) {
  if (value === undefined) {
    if (field.defaultNow) value = new Date();
    else if (field.defaultToday) value = new Date().toISOString().slice(0, 10);
    else if (Object.hasOwn(field, "default")) value = structuredClone(field.default);
  }
  const invalid = (reason) => { throw new ValidationError(`${name} ${reason}`); };
  if (value == null) {
    if (field.required) invalid("is required.");
    return value;
  }
  switch (field.type) {
    case "string":
    case "id":
      if (typeof value !== "string") invalid("must be a string.");
      if (field.trim) value = value.trim();
      if (field.lowercase) value = value.toLowerCase();
      if (field.required && !value) invalid("cannot be empty.");
      if (field.maxlength && value.length > field.maxlength) invalid(`must have at most ${field.maxlength} characters.`);
      break;
    case "number":
      value = Number(value);
      if (!Number.isFinite(value)) invalid("must be a finite number.");
      if (field.min !== undefined && value < field.min) invalid(`must be at least ${field.min}.`);
      if (field.max !== undefined && value > field.max) invalid(`must be at most ${field.max}.`);
      break;
    case "boolean":
      if (value === "true") value = true;
      if (value === "false") value = false;
      if (typeof value !== "boolean") invalid("must be a boolean.");
      break;
    case "date":
      value = new Date(value);
      if (Number.isNaN(value.getTime())) invalid("must be a valid date.");
      break;
    case "array":
      if (!Array.isArray(value)) invalid("must be an array.");
      if (field.minItems && value.length < field.minItems) invalid(`needs at least ${field.minItems} items.`);
      value = value.map((item, i) => normalize(item, field.items, `${name}[${i}]`));
      break;
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) invalid("must be an object.");
      value = Object.fromEntries(Object.entries(field.properties).map(([key, spec]) => [key, normalize(value[key], spec, `${name}.${key}`)]).filter(([, item]) => item !== undefined));
      break;
    case "map":
      if (typeof value !== "object" || Array.isArray(value)) invalid("must be an object.");
      value = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, field.values, `${name}.${key}`)]));
      break;
    case "mixed": break;
    default: invalid("has an unsupported type.");
  }
  if (field.enum && !field.enum.includes(value)) invalid("has an invalid value.");
  return value;
}

function defineModel(name) {
  if (sequelize.models[name]) return sequelize.models[name];
  const definition = definitions[name];
  const types = { string: DataTypes.TEXT, id: DataTypes.TEXT, number: DataTypes.DOUBLE, boolean: DataTypes.BOOLEAN, date: DataTypes.DATE };
  const attributes = {
    // Text keys preserve exported IDs; new records receive UUIDs.
    _id: { type: DataTypes.TEXT, primaryKey: true, defaultValue: () => randomUUID(), field: "id" },
  };
  for (const [key, spec] of Object.entries(definition.fields)) {
    attributes[key] = {
      type: ["amount", "price", "goal", "raised"].includes(key) ? DataTypes.DECIMAL(18, 2) : types[spec.type] || DataTypes.JSONB,
      ...(["amount", "price", "goal", "raised"].includes(key) ? { get() { const value = this.getDataValue(key); return value == null ? value : Number(value); } } : {}),
      allowNull: !spec.required,
      unique: Boolean(spec.unique),
      ...(spec.defaultNow || spec.defaultToday || Object.hasOwn(spec, "default")
        ? { defaultValue: () => normalize(undefined, spec, key) } : {}),
    };
  }
  const hidden = Object.entries(definition.fields).filter(([, spec]) => spec.select === false).map(([key]) => key);
  return sequelize.define(name, attributes, {
    tableName: definition.table,
    timestamps: true,
    defaultScope: hidden.length ? { attributes: { exclude: hidden } } : {},
    hooks: {
      beforeValidate(record, options) {
        for (const [key, spec] of Object.entries(definition.fields)) {
          if (options.fields && !options.fields.includes(key)) continue;
          if (!record.isNewRecord && !record.changed(key)) continue;
          const value = name === "User" && key === "role" ? normalizeRole(record.get(key)) : record.get(key);
          record.set(key, normalize(value, spec, key));
        }
      },
    },
  });
}

module.exports = { defineModel, normalize };
