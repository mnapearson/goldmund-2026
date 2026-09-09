const { findRowByRegId, updateCell } = require('./lib/sheets');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) };
  }

  if (!process.env.ADMIN_PASSPHRASE || data.passphrase !== process.env.ADMIN_PASSPHRASE) {
    return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Incorrect passphrase' }) };
  }

  if (!data.regId) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing regId' }) };
  }

  try {
    const found = await findRowByRegId(data.regId);
    if (!found) {
      return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Registration not found' }) };
    }

    // Reversible on purpose -- pass cancelled:false to undo a misclick.
    // Doesn't touch Payment Status or Hotel Payment Status, so whatever was
    // paid stays visible as the "needs refund" signal after cancelling.
    const cancelled = data.cancelled !== false;
    await updateCell(found.rowNumber, 'AD', cancelled ? 'TRUE' : 'FALSE');

    return { statusCode: 200, body: JSON.stringify({ success: true, regId: data.regId, cancelled }) };
  } catch (err) {
    console.error('cancel error', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Could not update cancellation status.' }) };
  }
};
