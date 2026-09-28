const OpenAI = require("openai");
const Project = require("../models/Project");
const Event = require("../models/Event");
const Blog = require("../models/Blog");
const Report = require("../models/Report");
const {
  sanitizeProjectPayload,
  serializeProject
} = require("./projectController");
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const MAX_HISTORY_MESSAGES = 6;
let openaiClient = null;
const normalizeText = (value = "") => String(value).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const tokenize = (value = "") => normalizeText(value).split(" ").filter(token => token.length > 2);
const scoreText = (queryTokens, sourceText) => {
  const haystack = normalizeText(sourceText);
  return queryTokens.reduce((score, token) => {
    if (haystack.includes(token)) {
      return score + (token.length > 5 ? 3 : 2);
    }
    return score;
  }, 0);
};
const summarizeProject = project => ({
  id: String(project._id),
  title: project.title,
  category: project.category,
  status: project.status,
  description: project.description,
  location: project.location,
  startDate: project.startDate,
  endDate: project.endDate,
  progress: project.progress,
  goal: project.goal,
  raised: project.raised,
  objectives: Array.isArray(project.objectives) ? project.objectives.slice(0, 3) : [],
  achievements: Array.isArray(project.achievements) ? project.achievements.slice(0, 3) : [],
  reportUrl: project.reportUrl
});
const summarizeEvent = event => ({
  id: String(event._id),
  title: event.title,
  type: event.type,
  category: event.category,
  description: event.description,
  date: event.date,
  time: event.time,
  location: event.location,
  capacity: event.capacity,
  registered: event.registered
});
const summarizeBlog = blog => ({
  id: String(blog._id),
  title: blog.title,
  category: blog.category,
  excerpt: blog.excerpt,
  author: blog.author,
  date: blog.date,
  tags: Array.isArray(blog.tags) ? blog.tags.slice(0, 5) : []
});
const summarizeReport = report => ({
  id: String(report._id),
  title: report.title,
  type: report.type,
  category: report.category,
  year: report.year,
  publishedDate: report.publishedDate,
  description: report.description,
  summary: report.summary,
  url: report.url
});
const findRelevantItems = (items, query, getText, summarize, fallbackCount = 3) => {
  const queryTokens = tokenize(query);
  const normalizedQuery = normalizeText(query);
  const scored = items.map(item => {
    const sourceText = getText(item);
    return {
      item,
      score: scoreText(queryTokens, sourceText) + (normalizedQuery && normalizeText(sourceText).includes(normalizedQuery) ? 6 : 0)
    };
  }).filter(entry => entry.score > 0).sort((left, right) => right.score - left.score).slice(0, fallbackCount).map(entry => summarize(entry.item));
  if (scored.length) {
    return scored;
  }
  return items.slice(0, fallbackCount).map(summarize);
};
const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openaiClient;
};
const buildSystemPrompt = () => `
You are the Raavana Thalaigal website assistant.
Answer only about the platform and the provided organization data.
Be concise, practical, and user-facing.
If the answer is available in the provided context, use it directly.
If the user asks how to do something on the site, explain the page or flow clearly.
If the answer is not in the provided context, say that you are not fully sure and guide the user to the closest page: /projects, /events, /blogs, /reports, /volunteer, /donate, /contact, /login.
Do not invent policies, prices, dates, contacts, or project facts.
Keep the answer under 140 words unless the user explicitly asks for more detail.
`;
const isProjectCreateIntent = (message = "") => {
  const normalizedMessage = normalizeText(message);
  return normalizedMessage.includes("project") && (normalizedMessage.includes("create") || normalizedMessage.includes("add") || normalizedMessage.includes("new project") || normalizedMessage.includes("make project")) || normalizedMessage.startsWith("create project") || normalizedMessage.startsWith("add project");
};
const extractJsonObject = (value = "") => {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error("Empty extraction result");
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : text;
  const startIndex = raw.indexOf("{");
  const endIndex = raw.lastIndexOf("}");
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("No JSON object found");
  }
  return JSON.parse(raw.slice(startIndex, endIndex + 1));
};
const extractProjectFromPrompt = async (client, message) => {
  const extractionResponse = await client.responses.create({
    model: DEFAULT_MODEL,
    max_output_tokens: 500,
    input: [{
      role: "developer",
      content: `
Extract project creation fields from the user's request.
Return only one JSON object. Do not include markdown.
Use these keys exactly:
title, category, status, description, longDescription, location, startDate, endDate, goal, raised, progress, livesImpacted, volunteersEngaged, objectives, achievements, partners, funding, reportUrl, impact.
Rules:
- Keep unknown scalar values as "" except numeric fields, which should be null when unknown.
- objectives, achievements, partners, funding should be arrays.
- impact should be an object of metricName:number.
- status must be one of ongoing, completed, planned. Default to ongoing when clearly creating a new live project, otherwise null if unknown.
- Do not invent facts. Only extract from the user message.
        `.trim()
    }, {
      role: "user",
      content: message
    }]
  });
  return extractJsonObject(extractOutputText(extractionResponse));
};
const buildMissingProjectFieldsMessage = missingFields => `I can create the project, but I still need these required fields: ${missingFields.join(", ")}. Please send them in one message, for example: title, category, and short description.`;
const handleProjectCreation = async ({
  client,
  message,
  user
}) => {
  if (!user) {
    return {
      answer: "Project creation through the bot requires login with an admin account."
    };
  }
  if (!["admin", "super_admin"].includes(user.role)) {
    return {
      answer: "Only admin or super admin users can create projects from the bot."
    };
  }
  const extractedProject = await extractProjectFromPrompt(client, message);
  const requiredFields = ["title", "category", "description"];
  const missingFields = requiredFields.filter(field => !String(extractedProject?.[field] || "").trim());
  if (missingFields.length > 0) {
    return {
      answer: buildMissingProjectFieldsMessage(missingFields),
      missingFields
    };
  }
  const payload = sanitizeProjectPayload({
    ...extractedProject,
    status: extractedProject.status || "ongoing",
    progress: extractedProject.progress ?? 0,
    goal: extractedProject.goal ?? 0,
    raised: extractedProject.raised ?? 0,
    livesImpacted: extractedProject.livesImpacted ?? 0,
    volunteersEngaged: extractedProject.volunteersEngaged ?? 0,
    objectives: Array.isArray(extractedProject.objectives) ? extractedProject.objectives.filter(Boolean) : [],
    achievements: Array.isArray(extractedProject.achievements) ? extractedProject.achievements.filter(Boolean) : [],
    partners: Array.isArray(extractedProject.partners) ? extractedProject.partners.filter(Boolean) : [],
    funding: Array.isArray(extractedProject.funding) ? extractedProject.funding.filter(Boolean) : [],
    impact: extractedProject.impact && typeof extractedProject.impact === "object" ? extractedProject.impact : {}
  });
  const project = await Project.create(payload);
  const savedProject = serializeProject(project);
  return {
    answer: `Project "${savedProject.title}" was created successfully with status "${savedProject.status}". You can review it from the admin dashboard or on the projects page.`,
    createdProject: savedProject
  };
};
const buildContextPayload = async message => {
  const [projects, events, blogs, reports] = await Promise.all([Project.findAll({
    order: [["featured", "DESC"], ["createdAt", "DESC"]],
    limit: 12
  }), Event.findAll({
    order: [["date", "ASC"], ["createdAt", "DESC"]],
    limit: 12
  }), Blog.findAll({
    order: [["date", "DESC"], ["createdAt", "DESC"]],
    limit: 12
  }), Report.findAll({
    order: [["featured", "DESC"], ["publishedDate", "DESC"]],
    limit: 12
  })]);
  return {
    routes: {
      home: "/",
      donate: "/donate",
      volunteer: "/volunteer",
      projects: "/projects",
      events: "/events",
      blogs: "/blogs",
      reports: "/reports",
      contact: "/contact",
      login: "/login"
    },
    quickFacts: {
      projectCount: projects.length,
      eventCount: events.length,
      blogCount: blogs.length,
      reportCount: reports.length
    },
    projects: findRelevantItems(projects, message, item => `${item.title} ${item.category} ${item.description} ${item.location} ${item.status}`, summarizeProject, 4),
    events: findRelevantItems(events, message, item => `${item.title} ${item.type} ${item.category} ${item.description} ${item.location}`, summarizeEvent, 4),
    blogs: findRelevantItems(blogs, message, item => `${item.title} ${item.category} ${item.excerpt} ${item.author} ${(item.tags || []).join(" ")}`, summarizeBlog, 4),
    reports: findRelevantItems(reports, message, item => `${item.title} ${item.type} ${item.category} ${item.description} ${item.summary}`, summarizeReport, 4),
    builtInGuidance: {
      donate: "Users can donate from /donate.",
      volunteer: "Users can apply from /volunteer.",
      contact: "Users can contact the team from /contact.",
      reports: "Users can browse reports from /reports.",
      auth: "Users can log in from /login and create an account from /signup."
    }
  };
};
const toInputMessage = message => ({
  role: message.role === "assistant" ? "assistant" : "user",
  content: String(message.text || "")
});
const extractOutputText = response => {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  if (!Array.isArray(response.output)) {
    return "";
  }
  const chunks = [];
  for (const item of response.output) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
};
const askChatbot = async (req, res) => {
  const client = getOpenAIClient();
  if (!client) {
    return res.status(503).json({
      success: false,
      message: "Chatbot AI is not configured. Add OPENAI_API_KEY on the API server.",
      code: "OPENAI_NOT_CONFIGURED"
    });
  }
  const message = String(req.body?.message || "").trim();
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  if (!message) {
    return res.status(400).json({
      success: false,
      message: "Message is required."
    });
  }
  const context = await buildContextPayload(message);
  const trimmedHistory = history.filter(item => item && typeof item.text === "string" && item.text.trim()).slice(-MAX_HISTORY_MESSAGES);
  if (isProjectCreateIntent(message)) {
    const projectCreationResult = await handleProjectCreation({
      client,
      message,
      user: req.user
    });
    return res.json({
      success: true,
      data: {
        answer: projectCreationResult.answer,
        action: projectCreationResult.createdProject ? "project_created" : "project_create_pending",
        createdProject: projectCreationResult.createdProject || null,
        missingFields: projectCreationResult.missingFields || [],
        model: DEFAULT_MODEL
      }
    });
  }
  const response = await client.responses.create({
    model: DEFAULT_MODEL,
    max_output_tokens: 320,
    input: [{
      role: "developer",
      content: buildSystemPrompt()
    }, {
      role: "developer",
      content: `Use this application context when answering:\n${JSON.stringify(context, null, 2)}`
    }, ...trimmedHistory.map(toInputMessage), {
      role: "user",
      content: message
    }]
  });
  const answer = extractOutputText(response);
  return res.json({
    success: true,
    data: {
      answer: answer || "I could not generate a useful answer right now. Please try again.",
      model: DEFAULT_MODEL,
      sourceCounts: context.quickFacts
    }
  });
};
module.exports = {
  askChatbot
};
