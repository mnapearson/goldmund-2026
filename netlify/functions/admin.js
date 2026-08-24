const { getAllRows, HEADERS } = require('./lib/sheets');

function toCSV(rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [HEADERS, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

function toEntry(r) {
  return {
    regId: r[0] || '',
    name: r[1] || '',
    email: r[2] || '',
    telegram: r[3] || '',
    phone: r[4] || '',
    arrival: r[5] || '',
    housing: r[6] || '',
    contribution: Number(r[7]) || 0,
    topFaction: r[8] || '',
    scores: { M: Number(r[9]) || 0, S: Number(r[10]) || 0, R: Number(r[11]) || 0, T: Number(r[12]) || 0, K: Number(r[13]) || 0 },
    paymentStatus: r[14] || 'Ausstehend',
    submittedAt: r[15] || '',
    telegramChatId: r[16] || '',
    lang: r[17] || 'de',
    contributions: r[18] || '',
    contributionDetails: r[19] || '',
    hotelCost: r[20] || '',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  const params = event.queryStringParameters || {};
  if (!process.env.ADMIN_PASSPHRASE || params.passphrase !== process.env.ADMIN_PASSPHRASE) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect passphrase' }) };
  }

  try {
    const rows = await getAllRows();

    if (params.action === 'export') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="goldmund-2026-registrations.csv"',
        },
        body: toCSV(rows),
      };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, entries: rows.map(toEntry) }) };
  } catch (err) {
    console.error('admin error', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Could not load registrations.' }) };
  }
};
