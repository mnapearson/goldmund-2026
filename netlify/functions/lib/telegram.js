function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PAYMENT_REF = 'Nachname, Vorname + Kostenbeteiligung Goldmund 2026';

function bankBlock() {
  return {
    bank: process.env.PAYMENT_BANK || '',
    iban: process.env.PAYMENT_IBAN || '',
    bic: process.env.PAYMENT_BIC || '',
    holder: process.env.PAYMENT_HOLDER || '',
    deadline: process.env.PAYMENT_DEADLINE || '',
    wero: process.env.PAYMENT_WERO_PHONE || '',
  };
}

function buildConfirmationMessage(entry, lang) {
  const isDe = lang !== 'en';
  const bank = bankBlock();

  if (isDe) {
    return (
      `<b>Willkommen beim Goldenen Kongress, ${esc(entry.name)}!</b>\n\n` +
      `🏕 <b>Unterkunft:</b> ${esc(entry.housing)}\n` +
      `💶 <b>Beitrag:</b> €${entry.contribution}\n\n` +
      `Du wurdest einer geheimen Fraktion zugeteilt — welche das ist, erfährst du beim Kongress.\n\n` +
      `<b>Bankdaten für deine Überweisung:</b>\n` +
      `Betrag: €${entry.contribution}\n` +
      `Bank: ${esc(bank.bank)}\n` +
      `IBAN: ${esc(bank.iban)}\n` +
      `BIC: ${esc(bank.bic)}\n` +
      `Empfänger: ${esc(bank.holder)}\n` +
      `Verwendungszweck: ${esc(PAYMENT_REF)}\n` +
      (bank.deadline ? `Zahlungsfrist: ${esc(bank.deadline)}\n` : '') +
      (bank.wero ? `\nAlternativ per Wero: Telefonnummer ${esc(bank.wero)}\n` : '') +
      `\n⚠️ <i>Dein Platz ist erst bestätigt, wenn die Zahlung eingegangen ist.</i>\n\n` +
      `Fragen? Antworte einfach auf diese Nachricht.`
    );
  }
  return (
    `<b>Welcome to the Golden Congress, ${esc(entry.name)}!</b>\n\n` +
    `🏕 <b>Housing:</b> ${esc(entry.housing)}\n` +
    `💶 <b>Contribution:</b> €${entry.contribution}\n\n` +
    `You've been assigned to a secret faction — which one will be revealed at the congress.\n\n` +
    `<b>Bank details for your transfer:</b>\n` +
    `Amount: €${entry.contribution}\n` +
    `Bank: ${esc(bank.bank)}\n` +
    `IBAN: ${esc(bank.iban)}\n` +
    `BIC: ${esc(bank.bic)}\n` +
    `Recipient: ${esc(bank.holder)}\n` +
    `Reference: ${esc(PAYMENT_REF)}\n` +
    (bank.deadline ? `Payment deadline: ${esc(bank.deadline)}\n` : '') +
    (bank.wero ? `\nAlternatively via Wero: Phone number ${esc(bank.wero)}\n` : '') +
    `\n⚠️ <i>Your spot is only confirmed once payment has arrived.</i>\n\n` +
    `Questions? Just reply to this message.`
  );
}

function buildReminderMessage(entry, lang) {
  const isDe = lang !== 'en';
  const bank = bankBlock();
  if (isDe) {
    return (
      `<b>Zahlungserinnerung — Goldener Kongress</b>\n\n` +
      `Hallo ${esc(entry.name)}, deine Zahlung für den Goldenen Kongress steht noch aus. Hier nochmal die Bankdaten:\n\n` +
      `Betrag: €${entry.contribution}\n` +
      `Bank: ${esc(bank.bank)}\n` +
      `IBAN: ${esc(bank.iban)}\n` +
      `BIC: ${esc(bank.bic)}\n` +
      `Empfänger: ${esc(bank.holder)}\n` +
      `Verwendungszweck: ${esc(PAYMENT_REF)}\n` +
      (bank.deadline ? `Zahlungsfrist: ${esc(bank.deadline)}\n` : '') +
      (bank.wero ? `\nAlternativ per Wero: Telefonnummer ${esc(bank.wero)}\n` : '') +
      `\n⚠️ <i>Dein Platz ist erst bestätigt, wenn die Zahlung eingegangen ist.</i>`
    );
  }
  return (
    `<b>Payment reminder — Golden Congress</b>\n\n` +
    `Hi ${esc(entry.name)}, your payment for the Golden Congress is still outstanding. Here are the bank details again:\n\n` +
    `Amount: €${entry.contribution}\n` +
    `Bank: ${esc(bank.bank)}\n` +
    `IBAN: ${esc(bank.iban)}\n` +
    `BIC: ${esc(bank.bic)}\n` +
    `Recipient: ${esc(bank.holder)}\n` +
    `Reference: ${esc(PAYMENT_REF)}\n` +
    (bank.deadline ? `Payment deadline: ${esc(bank.deadline)}\n` : '') +
    (bank.wero ? `\nAlternatively via Wero: Phone number ${esc(bank.wero)}\n` : '') +
    `\n⚠️ <i>Your spot is only confirmed once payment has arrived.</i>`
  );
}

async function sendMessage(chatId, html) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML' }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram API error: ${json.description || 'unknown'}`);
  return json;
}

module.exports = { buildConfirmationMessage, buildReminderMessage, sendMessage };
