require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const connectDB = require("./config/db");
const { sequelize } = connectDB;
const { migrate } = require("./database/migrate");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const donationRoutes = require("./routes/donations");
const serviceRoutes = require("./routes/services");
const volunteerRoutes = require("./routes/volunteers");
const projectRoutes = require("./routes/projects");
const eventRoutes = require("./routes/events");
const blogRoutes = require("./routes/blogs");
const reportRoutes = require("./routes/reports");
const volunteerOpportunityRoutes = require("./routes/volunteerOpportunities");
const chatbotRoutes = require("./routes/chatbot");
const messengerRoutes = require("./routes/messenger");
const roleRoutes = require("./routes/roles");
const adminSettingsRoutes = require("./routes/adminSettings");
const {
  store
} = require("./data/store");
const {
  projectSeeds
} = require("./data/projectSeeds");
const {
  eventSeeds,
  blogSeeds,
  volunteerOpportunitySeeds,
  reportSeeds
} = require("./data/contentSeeds");
const {
  buildSwaggerSpec
} = require("./docs/swagger");
const User = require("./models/User");
const Project = require("./models/Project");
const Event = require("./models/Event");
const Blog = require("./models/Blog");
const Report = require("./models/Report");
const VolunteerOpportunity = require("./models/VolunteerOpportunity");
const Role = require("./models/Role");
const bcrypt = require("bcryptjs");
const {
  createMembershipId,
  resolveMembershipType
} = require("./utils/userHelpers");
const app = express();
const PORT = process.env.PORT || 5000;
const swaggerSpec = buildSwaggerSpec(PORT);
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
  credentials: true
}));
app.use(express.json({
  limit: "20mb"
}));
app.use(express.urlencoded({
  extended: true,
  limit: "20mb"
}));
app.get("/api/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ success: true, message: "Raavanan API is running.", database: "postgresql", status: "connected" });
  } catch {
    res.status(503).json({ success: false, database: "postgresql", status: "unavailable" });
  }
});
app.get("/api/docs.json", (req, res) => {
  res.json(swaggerSpec);
});
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/admin-settings", adminSettingsRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/volunteers", volunteerRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/volunteer-opportunities", volunteerOpportunityRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/messenger", messengerRoutes);
app.use("/api/roles", roleRoutes);
app.get("/api/testimonials", (req, res) => res.json({
  success: true,
  data: store.testimonials
}));
app.get("/api/merchandise", (req, res) => res.json({
  success: true,
  data: store.merchandise
}));
app.post("/api/contact", (req, res) => {
  res.status(201).json({
    success: true,
    message: "Contact form submitted successfully.",
    data: req.body
  });
});
app.post("/api/feedback", (req, res) => {
  res.status(201).json({
    success: true,
    message: "Feedback submitted successfully.",
    data: req.body
  });
});
app.post("/api/newsletter/subscribe", (req, res) => {
  res.status(201).json({
    success: true,
    message: "Subscribed successfully.",
    email: req.body.email
  });
});
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found."
  });
});
app.use((error, req, res, next) => {
  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ success: false, message: "A record with these unique details already exists." });
  }
  if (error.name === "SequelizeValidationError" || error.name === "SequelizeForeignKeyConstraintError" || ["23514", "22P02", "22007"].includes(error.original?.code)) {
    return res.status(400).json({ success: false, message: "Invalid record data. Check the required fields and allowed values." });
  }
  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error("Request failed:", error.name);
  if (error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Uploaded image is too large. Please use a smaller image."
    });
  }
  res.status(500).json({
    success: false,
    message: "Internal server error."
  });
});
const seedUsers = async () => {
  const existingUsers = await User.count({});
  if (existingUsers > 0) {
    return;
  }
  const seedData = [["superadmin@rtngo.org", "Super Admin", "super_admin", "admin123", "Administration"], ["admin@rtngo.org", "Admin User", "admin", "admin123", "Administration"], ["manager@rtngo.org", "Program Manager", "manager", "manager123", "Education"], ["coordinator@rtngo.org", "Volunteer Coordinator", "volunteer_coordinator", "coord123", "Volunteer Management"], ["volunteer@rtngo.org", "Volunteer User", "volunteer", "vol12345", "Environment"], ["donor@rtngo.org", "Donor User", "donor", "donor123", "Fundraising"], ["member@rtngo.org", "Member User", "member", "member123", "Education"]];
  await User.bulkCreate(await Promise.all(seedData.map(async ([email, name, role, password, department]) => ({
    name,
    email,
    phone: "",
    role,
    status: "active",
    department,
    membershipId: createMembershipId(),
    membershipType: resolveMembershipType(role),
    passwordHash: await bcrypt.hash(password, 10),
    joinDate: new Date().toISOString().split("T")[0],
    lastActive: new Date()
  }))), {
    validate: true,
    individualHooks: true
  });
};
const seedProjects = async () => {
  const existingProjects = await Project.count({});
  if (existingProjects > 0) {
    return;
  }
  await Project.bulkCreate(projectSeeds, {
    validate: true,
    individualHooks: true
  });
};
const seedCollection = async (Model, seedData) => {
  const existingCount = await Model.count({});
  if (existingCount > 0) {
    return;
  }
  await Model.bulkCreate(seedData, {
    validate: true,
    individualHooks: true
  });
};
const seedRoles = async () => {
  const systemRoles = [{
    name: "super_admin",
    displayName: "Super Admin",
    description: "Full system access with no restrictions.",
    permissions: Role.AVAILABLE_PERMISSIONS,
    isSystem: true,
    color: "#7c3aed"
  }, {
    name: "admin",
    displayName: "Administrator",
    description: "Administrative access to manage users, content, and operations.",
    permissions: ["users:read", "users:write", "roles:read", "volunteers:read", "volunteers:write", "projects:read", "projects:write", "events:read", "events:write", "blogs:read", "blogs:write", "donations:read", "reports:read", "reports:write", "services:read", "services:write"],
    isSystem: true,
    color: "#0d9488"
  }, {
    name: "manager",
    displayName: "Manager",
    description: "Manages projects, events, and program operations.",
    permissions: ["projects:read", "projects:write", "events:read", "events:write", "blogs:read", "blogs:write", "reports:read", "volunteers:read", "services:read"],
    isSystem: true,
    color: "#2563eb"
  }, {
    name: "volunteer_coordinator",
    displayName: "Volunteer Coordinator",
    description: "Coordinates volunteer activities and manages volunteer data.",
    permissions: ["volunteers:read", "volunteers:write", "events:read", "projects:read", "reports:read"],
    isSystem: true,
    color: "#d97706"
  }, {
    name: "volunteer",
    displayName: "Volunteer",
    description: "Active volunteer with access to volunteer portal.",
    permissions: ["events:read", "projects:read", "services:read"],
    isSystem: true,
    color: "#059669"
  }, {
    name: "member",
    displayName: "Member",
    description: "Regular NGO member with standard access.",
    permissions: ["events:read", "projects:read", "blogs:read", "services:read"],
    isSystem: true,
    color: "#64748b"
  }, {
    name: "donor",
    displayName: "Donor",
    description: "Donor with access to donation history and reports.",
    permissions: ["donations:read", "projects:read", "reports:read", "events:read"],
    isSystem: true,
    color: "#db2777"
  }];
  for (const role of systemRoles) {
    await Role.findOrCreate({ where: { name: role.name }, defaults: role });
  }
};
const startServer = async () => {
  await connectDB();
  await migrate();
  if (process.env.SEED_DEMO_DATA === "true") {
    if (process.env.NODE_ENV === "production") throw new Error("Demo seeding is disabled in production.");
    await seedRoles();
    await seedUsers();
    await seedProjects();
    await seedCollection(Event, eventSeeds);
    await seedCollection(Blog, blogSeeds);
    await seedCollection(Report, reportSeeds);
    await seedCollection(VolunteerOpportunity, volunteerOpportunitySeeds);
  } else {
    await seedRoles();
  }
  const server = app.listen(PORT, () => {
    console.log(`Raavanan API listening on port ${PORT}`);
  });
  const shutdown = () => server.close(() => sequelize.close().then(() => { process.exitCode = 0; }));
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return server;
};
if (require.main === module) startServer().catch(error => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
module.exports = { app, startServer, seedRoles };
