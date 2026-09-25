const { google } = require('googleapis');

const SHEET_NAME = 'Registrations';
// Draft-list tab for the faction-reveal email fallback (people with no
// Telegram Chat ID) -- this project has no Gmail-sending credentials, so
// instead of real Gmail API drafts, each person's Name/Email/Subject/Body
// is written here for manual copy-paste into a real draft.
const DRAFT_SHEET_NAME = 'Faction Reveal — Email Drafts';
const DRAFT_SHEET_HEADERS = ['Name', 'Email', 'Subject', 'Body'];
// Fetched wide (through BZ), well past the 35 canonical fields, so extra
// columns someone adds by hand on the live sheet (e.g. a "Payment request"
// tracking column someone inserted) don't get silently truncated out of
// the read -- they're just ignored by buildCanonicalToPhysical() below,
// since their header text won't match any canonical field name. Includes
// the header row (A1, not A2) -- getAllRows() reads it on every call to
// detect the sheet's current physical column order (see below).
const DATA_RANGE = `${SHEET_NAME}!A1:BZ`;
const HEADER_RANGE = `${SHEET_NAME}!A1:BZ1`;

// Canonical field order. Every other file in this codebase reads and
// writes rows using THESE indices -- r[0] is always Reg ID, r[8] is always
// Top Faction, r[16] is always Telegram Chat ID, and so on -- regardless
// of which physical column that field actually sits in on the live sheet.
// This matters because the physical order isn't stable: someone dragged
// Payment Status and Hotel Cost to sit right after Name at one point,
// which would otherwise have silently corrupted every positional read and
// write in the codebase (e.g. the bot's /start handler would have started
// writing chat IDs into the Submitted At column). getAllRows() and the
// write helpers below are the only code that has to know about the
// sheet's actual physical layout -- they resolve it fresh from the live
// header row on every call and translate to/from these canonical indices,
// so a human reordering columns in the Sheet UI can't desync the rest of
// the app from the data again.
const HEADERS = [
  'Reg ID', 'Name', 'Email', 'Telegram', 'Phone', 'Arrival', 'Housing', 'Contribution (€)',
  'Top Faction', 'M', 'S', 'R', 'T', 'K', 'Payment Status', 'Submitted At', 'Telegram Chat ID', 'Language',
  'Contributions', 'Contribution Details', 'Hotel Cost (€)',
  'Joined Group', 'Joined Checked At', 'Invite Sent At', 'Last Reminded At',
  'Waitlisted',
  'Hotel Notified At', 'Hotel Payment Status', 'Hotel Last Reminded At',
  'Cancelled', 'Needs Refund',
  'Arrival Notice Sent At', 'Needs Follow-up',
  'Faction Reveal Sent At', 'Faction Reveal Draft Created At',
];

function colLetterFor(index) {
  let s = '';
  let i = index + 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function colIndexFor(letter) {
  let i = 0;
  for (const ch of letter) i = i * 26 + (ch.charCodeAt(0) - 64);
  return i - 1;
}

// Matches the live header row (by exact trimmed text) against HEADERS to
// find which physical column each canonical field currently lives in. A
// header cell whose text isn't a recognized field name is ignored
// (harmless leftover). A canonical field with no matching header cell
// anywhere -- shouldn't normally happen, since ensureHeaders() fills
// blanks -- falls back to its own canonical position rather than losing
// that column's data entirely.
function buildCanonicalToPhysical(headerRow) {
  const canonicalToPhysical = new Array(HEADERS.length).fill(-1);
  const claimed = new Set();
  (headerRow || []).forEach((cell, physicalIdx) => {
    const name = (cell || '').trim();
    if (!name) return;
    const canonicalIdx = HEADERS.findIndex((h, ci) => h === name && !claimed.has(ci));
    if (canonicalIdx !== -1) {
      canonicalToPhysical[canonicalIdx] = physicalIdx;
      claimed.add(canonicalIdx);
    }
  });
  canonicalToPhysical.forEach((v, ci) => { if (v === -1) canonicalToPhysical[ci] = ci; });
  return canonicalToPhysical;
}

let sheetsClient = null;
// Cached per warm container, refreshed on every getAllRows() call (which
// almost every write in this codebase calls first via findRowByRegId /
// findRowByChatId) -- see buildCanonicalToPhysical's comment above.
let columnMapCache = null;

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

// Used by write helpers that don't call getAllRows() first within the same
// invocation. Falls back to a dedicated header-row fetch if the cache is
// cold (e.g. a fresh warm container hitting a write path first).
async function getColumnMap() {
  if (columnMapCache) return columnMapCache;
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: HEADER_RANGE,
  });
  columnMapCache = buildCanonicalToPhysical((res.data.values && res.data.values[0]) || []);
  return columnMapCache;
}

