const { findRowByRegId, updateCell } = require('./lib/sheets');

const VALID_STATUSES = ['Bezahlt', 'Ausstehend'];

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

  if (!data.regId || !VALID_STATUSES.includes(data.status)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'regId and a valid status ("Bezahlt" or "Ausstehend") are required' }) };
  }

  try {
    const found = await findRowByRegId(data.regId);
    if (!found) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Registration not found' }) };
    }

    await updateCell(found.rowNumber, 'O', data.status);

    return { statusCode: 200, body: JSON.stringify({ success: true, regId: data.regId, status: data.status }) };
  } catch (err) {
    console.error('update-status error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not update payment status.' }) };
  }
};
