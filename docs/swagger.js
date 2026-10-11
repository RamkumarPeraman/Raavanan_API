const swaggerJSDoc = require("swagger-jsdoc");

const buildSwaggerSpec = (port) =>
  swaggerJSDoc({
    definition: {
      openapi: "3.0.3",
      info: {
        title: "Raavanan API",
        version: "1.0.0",
        description: "Interactive API documentation for the Raavanan web and backend project.",
      },
      servers: [
        {
          url: `http://localhost:${port}`,
          description: "Local development server",
        },
      ],
      tags: [
        { name: "System", description: "Health and system endpoints" },
        { name: "Auth", description: "User authentication endpoints" },
        { name: "Donations", description: "Donation management endpoints" },
        { name: "Services", description: "Service request endpoints" },
        { name: "Volunteers", description: "Volunteer registration and management endpoints" },
        { name: "Content", description: "Blogs, events, reports, and supporting content endpoints" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
        schemas: {
          SuccessMessage: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Operation completed successfully." },
            },
          },
          UserLoginRequest: {
            type: "object",
            required: ["email", "password"],
            properties: {
              email: { type: "string", example: "admin@rtngo.org" },
              password: { type: "string", example: "admin123" },
            },
          },
          UserSignupRequest: {
            type: "object",
            required: ["name", "email", "password"],
            properties: {
              name: { type: "string", example: "Raavanan Admin" },
              email: { type: "string", example: "admin@rtngo.org" },
              password: { type: "string", example: "admin123" },
              phone: { type: "string", example: "9876543210" },
              role: { type: "string", example: "admin" },
            },
          },
          DonationRequest: {
            type: "object",
            required: ["name", "email", "phone", "amount"],
            properties: {
              name: { type: "string", example: "Priya Singh" },
              email: { type: "string", example: "priya@example.com" },
              phone: { type: "string", example: "9876543210" },
              amount: { type: "number", example: 2500 },
              type: { type: "string", example: "one-time" },
              project: { type: "string", example: "education" },
              paymentMethod: { type: "string", example: "upi" },
              anonymous: { type: "boolean", example: false },
            },
          },
          ServiceRequest: {
            type: "object",
            required: ["name", "email", "phone", "message"],
            properties: {
              name: { type: "string", example: "Community Coordinator" },
              email: { type: "string", example: "service@example.com" },
              phone: { type: "string", example: "9123456780" },
              category: { type: "string", example: "education" },
              message: { type: "string", example: "Need educational material support." },
            },
          },
          VolunteerRegisterRequest: {
            type: "object",
            required: ["email", "phone"],
            properties: {
              fullName: { type: "string", example: "Arun Kumar" },
              email: { type: "string", example: "volunteer@rtngo.org" },
              phone: { type: "string", example: "9988776655" },
              city: { type: "string", example: "Chennai" },
              skills: {
                type: "array",
                items: { type: "string" },
                example: ["Teaching", "Fundraising"],
              },
              interests: {
                type: "array",
                items: { type: "string" },
                example: ["Education", "Community Development"],
              },
            },
          },
          ReportRequest: {
            type: "object",
            required: ["title", "type", "description", "publishedDate"],
            properties: {
              title: { type: "string", example: "Annual Report 2025-26" },
              type: { type: "string", example: "annual" },
              category: { type: "string", example: "Annual Report" },
              year: { type: "string", example: "2026" },
              description: { type: "string", example: "Comprehensive annual report." },
              publishedDate: { type: "string", example: "2026-03-20" },
              pages: { type: "number", example: 48 },
              url: { type: "string", example: "/reports/annual-2026.pdf" },
            },
          },
        },
      },
      paths: {
        "/api/health": {
          get: {
            tags: ["System"],
            summary: "Health check",
            responses: {
              200: {
                description: "API health payload",
              },
            },
          },
        },
        "/api/auth/signup": {
          post: {
            tags: ["Auth"],
            summary: "Register a user",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UserSignupRequest" },
                },
              },
            },
            responses: {
              201: { description: "User registered successfully" },
              409: { description: "User already exists" },
            },
          },
        },
        "/api/auth/login": {
          post: {
            tags: ["Auth"],
            summary: "Login a user",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UserLoginRequest" },
                },
              },
            },
            responses: {
              200: { description: "Login successful" },
              401: { description: "Invalid credentials" },
            },
          },
        },
        "/api/donations": {
          get: {
            tags: ["Donations"],
            summary: "List donations",
            responses: {
              200: { description: "Donation list" },
            },
          },
          post: {
            tags: ["Donations"],
            summary: "Create a donation",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DonationRequest" },
                },
              },
            },
            responses: {
              201: { description: "Donation created" },
              400: { description: "Validation error" },
            },
          },
        },
        "/api/donations/stats": {
          get: {
            tags: ["Donations"],
            summary: "Get donation statistics",
            responses: {
              200: { description: "Donation stats" },
            },
          },
        },
        "/api/donations/{id}": {
          get: {
            tags: ["Donations"],
            summary: "Get donation by id",
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: {
              200: { description: "Donation details" },
              404: { description: "Donation not found" },
            },
          },
          put: {
            tags: ["Donations"],
            summary: "Update donation status",
            security: [{ bearerAuth: [] }],
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      paymentStatus: { type: "string", example: "completed" },
                    },
                  },
                },
              },
            },
            responses: {
              200: { description: "Donation updated" },
              401: { description: "Unauthorized" },
            },
          },
        },
        "/api/services": {
          get: {
            tags: ["Services"],
            summary: "List service requests",
            responses: {
              200: { description: "Service request list" },
            },
          },
          post: {
            tags: ["Services"],
            summary: "Create a service request",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ServiceRequest" },
                },
              },
            },
            responses: {
              201: { description: "Service request created" },
            },
          },
        },
        "/api/services/{id}": {
          get: {
            tags: ["Services"],
            summary: "Get service request by id",
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: {
              200: { description: "Service request details" },
              404: { description: "Not found" },
            },
          },
          put: {
            tags: ["Services"],
            summary: "Update service request status",
            security: [{ bearerAuth: [] }],
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "in_progress" },
                    },
                  },
                },
              },
            },
            responses: {
              200: { description: "Service request updated" },
            },
          },
        },
        "/api/volunteers": {
          get: {
            tags: ["Volunteers"],
            summary: "List volunteers",
            responses: {
              200: { description: "Volunteer list" },
            },
          },
        },
        "/api/volunteers/register": {
          post: {
            tags: ["Volunteers"],
            summary: "Register a volunteer",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/VolunteerRegisterRequest" },
                },
              },
            },
            responses: {
              201: { description: "Volunteer registered" },
              409: { description: "Volunteer already exists" },
            },
          },
        },
        "/api/volunteers/login": {
          post: {
            tags: ["Volunteers"],
            summary: "Login a volunteer",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UserLoginRequest" },
                },
              },
            },
            responses: {
              200: { description: "Volunteer login successful" },
              401: { description: "Invalid credentials" },
            },
          },
        },
        "/api/volunteers/{id}": {
          get: {
            tags: ["Volunteers"],
            summary: "Get volunteer by id",
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: {
              200: { description: "Volunteer details" },
              404: { description: "Volunteer not found" },
            },
          },
        },
        "/api/volunteers/{id}/status": {
          put: {
            tags: ["Volunteers"],
            summary: "Update volunteer status",
            security: [{ bearerAuth: [] }],
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "active" },
                    },
                  },
                },
              },
            },
            responses: {
              200: { description: "Volunteer updated" },
            },
          },
        },
        "/api/blogs": {
          get: {
            tags: ["Content"],
            summary: "List blogs",
            responses: { 200: { description: "Blog list" } },
          },
        },
        "/api/events": {
          get: {
            tags: ["Content"],
            summary: "List events",
            responses: { 200: { description: "Event list" } },
          },
        },
        "/api/events/{id}/register": {
          post: {
            tags: ["Content"],
            summary: "Register for an event",
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      name: { type: "string", example: "Test User" },
                      email: { type: "string", example: "user@example.com" },
                    },
                  },
                },
              },
            },
            responses: {
              201: { description: "Event registration successful" },
              404: { description: "Event not found" },
            },
          },
        },
        "/api/projects": {
          get: {
            tags: ["Content"],
            summary: "List projects",
            responses: { 200: { description: "Project list" } },
          },
        },
        "/api/reports": {
          get: {
            tags: ["Content"],
            summary: "List reports",
            responses: { 200: { description: "Report list" } },
          },
          post: {
            tags: ["Content"],
            summary: "Create a report or publication",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReportRequest" },
                },
              },
            },
            responses: { 201: { description: "Report created" } },
          },
        },
        "/api/reports/upload": {
          post: {
            tags: ["Content"],
            summary: "Upload a report PDF (admin only, maximum 10 MB)",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["name", "data"],
                    properties: {
                      name: { type: "string", example: "annual-report.pdf" },
                      data: { type: "string", description: "Base64 encoded PDF content" },
                    },
                  },
                },
              },
            },
            responses: { 201: { description: "Uploaded PDF URL and file size" }, 400: { description: "Invalid PDF" } },
          },
        },
        "/api/reports/files/{filename}": {
          get: {
            tags: ["Content"],
            summary: "Open an uploaded report PDF",
            parameters: [{ name: "filename", in: "path", required: true, schema: { type: "string" } }],
            responses: { 200: { description: "PDF file" }, 404: { description: "File not found" } },
          },
        },
        "/api/reports/{id}": {
          get: {
            tags: ["Content"],
            summary: "Get report by id",
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: { 200: { description: "Report details" }, 404: { description: "Report not found" } },
          },
          put: {
            tags: ["Content"],
            summary: "Update a report or publication",
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReportRequest" },
                },
              },
            },
            responses: { 200: { description: "Report updated" } },
          },
          delete: {
            tags: ["Content"],
            summary: "Delete a report or publication",
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: { 200: { description: "Report deleted" } },
          },
        },
        "/api/testimonials": {
          get: {
            tags: ["Content"],
            summary: "List testimonials",
            responses: { 200: { description: "Testimonial list" } },
          },
        },
        "/api/merchandise": {
          get: {
            tags: ["Content"],
            summary: "List merchandise",
            responses: { 200: { description: "Merchandise list" } },
          },
        },
        "/api/contact": {
          post: {
            tags: ["Content"],
            summary: "Submit contact form",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
            responses: { 201: { description: "Contact form submitted" } },
          },
        },
        "/api/feedback": {
          post: {
            tags: ["Content"],
            summary: "Submit feedback",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
            responses: { 201: { description: "Feedback submitted" } },
          },
        },
        "/api/newsletter/subscribe": {
          post: {
            tags: ["Content"],
            summary: "Subscribe to newsletter",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      email: { type: "string", example: "user@example.com" },
                    },
                  },
                },
              },
            },
            responses: { 201: { description: "Subscription successful" } },
          },
        },
      },
    },
    apis: [],
  });

module.exports = { buildSwaggerSpec };
