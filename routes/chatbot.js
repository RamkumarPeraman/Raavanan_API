const express = require("express");
const {
  body
} = require("express-validator");
const {
  askChatbot
} = require("../controllers/chatbotController");
const {
  optionalAuthenticate
} = require("../middleware/auth");
const {
  handleValidation
} = require("../middleware/validation");
const router = express.Router();
router.post("/ask", optionalAuthenticate, [body("message").trim().notEmpty().withMessage("Message is required."), body("history").optional().isArray().withMessage("History must be an array."), handleValidation], askChatbot);
module.exports = router;
