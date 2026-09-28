const Service = require("../models/Service");
const serializeService = service => {
  const data = service.toJSON ? service.toJSON() : service;
  return {
    ...data,
    id: String(data._id)
  };
};
const listServices = async (req, res) => {
  const query = {};
  if (req.query.status && req.query.status !== "all") {
    query.status = req.query.status;
  }
  const services = await Service.findAll({
    where: query,
    order: [["createdAt", "DESC"]]
  });
  return res.json({
    success: true,
    data: services.map(serializeService)
  });
};
const getServiceById = async (req, res) => {
  const service = await Service.findByPk(req.params.id);
  if (!service) {
    return res.status(404).json({
      success: false,
      message: "Service request not found."
    });
  }
  return res.json({
    success: true,
    data: serializeService(service)
  });
};
const createService = async (req, res) => {
  const service = await Service.create({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    category: req.body.category || "general",
    message: req.body.message,
    status: "pending"
  });
  return res.status(201).json({
    success: true,
    serviceId: String(service._id),
    message: "Service request submitted successfully.",
    data: serializeService(service)
  });
};
const updateServiceStatus = async (req, res) => {
  const service = await Service.findByPk(req.params.id);
  if (!service) {
    return res.status(404).json({
      success: false,
      message: "Service request not found."
    });
  }
  service.status = req.body.status || service.status;
  await service.save();
  return res.json({
    success: true,
    message: "Service request updated successfully.",
    data: serializeService(service)
  });
};
module.exports = {
  listServices,
  getServiceById,
  createService,
  updateServiceStatus
};
