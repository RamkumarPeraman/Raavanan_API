const express = require("express");
const {
  body
} = require("express-validator");
const {
  listBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog
} = require("../controllers/blogController");
const {
  authenticate,
  authorize
} = require("../middleware/auth");
const {
  handleValidation
} = require("../middleware/validation");
const router = express.Router();
router.get("/", listBlogs);
router.get("/:id", getBlogById);
router.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), [body("title").trim().notEmpty().withMessage("Title is required."), body("excerpt").trim().notEmpty().withMessage("Excerpt is required."), body("content").trim().notEmpty().withMessage("Content is required."), body("author").trim().notEmpty().withMessage("Author is required."), body("category").trim().notEmpty().withMessage("Category is required."), body("date").notEmpty().withMessage("Date is required."), handleValidation], createBlog);
router.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), updateBlog);
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), deleteBlog);
module.exports = router;
