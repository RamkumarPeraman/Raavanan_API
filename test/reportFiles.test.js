const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { decodeReportPdf, saveReportPdf, getReportPdfPath, removeManagedReportPdf, MAX_REPORT_FILE_BYTES } = require("../utils/reportFiles");

test("accepts a PDF and saves it under an opaque public file path", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "raavanan-report-"));
  const previousDirectory = process.env.REPORT_UPLOAD_DIR;
  process.env.REPORT_UPLOAD_DIR = directory;
  try {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
    const saved = await saveReportPdf({ name: "quarterly.pdf", data: pdf.toString("base64") });
    assert.match(saved.url, /^\/api\/reports\/files\/[0-9a-f-]+\.pdf$/);
    assert.deepEqual(await fs.readFile(getReportPdfPath(saved.url.split("/").pop())), pdf);
    assert.equal(saved.originalName, "quarterly.pdf");
    assert.equal(getReportPdfPath("../server.js"), null);
    assert.equal(await removeManagedReportPdf("/reports/demo.pdf"), false);
    assert.equal(await removeManagedReportPdf("/api/reports/files/../server.js"), false);
    assert.equal(await removeManagedReportPdf(saved.url), true);
    await assert.rejects(fs.readFile(getReportPdfPath(saved.url.split("/").pop())), { code: "ENOENT" });
  } finally {
    if (previousDirectory === undefined) delete process.env.REPORT_UPLOAD_DIR;
    else process.env.REPORT_UPLOAD_DIR = previousDirectory;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("rejects invalid or oversized uploads", () => {
  assert.throws(() => decodeReportPdf({ name: "report.txt", data: Buffer.from("%PDF-1.4").toString("base64") }), /Choose a PDF/);
  assert.throws(() => decodeReportPdf({ name: "report.pdf", data: Buffer.from("not a pdf").toString("base64") }), /valid PDF/);
  const oversized = Buffer.alloc(MAX_REPORT_FILE_BYTES + 1);
  oversized.write("%PDF-");
  assert.throws(() => decodeReportPdf({ name: "report.pdf", data: oversized.toString("base64") }), /10 MB/);
});