async function getAllRows() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: DATA_RANGE,
  });
  const values = res.data.values || [];
  const headerRow = values[0] || [];
  columnMapCache = buildCanonicalToPhysical(headerRow);
  return values.slice(1).map((physicalRow) => columnMapCache.map((physIdx) => physicalRow[physIdx] ?? ''));
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
async function writeRowAt(rowNumber, canonicalRow) {
  const sheets = await getSheets();
  const canonicalToPhysical = await getColumnMap();
  // Sized to the furthest-right canonical field's actual physical position,
  // not a hardcoded letter -- a stray extra column inserted somewhere in
  // the middle of the sheet (see DATA_RANGE's comment) can push a
  // canonical field further right than its own index would suggest.
  const maxPhysicalIdx = Math.max(...canonicalToPhysical);
  const physicalRow = new Array(maxPhysicalIdx + 1).fill('');
  canonicalRow.forEach((val, ci) => { physicalRow[canonicalToPhysical[ci]] = val; });
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A${rowNumber}:${colLetterFor(maxPhysicalIdx)}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [physicalRow] },
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

// colLetter is the CANONICAL column letter (i.e. what that field's letter
// would be if the sheet were still in its original A-AI order) -- callers
// throughout this codebase don't need to know or care what physical
// column that translates to right now.
async function updateCell(rowNumber, colLetter, value) {
  const sheets = await getSheets();
  const canonicalToPhysical = await getColumnMap();
  const physicalLetter = colLetterFor(canonicalToPhysical[colIndexFor(colLetter)]);
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!${physicalLetter}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

// Writes many scattered cells as one API call instead of one per cell --
// a per-row loop calling updateCell twice per row can rack up enough write
// requests in a single burst to trip Google's per-minute write quota
// (hit in practice with ~20 calls across 10 rows in an 8s check-membership run).
// updates: [{ rowNumber, colLetter, value }, ...]. colLetter is CANONICAL
// (see updateCell's comment above).
async function batchUpdateCells(updates) {
  if (!updates.length) return;
  const sheets = await getSheets();
  const canonicalToPhysical = await getColumnMap();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates.map((u) => ({
        range: `${SHEET_NAME}!${colLetterFor(canonicalToPhysical[colIndexFor(u.colLetter)])}${u.rowNumber}`,
        values: [[u.value]],
      })),
    },
  });
}

// Creates the "Faction Reveal — Email Drafts" tab with its header row if it
// doesn't already exist. Never touches the tab again if it's already there
// (mirrors ensureHeaders's "don't clobber what's already set up" stance).
async function ensureFactionDraftSheet() {
  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID });
  const exists = meta.data.sheets.some((s) => s.properties.title === DRAFT_SHEET_NAME);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: DRAFT_SHEET_NAME } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!A1:D1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [DRAFT_SHEET_HEADERS] },
  });
}

// rows: [[name, email, subject, body], ...]. A single append call regardless
// of how many rows, since this tab is fully self-contained (we control every
// column, no risk of the "stray value throws off append's heuristic" problem
// that writeRowAt exists to avoid on the main Registrations sheet).
async function appendFactionDraftRows(rows) {
  if (!rows.length) return;
  await ensureFactionDraftSheet();
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!A:D`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

module.exports = { getAllRows, writeRowAt, ensureHeaders, nextRegId, findRowByRegId, findRowByChatId, findDuplicate, updateCell, batchUpdateCells, appendFactionDraftRows, SHEET_NAME, HEADERS };
