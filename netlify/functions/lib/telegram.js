const FACTION_NAMES = {
  M: { de: 'Mystiker', en: 'Mystics' },
  S: { de: 'Surrealisten', en: 'Surrealists' },
  R: { de: 'Romantiker', en: 'Romantics' },
  T: { de: 'Techies', en: 'Technologists' },
  K: { de: 'Kollektivisten', en: 'Collectivists' },
};

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
  const factionName = FACTION_NAMES[entry.topFaction] ? FACTION_NAMES[entry.topFaction][isDe ? 'de' : 'en'] : '—';

  if (isDe) {
    return (
      `<b>Willkommen beim Goldenen Kongress, ${esc(entry.name)}!</b>\n\n` +
      `🏕 <b>Unterkunft:</b> ${esc(entry.housing)}\n` +
      `💶 <b>Beitrag:</b> €${entry.contribution}\n\n` +
      `<b>Tendenz zu:</b> ${esc(factionName)}\n` +
      `<i>Hinweis: Die endgültige Fraktionszuteilung wird von den Organisator*innen kuratiert und kann im Sinne der Spieldramaturgie angepasst werden.</i>\n\n` +
      `<b>Bankdaten für deine Überweisung:</b>\n` +
      `Betrag: €${entry.contribution}\n` +
      `Bank: ${esc(bank.bank)}\n` +
      `IBAN: ${esc(bank.iban)}\n` +
      `BIC: ${esc(bank.bic)}\n` +
      `Empfänger: ${esc(bank.holder)}\n` +
      `Verwendungszweck: ${esc(PAYMENT_REF)}\n` +
      (bank.deadline ? `Zahlungsfrist: ${esc(bank.deadline)}\n` : '') +
      (bank.wero ? `\nAlternativ per Wero: Telefonnummer ${esc(bank.wero)}\n` : '') +
      `\n⚠️ <i>Dein Platz ist erst bestätigt, wenn die Zahlung eingegangen ist.</i>\n` +
      `Du erhältst nicht nochmal eine separate Anmeldebestätigung. Bitte überweise den Betrag am besten direkt. Nach dem 15.09. werden alle nicht überwiesenen Anmeldungen an Personen auf der Warteliste vergeben. Du siehst, dass Überweisung und Anmeldung erfolgreich waren, wenn du in die private Gäste-Telegram-Gruppe hinzugefügt wurdest.\n\n` +
      `Fragen? Antworte einfach auf diese Nachricht.`
    );
  }
  return (
    `<b>Welcome to the Golden Congress, ${esc(entry.name)}!</b>\n\n` +
    `🏕 <b>Housing:</b> ${esc(entry.housing)}\n` +
    `💶 <b>Contribution:</b> €${entry.contribution}\n\n` +
    `<b>Leaning toward:</b> ${esc(factionName)}\n` +
    `<i>Note: Final faction placement is curated by the organizers and may be adjusted for game design purposes.</i>\n\n` +
    `<b>Bank details for your transfer:</b>\n` +
    `Amount: €${entry.contribution}\n` +
    `Bank: ${esc(bank.bank)}\n` +
    `IBAN: ${esc(bank.iban)}\n` +
    `BIC: ${esc(bank.bic)}\n` +
    `Recipient: ${esc(bank.holder)}\n` +
    `Reference: ${esc(PAYMENT_REF)}\n` +
    (bank.deadline ? `Payment deadline: ${esc(bank.deadline)}\n` : '') +
    (bank.wero ? `\nAlternatively via Wero: Phone number ${esc(bank.wero)}\n` : '') +
    `\n⚠️ <i>Your spot is only confirmed once payment has arrived.</i>\n` +
    `You won't receive a separate registration confirmation. Please transfer the amount as soon as possible. After September 15th, any unpaid registrations will be given to people on the waitlist. You'll know your transfer and registration were successful once you've been added to the private guest Telegram group.\n\n` +
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
