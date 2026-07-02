const { appendRow, nextRegId } = require('./lib/sheets');

function bankBlock() {
  return {
    bank: process.env.PAYMENT_BANK || '',
    iban: process.env.PAYMENT_IBAN || '',
    bic: process.env.PAYMENT_BIC || '',
    holder: process.env.PAYMENT_HOLDER || '',
    deadline: process.env.PAYMENT_DEADLINE || '',
  };
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
    const regId = await nextRegId();
    const scores = data.scores || {};
    const submittedAt = new Date().toISOString();

    await appendRow([
      regId,
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
    ]);

    return { statusCode: 200, body: JSON.stringify({ ok: true, regId, bank }) };
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
