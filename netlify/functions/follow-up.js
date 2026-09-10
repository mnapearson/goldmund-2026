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

    // Manual toggle -- telegram-webhook.js's callback_query handler sets this
    // TRUE automatically when someone answers "No" to the Thursday-arrival
    // question; this is how the admin clears it once they've followed up
    // (or re-flags it by mistake), same pattern as refund.js.
    const needsFollowUp = data.needsFollowUp !== false;
    await updateCell(found.rowNumber, 'AG', needsFollowUp ? 'TRUE' : 'FALSE');

    return { statusCode: 200, body: JSON.stringify({ success: true, regId: data.regId, needsFollowUp }) };
  } catch (err) {
    console.error('follow-up error', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Could not update follow-up status.' }) };
  }
};
