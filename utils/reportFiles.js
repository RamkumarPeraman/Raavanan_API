const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024;
const reportUploadDir = () => path.resolve(process.env.REPORT_UPLOAD_DIR || path.join(__dirname, "..", "uploads", "reports"));

const decodeReportPdf = ({ name, data } = {}) => {
  if (typeof name !== "string" || !/\.pdf$/i.test(name.trim())) {
    throw Object.assign(new Error("Choose a PDF file."), { status: 400 });
  }
  if (typeof data !== "string" || !data || data.length > Math.ceil(MAX_REPORT_FILE_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw Object.assign(new Error("The PDF is invalid or exceeds 10 MB."), { status: 400 });
  }
  const buffer = Buffer.from(data, "base64");
  if (!buffer.length || buffer.length > MAX_REPORT_FILE_BYTES || buffer.subarray(0, 5).toString() !== "%PDF-" || !buffer.includes("%%EOF")) {
    throw Object.assign(new Error("Choose a valid PDF no larger than 10 MB."), { status: 400 });
  }
  return buffer;
};

const saveReportPdf = async (file) => {
  const buffer = decodeReportPdf(file);
  const filename = `${randomUUID()}.pdf`;
  await fs.mkdir(reportUploadDir(), { recursive: true });
  await fs.writeFile(path.join(reportUploadDir(), filename), buffer, { flag: "wx" });
  return {
    url: `/api/reports/files/${filename}`,
    fileSize: `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`,
    originalName: path.basename(file.name),
  };
};

const getReportPdfPath = (filename) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(filename)) return null;
  return path.join(reportUploadDir(), filename);
};

const removeManagedReportPdf = async (url) => {
  const match = typeof url === "string" && /^\/api\/reports\/files\/([^/]+)$/.exec(url);
  const filePath = match && getReportPdfPath(match[1]);
  if (!filePath) return false;
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};

module.exports = { MAX_REPORT_FILE_BYTES, decodeReportPdf, saveReportPdf, getReportPdfPath, removeManagedReportPdf };
