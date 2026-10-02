const test = require('node:test');
const assert = require('node:assert/strict');
const { listRecords } = require('../database/pagination');

test('list pagination returns only the requested rows and the total row count', async () => {
  let receivedOptions;
  const model = {
    findAndCountAll: async (options) => {
      receivedOptions = options;
      return { rows: [{ id: 11 }, { id: 12 }], count: 24 };
    },
  };
  const result = await listRecords(model, { order: [['createdAt', 'DESC']] }, { page: '2', pageSize: '10' }, (row) => row);

  assert.equal(receivedOptions.limit, 10);
  assert.equal(receivedOptions.offset, 10);
  assert.deepEqual(result, { success: true, data: [{ id: 11 }, { id: 12 }], totalRowCount: 24 });
});

test('list without a page preserves the existing response', async () => {
  const model = { findAll: async () => [{ id: 1 }] };
  const result = await listRecords(model, {}, {}, (row) => row);
  assert.deepEqual(result, { success: true, data: [{ id: 1 }] });
});
