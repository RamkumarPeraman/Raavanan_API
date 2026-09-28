const { updateById, deleteById } = require("../database/records");
const VolunteerOpportunity = require("../models/VolunteerOpportunity");
const serializeOpportunity = opportunity => {
  const data = opportunity.toJSON ? opportunity.toJSON() : opportunity;
  return {
    ...data,
    id: String(data._id)
  };
};
const listVolunteerOpportunities = async (req, res) => {
  const query = req.query.includeInactive === "true" ? {} : {
    status: "active"
  };
  const opportunities = await VolunteerOpportunity.findAll({
    where: query,
    order: [["createdAt", "DESC"]]
  });
  return res.json({
    success: true,
    data: opportunities.map(serializeOpportunity)
  });
};
const createVolunteerOpportunity = async (req, res) => {
  const opportunity = await VolunteerOpportunity.create(req.body);
  return res.status(201).json({
    success: true,
    message: "Volunteer opportunity created successfully.",
    data: serializeOpportunity(opportunity)
  });
};
const updateVolunteerOpportunity = async (req, res) => {
  const opportunity = await updateById(VolunteerOpportunity, req.params.id, req.body);
  if (!opportunity) {
    return res.status(404).json({
      success: false,
      message: "Volunteer opportunity not found."
    });
  }
  return res.json({
    success: true,
    message: "Volunteer opportunity updated successfully.",
    data: serializeOpportunity(opportunity)
  });
};
const deleteVolunteerOpportunity = async (req, res) => {
  const opportunity = await deleteById(VolunteerOpportunity, req.params.id);
  if (!opportunity) {
    return res.status(404).json({
      success: false,
      message: "Volunteer opportunity not found."
    });
  }
  return res.json({
    success: true,
    message: "Volunteer opportunity deleted successfully."
  });
};
module.exports = {
  listVolunteerOpportunities,
  createVolunteerOpportunity,
  updateVolunteerOpportunity,
  deleteVolunteerOpportunity
};
