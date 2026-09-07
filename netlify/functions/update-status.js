const { findRowByRegId, updateCell } = require('./lib/sheets');

const VALID_STATUSES = ['Bezahlt', 'Ausstehend'];
// "payment" = general contribution (Payment Status, col O).
// "hotel_payment" = the separate Hotel Maximilian charge (Hotel Payment
// Status, col AB) -- distinct toggle, distinct column, same values.
const FIELD_COLUMNS = { payment: 'O', hotel_payment: 'AB' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!process.env.ADMIN_PASSPHRASE || data.passphrase !== process.env.ADMIN_PASSPHRASE) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Incorrect passphrase' }) };
  }

  const field = FIELD_COLUMNS[data.field] ? data.field : 'payment';
  if (!data.regId || !VALID_STATUSES.includes(data.status)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'regId and a valid status ("Bezahlt" or "Ausstehend") are required' }) };
  }

  try {
    const found = await findRowByRegId(data.regId);
    if (!found) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Registration not found' }) };
    }

    await updateCell(found.rowNumber, FIELD_COLUMNS[field], data.status);

    return { statusCode: 200, body: JSON.stringify({ success: true, regId: data.regId, status: data.status, field }) };
  } catch (err) {
    console.error('update-status error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not update payment status.' }) };
  }
};
