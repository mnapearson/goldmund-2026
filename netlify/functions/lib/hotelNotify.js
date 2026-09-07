const { getAllRows, batchUpdateCells } = require('./sheets');
const { buildHotelNotifyMessage, sendMessage } = require('./telegram');

const DELAY_MS = 300;
// Stay well under Netlify's ~10s default function timeout even after
// accounting for real Telegram API latency on top of the per-call delay --
// same pattern as check-membership.js's time-budgeted, resumable batches.
const TIME_BUDGET_MS = 8000;
const HOTEL_HOUSING = 'Hotel Maximilian';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Shared by notify-hotel.js (dashboard button) and telegram-webhook.js's
// /notifyhotel command, so the two trigger paths can't drift out of sync.
async function runHotelNotify() {
  const rows = await getAllRows();
  const hotelRows = [];
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][6] || '') !== HOTEL_HOUSING) continue;
    hotelRows.push({ rowNumber: i + 2, row: rows[i] });
  }

  const alreadyNotified = hotelRows.filter((r) => r.row[26]).length;
  const targets = hotelRows.filter((r) => r.row[16] && !r.row[26]);

  const startedAt = Date.now();
  let sentTo = 0;
  // Collected and written as one batchUpdate call at the end instead of
  // per-row, to avoid tripping Google's per-minute write quota.
  const writes = [];
  for (const { rowNumber, row } of targets) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    const chatId = row[16];
    const lang = row[17] || 'de';
    try {
      const html = buildHotelNotifyMessage(lang);
      await sendMessage(chatId, html);
      writes.push({ rowNumber, colLetter: 'AA', value: new Date().toISOString() });
      sentTo++;
    } catch (err) {
      console.error('hotelNotify: could not send to row', rowNumber, err.message);
    }
    await sleep(DELAY_MS);
  }

  await batchUpdateCells(writes);

  return { sentTo, alreadyNotified };
}

module.exports = { runHotelNotify };
