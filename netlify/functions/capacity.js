const { getAllRows } = require('./lib/sheets');

// Keep in sync with MAX_CAPACITY in register.js -- this is a separate,
// public (unauthenticated) read-only endpoint so the registration form can
// show live capacity before someone fills out the whole form, without
// exposing anything from the passphrase-gated admin.js.
const MAX_CAPACITY = 110;

// Keep in sync with REGISTRATION_CLOSED in register.js.
const REGISTRATION_CLOSED = true;

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  try {
    const rows = await getAllRows();
    const activeCount = rows.filter((r) => (r[25] || '').trim().toUpperCase() !== 'TRUE' && (r[29] || '').trim().toUpperCase() !== 'TRUE').length;
    const waitlistCount = rows.filter((r) => (r[25] || '').trim().toUpperCase() === 'TRUE' && (r[29] || '').trim().toUpperCase() !== 'TRUE').length;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, activeCount, capacity: MAX_CAPACITY, waitlistCount, full: activeCount >= MAX_CAPACITY, closed: REGISTRATION_CLOSED }),
    };
  } catch (err) {
    console.error('capacity error', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Could not load capacity.' }) };
  }
};
