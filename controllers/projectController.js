const { updateById, deleteById, containsText, exactText } = require("../database/records");
const { Op } = require("sequelize");
const Project = require("../models/Project");
const { sequelize } = require("../config/db");
const { listRecords } = require("../database/pagination");
const PROJECT_FIELDS = ["title", "description", "longDescription", "image", "gallery", "status", "category", "progress", "goal", "raised", "location", "statesCovered", "startDate", "endDate", "impact", "livesImpacted", "volunteersEngaged", "objectives", "achievements", "partners", "funding", "reportUrl", "featured"];
const toNumberOrDefault = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toDateOrUndefined = value => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
};
const sanitizeProjectPayload = (payload = {}, {
  isUpdate = false
} = {}) => {
  const sanitized = {};
  for (const field of PROJECT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      sanitized[field] = payload[field];
    }
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "progress")) {
    sanitized.progress = toNumberOrDefault(sanitized.progress, 0);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "goal")) {
    sanitized.goal = toNumberOrDefault(sanitized.goal, 0);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "raised")) {
    sanitized.raised = toNumberOrDefault(sanitized.raised, 0);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "livesImpacted")) {
    sanitized.livesImpacted = toNumberOrDefault(sanitized.livesImpacted, 0);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "volunteersEngaged")) {
    sanitized.volunteersEngaged = toNumberOrDefault(sanitized.volunteersEngaged, 0);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "impact")) {
    sanitized.impact = Object.fromEntries(Object.entries(sanitized.impact || {}).filter(([key]) => key).map(([key, value]) => [key, toNumberOrDefault(value, 0)]));
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "startDate")) {
    sanitized.startDate = toDateOrUndefined(sanitized.startDate);
    if (isUpdate && sanitized.startDate === undefined) {
      sanitized.startDate = null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "endDate")) {
    sanitized.endDate = toDateOrUndefined(sanitized.endDate);
    if (isUpdate && sanitized.endDate === undefined) {
      sanitized.endDate = null;
    }
  }
  return sanitized;
};
const serializeProject = project => {
  const data = project.toJSON ? project.toJSON() : project;
  return {
    ...data,
    id: String(data._id),
    impact: data.impact instanceof Map ? Object.fromEntries(data.impact) : data.impact || {}
  };
};
const buildProjectQuery = ({
  category,
  status,
  search
}) => {
  const query = {};
  if (category && category !== "all") {
    query.category = {
      [Op.iLike]: exactText(category)
    };
  }
  if (status && status !== "all") {
    query.status = status;
  }
  if (search) {
    query[Op.or] = [{
      title: {
        [Op.iLike]: containsText(search)
      }
    }, {
      description: {
        [Op.iLike]: containsText(search)
      }
    }, {
      longDescription: {
        [Op.iLike]: containsText(search)
      }
    }, {
      location: {
        [Op.iLike]: containsText(search)
      }
    }];
  }
  return query;
};
const listProjects = async (req, res) => {
  return res.json(await listRecords(Project, {
    where: buildProjectQuery(req.query),
    order: [["createdAt", "DESC"]]
  }, req.query, serializeProject));
};
const getProjectById = async (req, res) => {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    return res.status(404).json({
      success: false,
      message: "Project not found."
    });
  }
  return res.json({
    success: true,
    data: serializeProject(project)
  });
};
const getProjectMetrics = async (req, res) => {
  const [rows] = await sequelize.query("SELECT * FROM public.raavanan_project_metrics()");
  return res.json({
    success: true,
    data: Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]))
  });
};
const createProject = async (req, res) => {
  const project = await Project.create(sanitizeProjectPayload(req.body));
  return res.status(201).json({
    success: true,
    message: "Project created successfully.",
    data: serializeProject(project)
  });
};
const updateProject = async (req, res) => {
  const payload = sanitizeProjectPayload(req.body, {
    isUpdate: true
  });
  const project = await updateById(Project, req.params.id, payload);
  if (!project) {
    return res.status(404).json({
      success: false,
      message: "Project not found."
    });
  }
  return res.json({
    success: true,
    message: "Project updated successfully.",
    data: serializeProject(project)
  });
};
const deleteProject = async (req, res) => {
  const project = await deleteById(Project, req.params.id);
  if (!project) {
    return res.status(404).json({
      success: false,
      message: "Project not found."
    });
  }
  return res.json({
    success: true,
    message: "Project deleted successfully."
  });
};
module.exports = {
  sanitizeProjectPayload,
  serializeProject,
  listProjects,
  getProjectById,
  getProjectMetrics,
  createProject,
  updateProject,
  deleteProject
};
