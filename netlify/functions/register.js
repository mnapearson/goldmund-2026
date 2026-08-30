const { writeRowAt, ensureHeaders, nextRegId, getAllRows, findDuplicate } = require('./lib/sheets');

// Fixed hotel cost (3 nights at €35), separate from the sliding-scale
// contribution. Derived here from the housing value instead of trusting
// a client-sent number, since it's meant to be fixed, not adjustable.
const HOTEL_COST = 105;

// Venue capacity. Computed live against non-waitlisted rows at submission
// time (not a persisted counter), so it self-corrects if someone is later
// removed from the sheet or promoted off the waitlist -- the 111th active
// signup always lands on the waitlist, whichever row number that turns out to be.
const MAX_CAPACITY = 110;

function bankBlock() {
  return {
    bank: process.env.PAYMENT_BANK || '',
    iban: process.env.PAYMENT_IBAN || '',
    bic: process.env.PAYMENT_BIC || '',
    holder: process.env.PAYMENT_HOLDER || '',
    deadline: process.env.PAYMENT_DEADLINE || '',
    wero: process.env.PAYMENT_WERO_PHONE || '',
    bankAddress: process.env.PAYMENT_BANK_ADDRESS || '',
  };
}

// Writes a new registration row, guarding against two failure modes that
// can happen when requests land close together: (a) two submissions
// computing the same "next" Reg ID, and (b) a third submission grabbing
// the same target row between our read and our write. After writing, we
// re-read the sheet and confirm our Reg ID appears exactly once, at the
// row we wrote it to. If not, something raced us — recompute against the
// fresh state and rewrite, up to 3 times.
async function writeRegistrationRow(buildRow, initialRows) {
  let rows = initialRows;
  let regId = await nextRegId(rows);
  let rowNumber = rows.length + 2; // header is row 1, data starts row 2
  let row = buildRow(regId);
  await writeRowAt(rowNumber, row);

  for (let attempt = 0; attempt < 3; attempt++) {
    const freshRows = await getAllRows();
    const idCount = freshRows.filter((r) => r[0] === regId).length;
    const landedCorrectly = freshRows[rowNumber - 2] && freshRows[rowNumber - 2][0] === regId;
    if (idCount <= 1 && landedCorrectly) return regId;

    regId = await nextRegId(freshRows);
    rowNumber = freshRows.length + 2;
    row[0] = regId;
    await writeRowAt(rowNumber, row);
  }
  return regId;
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

  const { name, email, housing, contribution } = data;
  if (!name || !email || !housing || !contribution) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing required fields' }) };
  }

  // Bank details never depend on the Sheets call, so they can always be
  // returned to the frontend as a payment fallback even if the write below fails.
  const bank = bankBlock();

  try {
    await ensureHeaders();
    const rows = await getAllRows();

    const dupe = findDuplicate(rows, email, data.phone);
    if (dupe) {
      return {
        statusCode: 409,
        body: JSON.stringify({ ok: false, code: 'duplicate', regId: dupe[0] || null, bank }),
      };
    }

    const scores = data.scores || {};
    const submittedAt = new Date().toISOString();
    const hotelCost = housing === 'hotel' ? HOTEL_COST : '';

    const activeCount = rows.filter((r) => (r[25] || '').trim().toUpperCase() !== 'TRUE').length;
    const waitlisted = activeCount >= MAX_CAPACITY;

    const regId = await writeRegistrationRow(
      (id) => [
        id,
        name,
        email,
        data.telegram || '',
        data.phone || '',
        data.arrival || '',
        data.housingLabel || housing,
        contribution,
        data.topFaction || '',
        scores.M || 0,
        scores.S || 0,
        scores.R || 0,
        scores.T || 0,
        scores.K || 0,
        'Ausstehend',
        submittedAt,
        '', // Telegram Chat ID — filled in later by telegram-webhook.js on /start
        data.lang === 'en' ? 'en' : 'de',
        data.contributions || '',
        data.contributionDetails || '',
        hotelCost,
        '', '', '', '', // Joined Group / Joined Checked At / Invite Sent At / Last Reminded At — unknown until later
        waitlisted ? 'TRUE' : 'FALSE',
      ],
      rows
    );

    return { statusCode: 200, body: JSON.stringify({ ok: true, regId, bank, hotelCost, waitlisted }) };
  } catch (err) {
    console.error('register error', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: 'Could not save your registration automatically. Please contact the organizers so they can register you manually.',
        bank,
      }),
    };
  }
};
