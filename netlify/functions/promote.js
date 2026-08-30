const { findRowByRegId, updateCell } = require('./lib/sheets');
const { buildConfirmationMessage, sendMessage } = require('./lib/telegram');

function rowToEntry(row) {
  return {
    regId: row[0] || '',
    name: row[1] || '',
    housing: row[6] || '',
    contribution: Number(row[7]) || 0,
    topFaction: row[8] || '',
    scores: { M: Number(row[9]) || 0, S: Number(row[10]) || 0, R: Number(row[11]) || 0, T: Number(row[12]) || 0, K: Number(row[13]) || 0 },
    lang: row[17] || 'de',
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

    if (found.row[25] !== 'TRUE') {
      return { statusCode: 409, body: JSON.stringify({ ok: false, error: 'This registration is not on the waitlist.' }) };
    }

    await updateCell(found.rowNumber, 'Z', 'FALSE');

    const chatId = found.row[16] || '';
    const hasChatId = !!chatId;
    if (hasChatId) {
      const entry = rowToEntry(found.row);
      const html = buildConfirmationMessage(entry, entry.lang);
      await sendMessage(chatId, html);
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, hasChatId }) };
  } catch (err) {
    console.error('promote error', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message || 'Could not promote from waitlist.' }) };
  }
};
