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
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let update;
  try {
    update = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 200, body: 'ignored' };
  }

  const message = update.message;
  const chatId = message && message.chat && message.chat.id;
  const text = (message && message.text) || '';

  // Always ack 200 to Telegram — non-200 responses trigger retries.
  if (!chatId) return { statusCode: 200, body: 'ignored' };

  const match = /^\/start(?:@\w+)?(?:\s+(\S+))?/.exec(text.trim());
  if (!match) return { statusCode: 200, body: 'ignored' };

  const regId = match[1];
  if (!regId) {
    try {
      await sendMessage(chatId, 'Bitte nutze den Link von deiner Anmeldebestätigung, um deine Registrierung abzurufen.\n\nPlease use the link from your registration confirmation screen to retrieve your registration.');
    } catch (e) {
      console.error('telegram send error', e);
    }
    return { statusCode: 200, body: 'ok' };
  }

  try {
    const found = await findRowByRegId(regId);
    if (!found) {
      await sendMessage(chatId, `Registrierung <b>${regId}</b> nicht gefunden.\n\nRegistration <b>${regId}</b> not found.`);
      return { statusCode: 200, body: 'ok' };
    }

    await updateCell(found.rowNumber, 'Q', chatId);

    const entry = rowToEntry(found.row);
    const html = buildConfirmationMessage(entry, entry.lang);
    await sendMessage(chatId, html);
  } catch (err) {
    console.error('telegram-webhook error', err);
    try {
      await sendMessage(chatId, 'Etwas ist schiefgelaufen. Bitte versuche es später erneut oder kontaktiere die Organisator*innen.\n\nSomething went wrong. Please try again later or contact the organizers.');
    } catch (e) {
      console.error('telegram send error', e);
    }
  }

  return { statusCode: 200, body: 'ok' };
};
