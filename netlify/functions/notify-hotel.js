const { runHotelNotify } = require('./lib/hotelNotify');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) };
  }

  if (!process.env.ADMIN_PASSPHRASE || data.passphrase !== process.env.ADMIN_PASSPHRASE) {
    return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Incorrect passphrase' }) };
  }

  try {
    const { sentTo, alreadyNotified } = await runHotelNotify();
    return { statusCode: 200, body: JSON.stringify({ success: true, sentTo, alreadyNotified }) };
  } catch (err) {
    console.error('notify-hotel error', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message || 'Could not send hotel notifications.' }) };
  }
};
