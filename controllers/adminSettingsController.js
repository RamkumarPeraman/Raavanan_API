const AdminSettings = require("../models/AdminSettings");
const { sequelize } = require("../config/db");
const sanitizeHeroNewsCarousel = slides => Array.isArray(slides) ? slides.map((slide, index) => ({
  id: String(slide?.id || `hero-slide-${Date.now()}-${index}`),
  category: String(slide?.category || "Latest News").trim(), title: String(slide?.title || "").trim(),
  summary: String(slide?.summary || "").trim(), image: String(slide?.image || "").trim(),
  link: String(slide?.link || "").trim(), buttonLabel: String(slide?.buttonLabel || "Read more").trim(),
})).filter(slide => slide.title || slide.summary || slide.image) : [];
const publicSettings = settings => {
  const data = settings.toJSON();
  data.donationQrImage = data.donationQrImage
    ? `/admin-settings/donation-qr?v=${encodeURIComponent(settings.updatedAt?.getTime() || 0)}`
    : "";
  return data;
};
async function getAdminSettings(req, res) {
  const [settings] = await AdminSettings.findOrCreate({ where: { key: "global" } });
  res.json({ success: true, data: publicSettings(settings) });
}
async function getDonationQr(req, res) {
  const settings = await AdminSettings.findOne({ where: { key: "global" } });
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(settings?.donationQrImage || "");
  if (!match) return res.sendStatus(404);
  res.set("Cache-Control", "public, max-age=86400");
  res.type(`image/${match[1]}`).send(Buffer.from(match[2], "base64"));
}
async function updateAdminSettings(req, res) {
  const qrImage = req.body.donationQrImage;
  if (qrImage !== undefined && qrImage !== "" &&
      (typeof qrImage !== "string" || qrImage.length > 7_000_000 ||
       !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(qrImage))) {
    return res.status(400).json({ success: false, message: "Upload a PNG, JPG, WebP or GIF QR image under 5 MB." });
  }
  const settings = await sequelize.transaction(async transaction => {
    await AdminSettings.findOrCreate({ where: { key: "global" }, transaction });
    const settings = await AdminSettings.findOne({ where: { key: "global" }, transaction, lock: transaction.LOCK.UPDATE });
    if (req.body.donationQrImage !== undefined) settings.donationQrImage = req.body.donationQrImage;
    if (req.body.bankDetails) settings.bankDetails = { ...settings.bankDetails, ...req.body.bankDetails };
    if (req.body.heroNewsCarousel !== undefined) settings.heroNewsCarousel = sanitizeHeroNewsCarousel(req.body.heroNewsCarousel);
    return settings.save({ transaction });
  });
  res.json({ success: true, data: publicSettings(settings), message: "Settings updated successfully." });
}
module.exports = { getAdminSettings, getDonationQr, updateAdminSettings };
