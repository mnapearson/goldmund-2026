const { getAllRows, batchUpdateCells } = require('./lib/sheets');
const { buildArrivalChangeMessage, sendMessage } = require('./lib/telegram');

const DELAY_MS = 300;
// Stay well under Netlify's ~10s default function timeout even after
// accounting for real Telegram API latency on top of the per-call delay --
// same pattern as check-membership.js's time-budgeted, resumable batches.
const TIME_BUDGET_MS = 8000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      if ((row[5] || '') !== 'fri') continue;
      if (!row[16]) continue; // no Telegram Chat ID
      if (row[31]) continue; // already notified
      if (row[29] === 'TRUE') continue; // cancelled -- not coming, question is moot
      if (row[25] === 'TRUE') continue; // still waitlisted -- no confirmed spot to plan arrival for yet
      targets.push({ rowNumber: i + 2, row });
    }

    const startedAt = Date.now();
    let sentTo = 0;
    // Collected and written as one batchUpdate call at the end instead of
    // per-row, to avoid tripping Google's per-minute write quota.
    const writes = [];
    for (const { rowNumber, row } of targets) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      const chatId = row[16];
      const regId = row[0];
      const lang = row[17] || 'de';
      try {
        const { text, replyMarkup } = buildArrivalChangeMessage(regId, lang);
        await sendMessage(chatId, text, { reply_markup: replyMarkup });
        writes.push({ rowNumber, colLetter: 'AF', value: new Date().toISOString() });
        sentTo++;
      } catch (err) {
        console.error('notify-arrival-change: could not send to row', rowNumber, err.message);
      }
      await sleep(DELAY_MS);
    }

    await batchUpdateCells(writes);

    return { statusCode: 200, body: JSON.stringify({ success: true, sentTo }) };
  } catch (err) {
    console.error('notify-arrival-change error', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message || 'Could not send arrival notices.' }) };
  }
};
