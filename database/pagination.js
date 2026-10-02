const parsePositiveInteger = (value, fallback) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
};

// Pagination is opt-in so existing public list consumers keep receiving all rows.
const listRecords = async (model, options, query, serialize) => {
  if (query.page === undefined) {
    const rows = await model.findAll(options);
    return { success: true, data: rows.map(serialize) };
  }

  const page = parsePositiveInteger(query.page, 1);
  const pageSize = Math.min(parsePositiveInteger(query.pageSize, 10), 100);
  const { rows, count } = await model.findAndCountAll({
    ...options,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return {
    success: true,
    data: rows.map(serialize),
    totalRowCount: count,
  };
};

module.exports = { listRecords };
