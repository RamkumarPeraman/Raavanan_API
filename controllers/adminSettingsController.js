const AdminSettings = require("../models/AdminSettings");
const { sequelize } = require("../config/db");
const sanitizeHeroNewsCarousel = slides => Array.isArray(slides) ? slides.map((slide, index) => ({
  id: String(slide?.id || `hero-slide-${Date.now()}-${index}`),
  category: String(slide?.category || "Latest News").trim(), title: String(slide?.title || "").trim(),
  summary: String(slide?.summary || "").trim(), image: String(slide?.image || "").trim(),
  link: String(slide?.link || "").trim(), buttonLabel: String(slide?.buttonLabel || "Read more").trim(),
})).filter(slide => slide.title || slide.summary || slide.image) : [];
async function getAdminSettings(req, res) {
  const [settings] = await AdminSettings.findOrCreate({ where: { key: "global" } });
  res.json({ success: true, data: settings.toJSON() });
}
async function updateAdminSettings(req, res) {
  const settings = await sequelize.transaction(async transaction => {
    await AdminSettings.findOrCreate({ where: { key: "global" }, transaction });
    const settings = await AdminSettings.findOne({ where: { key: "global" }, transaction, lock: transaction.LOCK.UPDATE });
    if (req.body.donationQrImage !== undefined) settings.donationQrImage = req.body.donationQrImage;
    if (req.body.bankDetails) settings.bankDetails = { ...settings.bankDetails, ...req.body.bankDetails };
    if (req.body.heroNewsCarousel !== undefined) settings.heroNewsCarousel = sanitizeHeroNewsCarousel(req.body.heroNewsCarousel);
    return settings.save({ transaction });
  });
  res.json({ success: true, data: settings.toJSON(), message: "Settings updated successfully." });
}
module.exports = { getAdminSettings, updateAdminSettings };
