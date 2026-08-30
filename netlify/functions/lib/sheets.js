const { google } = require('googleapis');

const SHEET_NAME = 'Registrations';
// Data-write range (writeRowAt) covers A:Z -- unlike group-membership/invite
// history (V-Y), which is genuinely unknown until later functions fill it
// in, Waitlisted (Z) IS known at signup time (register.js computes it
// against live capacity), so it's written alongside the rest of the row.
const DATA_RANGE = `${SHEET_NAME}!A2:Z`;
const HEADER_RANGE = `${SHEET_NAME}!A1:Z1`;
const HEADERS = [
  'Reg ID', 'Name', 'Email', 'Telegram', 'Phone', 'Arrival', 'Housing', 'Contribution (€)',
  'Top Faction', 'M', 'S', 'R', 'T', 'K', 'Payment Status', 'Submitted At', 'Telegram Chat ID', 'Language',
  'Contributions', 'Contribution Details', 'Hotel Cost (€)',
  'Joined Group', 'Joined Checked At', 'Invite Sent At', 'Last Reminded At',
  'Waitlisted',
];

let sheetsClient = null;

async function getSheets() {
  if (sheetsClient) return sheetsClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Missing Google service account credentials');
  const auth = new google.auth.JWT(email, null, key, ['https://www.googleapis.com/auth/spreadsheets']);
  await auth.authorize();
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

async function getAllRows() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: DATA_RANGE,
  });
  return res.data.values || [];
}

// Fills in any blank header cells with the expected column names — never
// overwrites a cell that already holds different text, so a manually
// customized header row is left alone. Lets new columns (like S/T for
// contribution interest) appear automatically on the next write instead
// of requiring someone to edit the sheet by hand first.
async function ensureHeaders() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: HEADER_RANGE,
  });
  const current = (res.data.values && res.data.values[0]) || [];
  const merged = HEADERS.map((h, i) => (current[i] && current[i].trim()) ? current[i] : h);
  const changed = merged.some((v, i) => v !== (current[i] || ''));
  if (!changed) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: HEADER_RANGE,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [merged] },
  });
}

// Writes a row at an exact, explicitly-computed row number instead of
// using values.append's own "find the table and insert" heuristic.
// That heuristic determines both the target row AND which column to
// start writing at by scanning the sheet, and a single stray value
// sitting in the wrong column of an otherwise-empty row is enough to
// throw it off — every subsequent append can silently land 6+ columns
// to the right of where it should, with the real Reg ID column left
// blank. Writing to a precise A{row}:T{row} range removes that
// ambiguity entirely: there is no table to detect, just a fixed
// address for the write to land on.
async function writeRowAt(rowNumber, row) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A${rowNumber}:Z${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

// Pass already-fetched rows to avoid a redundant read when the caller
// already has them (e.g. after checking for a duplicate registration).
async function nextRegId(rows) {
  const data = rows || (await getAllRows());
  let max = 0;
  for (const r of data) {
    const m = /^GM-(\d+)$/.exec(r[0] || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `GM-${String(max + 1).padStart(3, '0')}`;
}

function normEmail(v) {
  return (v || '').trim().toLowerCase();
}
function normPhone(v) {
  const digits = (v || '').replace(/[^\d+]/g, '');
  // "00" is the standard international-dialing equivalent of "+", so
  // "0049..." and "+49..." refer to the same number.
  return digits.startsWith('00') ? '+' + digits.slice(2) : digits;
}

// Finds an existing row whose email or phone matches, ignoring case and
// formatting differences (spaces, dashes, parens). Phone only counts as
// a match if both sides actually have one, so two blank phone fields
// don't collide.
function findDuplicate(rows, email, phone) {
  const wantEmail = normEmail(email);
  const wantPhone = normPhone(phone);
  return rows.find((r) => {
    const rowEmail = normEmail(r[2]);
    const rowPhone = normPhone(r[4]);
    if (wantEmail && rowEmail === wantEmail) return true;
    if (wantPhone && rowPhone && rowPhone === wantPhone) return true;
    return false;
  });
}

// rowNumber is the 1-indexed sheet row (data starts at row 2)
async function findRowByRegId(regId) {
  const rows = await getAllRows();
  const idx = rows.findIndex((r) => r[0] === regId);
  if (idx === -1) return null;
  return { rowNumber: idx + 2, row: rows[idx] };
}

// For a private 1:1 chat with a bot, Telegram's chat_id equals the other
// party's user_id -- so the "Telegram Chat ID" column doubles as that
// registrant's user ID for group-membership lookups.
async function findRowByChatId(chatId) {
  const rows = await getAllRows();
  const idx = rows.findIndex((r) => String(r[16] || '') === String(chatId));
  if (idx === -1) return null;
  return { rowNumber: idx + 2, row: rows[idx] };
}

async function updateCell(rowNumber, colLetter, value) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!${colLetter}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

// Writes many scattered cells as one API call instead of one per cell --
// a per-row loop calling updateCell twice per row can rack up enough write
// requests in a single burst to trip Google's per-minute write quota
// (hit in practice with ~20 calls across 10 rows in an 8s check-membership run).
// updates: [{ rowNumber, colLetter, value }, ...]
async function batchUpdateCells(updates) {
  if (!updates.length) return;
  const sheets = await getSheets();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates.map((u) => ({ range: `${SHEET_NAME}!${u.colLetter}${u.rowNumber}`, values: [[u.value]] })),
    },
  });
}

module.exports = { getAllRows, writeRowAt, ensureHeaders, nextRegId, findRowByRegId, findRowByChatId, findDuplicate, updateCell, batchUpdateCells, SHEET_NAME, HEADERS };
