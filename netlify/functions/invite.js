const { findRowByRegId } = require('./lib/sheets');
const { buildInviteMessage, sendMessage } = require('./lib/telegram');

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

  if (!data.regId || !data.groupLink) {
    return { statusCode: 400, body: JSON.stringify({ error: 'regId and groupLink are required' }) };
  }

  try {
    const found = await findRowByRegId(data.regId);
    if (!found) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Registration not found' }) };
    }

    const row = found.row;
    const paymentStatus = (row[14] || '').trim().toLowerCase();
    if (paymentStatus !== 'bezahlt') {
      return { statusCode: 409, body: JSON.stringify({ error: 'not_paid' }) };
    }

    const chatId = row[16] || '';
    if (!chatId) {
      return { statusCode: 409, body: JSON.stringify({ error: 'no_chat_id' }) };
    }

    const lang = row[17] || 'de';
    const text = buildInviteMessage(data.groupLink, lang);
    await sendMessage(chatId, text);

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('invite error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Could not send invite.' }) };
  }
};
