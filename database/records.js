async function updateById(Model, id, values, options = {}) {
  const record = await Model.findByPk(id, options);
  if (!record) return null;
  const writable = Object.fromEntries(Object.entries(values).filter(([key, value]) =>
    value !== undefined && !["_id", "id", "createdAt", "updatedAt"].includes(key) && Model.rawAttributes[key]
  ));
  return record.update(writable, options);
}

async function deleteById(Model, id, options = {}) {
  const record = await Model.findByPk(id, options);
  if (record) await record.destroy(options);
  return record;
}

// Treat search input as literal text, including SQL LIKE wildcard characters.
const containsText = (value) => `%${String(value).replace(/[\\%_]/g, "\\$&")}%`;
const exactText = (value) => String(value).replace(/[\\%_]/g, "\\$&");

module.exports = { updateById, deleteById, containsText, exactText };
