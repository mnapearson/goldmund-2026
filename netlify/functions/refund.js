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

    // Manual toggle for the "Needs Refund" worklist -- cancel.js sets this
    // TRUE automatically on cancelling someone who'd paid; this is how the
    // admin clears it once the refund is actually sent (or re-flags it by
    // mistake). Independent of Payment Status, which stays Bezahlt as the
    // permanent record that money was received.
    const needsRefund = data.needsRefund !== false;
    await updateCell(found.rowNumber, 'AE', needsRefund ? 'TRUE' : 'FALSE');

    return { statusCode: 200, body: JSON.stringify({ success: true, regId: data.regId, needsRefund }) };
  } catch (err) {
    console.error('refund error', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Could not update refund status.' }) };
  }
};
