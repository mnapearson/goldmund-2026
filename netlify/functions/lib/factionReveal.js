const { getAllRows, batchUpdateCells, appendFactionDraftRows } = require('./sheets');
const { sendMessage } = require('./telegram');
const { FACTION_MESSAGES } = require('./faction-messages');

const DELAY_MS = 300;
// Stay well under Netlify's ~10s default function timeout even after
// accounting for real Telegram API latency on top of the per-call delay --
// same pattern as check-membership.js / hotelNotify.js's time-budgeted,
// resumable batches. Only the Telegram path needs this: the email/draft-list
// path is a single sheet-append call regardless of how many people are in it.
const TIME_BUDGET_MS = 8000;
const VALID_CODES = new Set(['M', 'S', 'R', 'T', 'K']);
// Deliberately not FACTION_NAMES.de from lib/telegram.js ("Mystiker" etc) --
// these subject lines use the same loanword forms the reveal texts
// themselves use ("WILLKOMMEN MYSTIC!"), not the general-purpose DE labels.
const FACTION_SUBJECT_NAMES = { M: 'Mystic', S: 'Surrealist', R: 'Romantic', T: 'Techi', K: 'Collectivist' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Shared by notify-faction-reveal.js (dashboard button) and
// telegram-webhook.js's /factionreveal command, so the two trigger paths
// can't drift out of sync.
async function runFactionReveal() {
  const rows = await getAllRows();
  const telegramTargets = [];
  const emailTargets = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const code = (row[8] || '').trim();
    if (!VALID_CODES.has(code)) continue;
    if (row[29] === 'TRUE') continue; // cancelled -- not attending
    if (row[25] === 'TRUE') continue; // waitlisted -- no confirmed spot to reveal a faction for yet

    const chatId = row[16] || '';
    if (chatId) {
      if (row[33]) { skipped++; continue; } // Faction Reveal Sent At already set
      telegramTargets.push({ rowNumber: i + 2, chatId, code });
    } else {
      if (row[34]) { skipped++; continue; } // Faction Reveal Draft Created At already set
      const email = row[2] || '';
      if (!email) continue; // nothing to draft to -- not eligible either way
      emailTargets.push({ rowNumber: i + 2, name: row[1] || '', email, code });
    }
  }

  // Telegram path.
  const startedAt = Date.now();
  let telegramSent = 0;
  // Collected and written as one batchUpdate call at the end instead of
  // per-row, to avoid tripping Google's per-minute write quota.
  const telegramWrites = [];
  for (const { rowNumber, chatId, code } of telegramTargets) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    try {
      await sendMessage(chatId, FACTION_MESSAGES[code]);
      telegramWrites.push({ rowNumber, colLetter: 'AH', value: new Date().toISOString() });
      telegramSent++;
    } catch (err) {
      console.error('factionReveal: could not send to row', rowNumber, err.message);
    }
    await sleep(DELAY_MS);
  }
  await batchUpdateCells(telegramWrites);

  // Email/draft-list path -- one append call for the whole batch, then one
  // batched timestamp write. No per-person API calls, so no time budget.
  let draftsCreated = 0;
  if (emailTargets.length) {
    const draftRows = emailTargets.map(({ name, email, code }) => [
      name,
      email,
      `Deine Fraktion beim Goldenen Kongress — ${FACTION_SUBJECT_NAMES[code]}`,
      FACTION_MESSAGES[code],
    ]);
    await appendFactionDraftRows(draftRows);
    const draftWrites = emailTargets.map(({ rowNumber }) => ({ rowNumber, colLetter: 'AI', value: new Date().toISOString() }));
    await batchUpdateCells(draftWrites);
    draftsCreated = emailTargets.length;
  }

  return { telegramSent, draftsCreated, skipped };
}

module.exports = { runFactionReveal, FACTION_SUBJECT_NAMES };
