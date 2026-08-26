const { getAllRows, batchUpdateCells } = require('./lib/sheets');
const { getChatMember } = require('./lib/telegram');

const DELAY_MS = 200;
// Stay well under Netlify's ~10s default function timeout even after
// accounting for real Telegram API latency on top of the per-call delay.
const TIME_BUDGET_MS = 8000;
const JOINED_STATUSES = new Set(['member', 'administrator', 'creator']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!groupChatId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: 'TELEGRAM_GROUP_CHAT_ID is not set. Forward a group message to @userinfobot to find it, then add it to the environment.' }),
    };
  }

  try {
    const rows = await getAllRows();
    const candidates = [];
    for (let i = 0; i < rows.length; i++) {
      const chatId = rows[i][16] || '';
      if (!chatId) continue;
      candidates.push({ rowNumber: i + 2, chatId, checkedAt: rows[i][22] || '' });
    }
    // Never-checked (empty) and stalest-checked rows first, so repeated
    // clicks make forward progress instead of re-checking the same rows.
    candidates.sort((a, b) => {
      if (!a.checkedAt && !b.checkedAt) return 0;
      if (!a.checkedAt) return -1;
      if (!b.checkedAt) return 1;
      return a.checkedAt.localeCompare(b.checkedAt);
    });

    // "remaining" tracks registrants that have NEVER been checked even once,
    // not "candidates this run didn't reach" -- with never-checked rows always
    // sorted first, this hits 0 exactly once every registrant has an initial
    // result, regardless of how many runs it took to get there. Re-checking
    // already-covered rows afterward for freshness doesn't count against it.
    const neverCheckedTotal = candidates.filter((c) => !c.checkedAt).length;

    const startedAt = Date.now();
    let checked = 0;
    let checkedNeverBefore = 0;
    // Collected and written as one batchUpdate call at the end instead of
    // per-row, so a full sync run (up to ~20+ cell writes) costs a single
    // Sheets API write request rather than tripping the per-minute write quota.
    const writes = [];
    for (const candidate of candidates) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;

      const now = new Date().toISOString();
      let joined = false;
      try {
        const res = await getChatMember(groupChatId, candidate.chatId);
        const status = res.result && res.result.status;
        joined = JOINED_STATUSES.has(status);
        writes.push({ rowNumber: candidate.rowNumber, colLetter: 'V', value: joined ? 'TRUE' : 'FALSE' });
      } catch (e) {
        console.error('check-membership: getChatMember failed for', candidate.chatId, e.message);
        // Leave "Joined Group" untouched on error (e.g. user blocked the bot,
        // or never actually started a chat with it) but still stamp the
        // check time so this row isn't perpetually first in line.
      }
      writes.push({ rowNumber: candidate.rowNumber, colLetter: 'W', value: now });
      checked++;
      if (!candidate.checkedAt) checkedNeverBefore++;
      await sleep(DELAY_MS);
    }

    await batchUpdateCells(writes);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, checked, total: candidates.length, remaining: Math.max(0, neverCheckedTotal - checkedNeverBefore) }),
    };
  } catch (err) {
    console.error('check-membership error', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message || 'Could not check group membership.' }) };
  }
};
