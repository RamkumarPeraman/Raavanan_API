const { updateById, deleteById, containsText } = require("../database/records");
const { Op } = require("sequelize");
const { listRecords } = require("../database/pagination");
const Blog = require("../models/Blog");
const serializeBlog = blog => {
  const data = blog.toJSON ? blog.toJSON() : blog;
  return {
    ...data,
    id: String(data._id)
  };
};
const listBlogs = async (req, res) => {
  const where = req.query.search ? {
    [Op.or]: ["title", "category", "author"].map(field => ({ [field]: { [Op.iLike]: containsText(req.query.search) } }))
  } : {};
  return res.json(await listRecords(Blog, {
    where,
    order: [["date", "DESC"], ["createdAt", "DESC"]]
  }, req.query, serializeBlog));
};
const getBlogById = async (req, res) => {
  const blog = await Blog.findByPk(req.params.id);
  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog not found."
    });
  }
  return res.json({
    success: true,
    data: serializeBlog(blog)
  });
};
const createBlog = async (req, res) => {
  const blog = await Blog.create(req.body);
  return res.status(201).json({
    success: true,
    message: "Blog created successfully.",
    data: serializeBlog(blog)
  });
};
const updateBlog = async (req, res) => {
  const blog = await updateById(Blog, req.params.id, req.body);
  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog not found."
    });
  }
  return res.json({
    success: true,
    message: "Blog updated successfully.",
    data: serializeBlog(blog)
  });
};
const deleteBlog = async (req, res) => {
  const blog = await deleteById(Blog, req.params.id);
  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog not found."
    });
  }
  return res.json({
    success: true,
    message: "Blog deleted successfully."
  });
};
module.exports = {
  listBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog
};
