const { google } = require('googleapis');

const SHEET_NAME = 'Registrations';
const DATA_RANGE = `${SHEET_NAME}!A2:R`;

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

async function appendRow(row) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A:R`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

async function nextRegId() {
  const rows = await getAllRows();
  let max = 0;
  for (const r of rows) {
    const m = /^GM-(\d+)$/.exec(r[0] || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `GM-${String(max + 1).padStart(3, '0')}`;
}

// rowNumber is the 1-indexed sheet row (data starts at row 2)
async function findRowByRegId(regId) {
  const rows = await getAllRows();
  const idx = rows.findIndex((r) => r[0] === regId);
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

module.exports = { getAllRows, appendRow, nextRegId, findRowByRegId, updateCell, SHEET_NAME };
