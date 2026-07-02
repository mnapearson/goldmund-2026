const FACTIONS = {
  M: { de: 'Mystiker', en: 'Mystics' },
  S: { de: 'Surrealisten', en: 'Surrealists' },
  R: { de: 'Romantiker', en: 'Romantics' },
  T: { de: 'Techies', en: 'Technologists' },
  K: { de: 'Kollektivisten', en: 'Collectivists' },
};

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bar(score, max) {
  const width = 10;
  const filled = max > 0 ? Math.round((score / max) * width) : 0;
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function bankBlock() {
  return {
    bank: process.env.PAYMENT_BANK || '',
    iban: process.env.PAYMENT_IBAN || '',
    bic: process.env.PAYMENT_BIC || '',
    holder: process.env.PAYMENT_HOLDER || '',
    deadline: process.env.PAYMENT_DEADLINE || '',
  };
}

function factionBlock(scores, isDe) {
  const max = Math.max(1, ...Object.values(scores));
  return Object.keys(FACTIONS)
    .map((f) => `${FACTIONS[f][isDe ? 'de' : 'en']}: ${bar(scores[f] || 0, max)} (${scores[f] || 0})`)
    .join('\n');
}

function buildConfirmationMessage(entry, lang) {
  const isDe = lang !== 'en';
  const bank = bankBlock();
  const top = FACTIONS[entry.topFaction] ? FACTIONS[entry.topFaction][isDe ? 'de' : 'en'] : '—';
  const factionLines = factionBlock(entry.scores, isDe);

  if (isDe) {
    return (
      `<b>Willkommen beim Goldenen Kongress, ${esc(entry.name)}!</b>\n\n` +
      `🏕 <b>Unterkunft:</b> ${esc(entry.housing)}\n` +
      `💶 <b>Beitrag:</b> €${entry.contribution}\n\n` +
      `<b>Deine Fraktionsneigung:</b> ${esc(top)}\n<pre>${factionLines}</pre>\n\n` +
      `<b>Bankdaten für deine Überweisung:</b>\n` +
      `Betrag: €${entry.contribution}\n` +
      `Bank: ${esc(bank.bank)}\n` +
      `IBAN: ${esc(bank.iban)}\n` +
      `BIC: ${esc(bank.bic)}\n` +
      `Kontoinhaber: ${esc(bank.holder)}\n` +
      `Verwendungszweck: GM2026 — ${esc(entry.name)}\n` +
      (bank.deadline ? `Zahlungsfrist: ${esc(bank.deadline)}\n` : '') +
      `\n⚠️ <i>Dein Platz ist erst bestätigt, wenn die Zahlung eingegangen ist.</i>\n\n` +
      `Fragen? Antworte einfach auf diese Nachricht.`
    );
  }
  return (
    `<b>Welcome to the Golden Congress, ${esc(entry.name)}!</b>\n\n` +
    `🏕 <b>Housing:</b> ${esc(entry.housing)}\n` +
    `💶 <b>Contribution:</b> €${entry.contribution}\n\n` +
    `<b>Your faction leaning:</b> ${esc(top)}\n<pre>${factionLines}</pre>\n\n` +
    `<b>Bank details for your transfer:</b>\n` +
    `Amount: €${entry.contribution}\n` +
    `Bank: ${esc(bank.bank)}\n` +
    `IBAN: ${esc(bank.iban)}\n` +
    `BIC: ${esc(bank.bic)}\n` +
    `Account holder: ${esc(bank.holder)}\n` +
    `Reference: GM2026 — ${esc(entry.name)}\n` +
    (bank.deadline ? `Payment deadline: ${esc(bank.deadline)}\n` : '') +
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
      `Kontoinhaber: ${esc(bank.holder)}\n` +
      `Verwendungszweck: GM2026 — ${esc(entry.name)}\n` +
      (bank.deadline ? `Zahlungsfrist: ${esc(bank.deadline)}\n` : '') +
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
    `Account holder: ${esc(bank.holder)}\n` +
    `Reference: GM2026 — ${esc(entry.name)}\n` +
    (bank.deadline ? `Payment deadline: ${esc(bank.deadline)}\n` : '') +
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
