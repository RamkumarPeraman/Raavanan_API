const { updateById, deleteById, containsText } = require("../database/records");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Volunteer = require("../models/Volunteer");
const VOLUNTEER_FIELDS = ["fullName", "email", "phone", "address", "gender", "city", "state", "pincode", "dateOfBirth", "education", "educationOther", "institution", "occupation", "occupationOther", "interests", "skills", "skillsOther", "capacity", "capacityOther", "availability", "hoursPerWeek", "experience", "motivation", "previousVolunteer", "emergencyContact", "hearAbout", "hearAboutOther", "selectedOpportunityId", "selectedOpportunityTitle", "corePurpose", "newLaw", "viewOnSociety", "leadershipAction", "dailyHabit", "agreeConduct", "agreeDeclaration", "status"];
const toArray = value => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return [];
};
const sanitizeVolunteerPayload = (payload = {}, {
  isUpdate = false
} = {}) => {
  const sanitized = {};
  for (const field of VOLUNTEER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      sanitized[field] = payload[field];
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "name") && !sanitized.fullName) {
    sanitized.fullName = payload.name;
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "email") && typeof sanitized.email === "string") {
    sanitized.email = sanitized.email.trim().toLowerCase();
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "fullName") && typeof sanitized.fullName === "string") {
    sanitized.fullName = sanitized.fullName.trim();
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "phone") && typeof sanitized.phone === "string") {
    sanitized.phone = sanitized.phone.trim();
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "interests")) {
    sanitized.interests = toArray(sanitized.interests);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "skills")) {
    sanitized.skills = toArray(sanitized.skills);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "capacity")) {
    sanitized.capacity = toArray(sanitized.capacity);
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "hearAbout")) {
    if (Array.isArray(sanitized.hearAbout)) {
      sanitized.hearAbout = sanitized.hearAbout.filter(Boolean).join(", ");
    } else if (typeof sanitized.hearAbout === "string") {
      sanitized.hearAbout = sanitized.hearAbout.trim();
    }
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "availability")) {
    sanitized.availability = sanitized.availability && typeof sanitized.availability === "object" && !Array.isArray(sanitized.availability) ? sanitized.availability : {};
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "emergencyContact")) {
    sanitized.emergencyContact = sanitized.emergencyContact && typeof sanitized.emergencyContact === "object" && !Array.isArray(sanitized.emergencyContact) ? {
      name: sanitized.emergencyContact.name || "",
      phone: sanitized.emergencyContact.phone || "",
      relationship: sanitized.emergencyContact.relationship || ""
    } : {
      name: "",
      phone: "",
      relationship: ""
    };
  }
  if (!isUpdate && !sanitized.status) {
    sanitized.status = "pending";
  }
  return sanitized;
};
const serializeVolunteer = volunteer => {
  const data = volunteer.toJSON ? volunteer.toJSON() : volunteer;
  const { passwordHash, ...safeData } = data;
  return {
    ...safeData,
    id: String(data._id)
  };
};
const listVolunteers = async (req, res) => {
  try {
    const query = {};
    if (req.query.status && req.query.status !== "all") {
      query.status = req.query.status;
    }
    if (req.query.search) {
      query[Op.or] = [{
        fullName: {
          [Op.iLike]: containsText(req.query.search)
        }
      }, {
        email: {
          [Op.iLike]: containsText(req.query.search)
        }
      }, {
        phone: {
          [Op.iLike]: containsText(req.query.search)
        }
      }, {
        city: {
          [Op.iLike]: containsText(req.query.search)
        }
      }, {
        state: {
          [Op.iLike]: containsText(req.query.search)
        }
      }];
    }
    const volunteers = await Volunteer.findAll({
      where: query,
      order: [["createdAt", "DESC"]]
    });
    return res.json({
      success: true,
      data: volunteers.map(serializeVolunteer)
    });
  } catch (error) {
    console.error("Error listing volunteers:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list volunteers."
    });
  }
};
const getVolunteerById = async (req, res) => {
  try {
    const volunteer = await Volunteer.findByPk(req.params.id);
    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: "Volunteer not found."
      });
    }
    return res.json({
      success: true,
      data: serializeVolunteer(volunteer)
    });
  } catch (error) {
    console.error("Error getting volunteer:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get volunteer."
    });
  }
};
const registerVolunteer = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const existingVolunteer = await Volunteer.findOne({
      where: {
        email
      }
    });
    if (existingVolunteer) {
      return res.status(409).json({
        success: false,
        message: "Volunteer already registered with this email."
      });
    }
    const volunteerPayload = sanitizeVolunteerPayload({
      ...req.body,
      email
    }, {
      isUpdate: false
    });
    volunteerPayload.passwordHash = await bcrypt.hash(req.body.password || "volunteer123", 10);
    const volunteer = await Volunteer.create(volunteerPayload);
    return res.status(201).json({
      success: true,
      volunteerId: String(volunteer._id),
      message: "Volunteer registration submitted successfully.",
      data: serializeVolunteer(volunteer)
    });
  } catch (error) {
    console.error("Error registering volunteer:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to register volunteer.",
      error: error.message
    });
  }
};
const volunteerLogin = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const volunteer = await Volunteer.unscoped().findOne({
      where: {
        email
      }
    });
    if (!volunteer) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }
    const passwordMatches = await bcrypt.compare(req.body.password || "", volunteer.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }
    const token = jwt.sign({
      id: String(volunteer._id),
      email: volunteer.email,
      role: "volunteer"
    }, process.env.JWT_SECRET || "raavanan-dev-secret", {
      expiresIn: "7d"
    });
    return res.json({
      success: true,
      token,
      user: {
        id: String(volunteer._id),
        name: volunteer.fullName,
        email: volunteer.email,
        role: "volunteer",
        status: volunteer.status
      }
    });
  } catch (error) {
    console.error("Error during volunteer login:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed."
    });
  }
};
const updateVolunteerStatus = async (req, res) => {
  try {
    const update = {};
    if (req.body.status) {
      update.status = req.body.status;
    }
    const volunteer = await updateById(Volunteer, req.params.id, update);
    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: "Volunteer not found."
      });
    }
    return res.json({
      success: true,
      message: "Volunteer status updated successfully.",
      data: {
        id: String(volunteer._id),
        status: volunteer.status
      }
    });
  } catch (error) {
    console.error("Error updating volunteer status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update volunteer status."
    });
  }
};
const updateVolunteer = async (req, res) => {
  try {
    const volunteerPayload = sanitizeVolunteerPayload(req.body, {
      isUpdate: true
    });
    const volunteer = await updateById(Volunteer, req.params.id, volunteerPayload);
    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: "Volunteer not found."
      });
    }
    return res.json({
      success: true,
      message: "Volunteer updated successfully.",
      data: serializeVolunteer(volunteer)
    });
  } catch (error) {
    console.error("Error updating volunteer:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update volunteer."
    });
  }
};
const deleteVolunteer = async (req, res) => {
  try {
    const volunteer = await deleteById(Volunteer, req.params.id);
    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: "Volunteer not found."
      });
    }
    return res.json({
      success: true,
      message: "Volunteer deleted successfully."
    });
  } catch (error) {
    console.error("Error deleting volunteer:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete volunteer."
    });
  }
};
module.exports = {
  listVolunteers,
  getVolunteerById,
  registerVolunteer,
  volunteerLogin,
  updateVolunteer,
  updateVolunteerStatus,
  deleteVolunteer
};
