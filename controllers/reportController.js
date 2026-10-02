const { updateById, deleteById, containsText, exactText } = require("../database/records");
const { Op } = require("sequelize");
const Report = require("../models/Report");
const { listRecords } = require("../database/pagination");
const REPORT_FIELDS = ["title", "type", "category", "year", "period", "publishedDate", "description", "summary", "fileSize", "pages", "downloads", "views", "featured", "thumbnail", "url", "metrics", "highlights", "projects", "testimonials", "financial", "gallery", "status"];
const toNumberOrDefault = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toArray = value => Array.isArray(value) ? value.filter(Boolean) : [];
const toPlainObject = value => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
};
const sanitizeReportPayload = (payload = {}) => {
  const sanitized = {};
  for (const field of REPORT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      sanitized[field] = payload[field];
    }
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "pages")) {
    sanitized.pages = toNumberOrDefault(sanitized.pages, 0);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "downloads")) {
    sanitized.downloads = toNumberOrDefault(sanitized.downloads, 0);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "views")) {
    sanitized.views = toNumberOrDefault(sanitized.views, 0);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "featured")) {
    sanitized.featured = Boolean(sanitized.featured);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "metrics")) {
    sanitized.metrics = Object.fromEntries(Object.entries(toPlainObject(sanitized.metrics)).filter(([key]) => key));
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "highlights")) {
    sanitized.highlights = toArray(sanitized.highlights);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "gallery")) {
    sanitized.gallery = toArray(sanitized.gallery);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "projects")) {
    sanitized.projects = toArray(sanitized.projects).map(project => ({
      name: project?.name || "",
      description: project?.description || "",
      beneficiaries: project?.beneficiaries || "",
      budget: project?.budget || ""
    })).filter(project => project.name);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "testimonials")) {
    sanitized.testimonials = toArray(sanitized.testimonials).map(testimonial => ({
      name: testimonial?.name || "",
      role: testimonial?.role || "",
      quote: testimonial?.quote || ""
    })).filter(testimonial => testimonial.name && testimonial.quote);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "financial")) {
    const financial = toPlainObject(sanitized.financial);
    sanitized.financial = Object.keys(financial).length === 0 ? undefined : {
      income: financial.income || "",
      expenses: financial.expenses || "",
      breakdown: Object.fromEntries(Object.entries(toPlainObject(financial.breakdown)).filter(([key]) => key))
    };
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "publishedDate") && !sanitized.publishedDate) {
    sanitized.publishedDate = new Date().toISOString().split("T")[0];
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "category") && !sanitized.category && sanitized.type) {
    sanitized.category = sanitized.type.split("_").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  if (!sanitized.status) {
    sanitized.status = "published";
  }
  return sanitized;
};
const serializeReport = report => {
  const data = report.toJSON ? report.toJSON() : report;
  return {
    ...data,
    id: String(data._id),
    metrics: data.metrics instanceof Map ? Object.fromEntries(data.metrics) : data.metrics || {},
    financial: data.financial ? {
      ...data.financial,
      breakdown: data.financial.breakdown instanceof Map ? Object.fromEntries(data.financial.breakdown) : data.financial.breakdown || {}
    } : undefined
  };
};
const buildReportQuery = ({
  type,
  year,
  search,
  status,
  featured
}) => {
  const query = {};
  if (type && type !== "all") {
    query[Op.or] = [{
      type
    }, {
      category: {
        [Op.iLike]: exactText(type)
      }
    }];
  }
  if (year && year !== "all") {
    query.year = String(year);
  }
  if (status && status !== "all") {
    query.status = status;
  } else {
    query.status = {
      [Op.ne]: "archived"
    };
  }
  if (featured === "true") {
    query.featured = true;
  }
  if (search) {
    query[Op.and] = [...(query[Op.and] || []), {
      [Op.or]: [{
        title: {
          [Op.iLike]: containsText(search)
        }
      }, {
        description: {
          [Op.iLike]: containsText(search)
        }
      }, {
        summary: {
          [Op.iLike]: containsText(search)
        }
      }, {
        category: {
          [Op.iLike]: containsText(search)
        }
      }]
    }];
  }
  return query;
};
const listReports = async (req, res) => {
  return res.json(await listRecords(Report, {
    where: buildReportQuery(req.query),
    order: [["publishedDate", "DESC"], ["createdAt", "DESC"]]
  }, req.query, serializeReport));
};
const getReportById = async (req, res) => {
  const report = await Report.findByPk(req.params.id);
  if (!report) {
    return res.status(404).json({
      success: false,
      message: "Report not found."
    });
  }
  return res.json({
    success: true,
    data: serializeReport(report)
  });
};
const createReport = async (req, res) => {
  const report = await Report.create(sanitizeReportPayload(req.body));
  return res.status(201).json({
    success: true,
    message: "Report created successfully.",
    data: serializeReport(report)
  });
};
const updateReport = async (req, res) => {
  const report = await updateById(Report, req.params.id, sanitizeReportPayload(req.body));
  if (!report) {
    return res.status(404).json({
      success: false,
      message: "Report not found."
    });
  }
  return res.json({
    success: true,
    message: "Report updated successfully.",
    data: serializeReport(report)
  });
};
const deleteReport = async (req, res) => {
  const report = await deleteById(Report, req.params.id);
  if (!report) {
    return res.status(404).json({
      success: false,
      message: "Report not found."
    });
  }
  return res.json({
    success: true,
    message: "Report deleted successfully."
  });
};
module.exports = {
  listReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport
};
