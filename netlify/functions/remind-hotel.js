const { getAllRows, batchUpdateCells } = require('./lib/sheets');
const { buildHotelReminderMessage, sendMessage } = require('./lib/telegram');

const DELAY_MS = 300;
const TIME_BUDGET_MS = 8000;
const HOTEL_HOUSING = 'Hotel Maximilian';
const COOLDOWN_DAYS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Courtesy cooldown, not a hard skip -- lets this run repeatedly (correct
// behavior for reminders) without re-nudging the same person same-week.
function withinCooldown(ts, days) {
  if (!ts) return false;
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then < days * 24 * 60 * 60 * 1000;
}

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

  try {
    const rows = await getAllRows();
    const targets = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if ((row[6] || '') !== HOTEL_HOUSING) continue;
      if (row[29] === 'TRUE') continue; // cancelled -- not coming, no hotel payment to chase
      if (!row[16]) continue; // no Telegram Chat ID
      if (!row[26]) continue; // not yet notified about the hotel payment
      if ((row[27] || '').trim() === 'Bezahlt') continue; // hotel payment already made
      if (withinCooldown(row[28], COOLDOWN_DAYS)) continue; // reminded recently
      targets.push({ rowNumber: i + 2, row });
    }

    const startedAt = Date.now();
    let sentTo = 0;
    const writes = [];
    for (const { rowNumber, row } of targets) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      const chatId = row[16];
      const lang = row[17] || 'de';
      try {
        const html = buildHotelReminderMessage(lang);
        await sendMessage(chatId, html);
        writes.push({ rowNumber, colLetter: 'AC', value: new Date().toISOString() });
        sentTo++;
      } catch (err) {
        console.error('remind-hotel: could not send to row', rowNumber, err.message);
      }
      await sleep(DELAY_MS);
    }

    await batchUpdateCells(writes);

    return { statusCode: 200, body: JSON.stringify({ success: true, sentTo }) };
  } catch (err) {
    console.error('remind-hotel error', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message || 'Could not send hotel payment reminders.' }) };
  }
};
