const { findRowByRegId } = require('./lib/sheets');
const { buildReminderMessage, sendMessage } = require('./lib/telegram');

function rowToEntry(row) {
  return {
    regId: row[0] || '',
    name: row[1] || '',
    contribution: Number(row[7]) || 0,
    lang: row[17] || 'de',
    telegramChatId: row[16] || '',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  if (!process.env.ADMIN_PASSPHRASE || data.passphrase !== process.env.ADMIN_PASSPHRASE) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect passphrase' }) };
  }

  if (!data.regId) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing regId' }) };
  }

  try {
    const found = await findRowByRegId(data.regId);
    if (!found) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'Registration not found' }) };
    }

    const entry = rowToEntry(found.row);
    if (!entry.telegramChatId) {
      return {
        statusCode: 409,
        body: JSON.stringify({ ok: false, error: 'This person has not started the Telegram bot yet, so no reminder can be sent.' }),
      };
    }

    const html = buildReminderMessage(entry, entry.lang);
    await sendMessage(entry.telegramChatId, html);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('remind error', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Could not send reminder.' }) };
  }
};
