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

// Kept as an instruction ("write your own first and last name here"),
// not filled in from the registration's single "name" field -- a bank
// transfer reference needs the full legal name the payer's own bank
// account shows, which a same-field name-split can't reliably guarantee.
const PAYMENT_REF = 'Nachname, Vorname + Kostenbeteiligung Goldmund 2026';

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
      `${esc(bank.bankAddress)}\n` +
      `Empfänger: ${esc(bank.holder)}\n` +
      `Verwendungszweck: ${esc(PAYMENT_REF)}\n` +
      (bank.deadline ? `Zahlungsfrist: ${esc(bank.deadline)}\n` : '') +
      (bank.wero ? `\nAlternativ per Wero: Telefonnummer ${esc(bank.wero)}\n` : '') +
      `\n⚠️ <i>Dein Platz ist erst bestätigt, wenn die Zahlung eingegangen ist.</i>\n` +
      `Du erhältst nicht nochmal eine separate Anmeldebestätigung. Bitte überweise den Betrag am besten direkt. Nach dem 15.09. werden alle nicht überwiesenen Anmeldungen an Personen auf der Warteliste vergeben. Du siehst, dass Überweisung und Anmeldung erfolgreich waren, wenn du in die private Gäste-Telegram-Gruppe hinzugefügt wurdest.\n\n` +
      `Fragen? Die beantworten wir in deiner Fraktions-Gruppe — du wirst vor dem Kongress dazu eingeladen.`
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
    `${esc(bank.bankAddress)}\n` +
    `Recipient: ${esc(bank.holder)}\n` +
    `Reference: ${esc(PAYMENT_REF)}\n` +
    (bank.deadline ? `Payment deadline: ${esc(bank.deadline)}\n` : '') +
    (bank.wero ? `\nAlternatively via Wero: Phone number ${esc(bank.wero)}\n` : '') +
    `\n⚠️ <i>Your spot is only confirmed once payment has arrived.</i>\n` +
    `You won't receive a separate registration confirmation. Please transfer the amount as soon as possible. After September 15th, any unpaid registrations will be given to people on the waitlist. You'll know your transfer and registration were successful once you've been added to the private guest Telegram group.\n\n` +
    `Questions? We'll answer those in your faction group chat — you'll be invited ahead of the congress.`
  );
}

function buildWaitlistMessage(entry, lang) {
  const isDe = lang !== 'en';

  if (isDe) {
    return (
      `<b>Goldmund,</b>\n\n` +
      `danke für deine Anmeldung zum Goldenen Kongress, ${esc(entry.name)}!\n\n` +
      `Der Kongress ist aktuell ausgebucht — du stehst auf der Warteliste. Du musst vorerst nichts überweisen. Falls ein Platz frei wird, melden wir uns hier bei dir, und du bekommst dann die Bankdaten für deine Überweisung.\n\n` +
      `<i>Goldmund ist ein Spektakel ohne Zuschauer — wir hoffen, dass ein Platz für dich frei wird.</i>\n\n` +
      `— Der Goldene Kongress\n1.–4. Oktober 2026 · Zeitz`
    );
  }
  return (
    `<b>Goldmund,</b>\n\n` +
    `thank you for registering for the Golden Congress, ${esc(entry.name)}!\n\n` +
    `The congress is currently full — you're on the waiting list. There's nothing to transfer for now. If a spot opens up, we'll message you here with the bank details for your transfer.\n\n` +
    `<i>Goldmund is a spectacle without spectators — we hope a place opens up for you.</i>\n\n` +
    `— The Golden Congress\nOctober 1–4, 2026 · Zeitz`
  );
}

function buildReminderMessage(entry, lang) {
  const isDe = lang !== 'en';
  const bank = bankBlock();

  if (isDe) {
    return (
      `Goldmund,\n\n` +
      `du hast dich für den Goldenen Kongress angemeldet — wir freuen uns auf dich. Deine Überweisung steht noch aus.\n\n` +
      `Bitte überweise deinen Beitrag von ${entry.contribution}€ so bald wie möglich:\n\n` +
      `Empfänger: ${esc(bank.holder)}\n` +
      `IBAN: ${esc(bank.iban)}\n` +
      `BIC: ${esc(bank.bic)}\n` +
      `${esc(bank.bankAddress)}\n` +
      `Verwendungszweck: „${esc(PAYMENT_REF)}"\n\n` +
      (bank.wero ? `Alternativ per Wero: ${esc(bank.wero)}\n\n` : '') +
      `Dein Platz ist erst mit Eingang der Zahlung bestätigt. Nach dem 15. September werden nicht überwiesene Anmeldungen an Personen auf der Warteliste vergeben.\n\n` +
      `— Der Goldene Kongress`
    );
  }
  return (
    `Goldmund,\n\n` +
    `you registered for the Golden Congress — we're looking forward to having you. Your payment is still outstanding.\n\n` +
    `Please transfer your contribution of €${entry.contribution} as soon as possible:\n\n` +
    `Recipient: ${esc(bank.holder)}\n` +
    `IBAN: ${esc(bank.iban)}\n` +
    `BIC: ${esc(bank.bic)}\n` +
    `${esc(bank.bankAddress)}\n` +
    `Reference: "${esc(PAYMENT_REF)}"\n\n` +
    (bank.wero ? `Alternative via Wero: ${esc(bank.wero)}\n\n` : '') +
    `Your spot is only confirmed once payment is received. After September 15, unpaid registrations will be offered to the waiting list.\n\n` +
    `— The Golden Congress`
  );
}

// Hotel cost/IBAN are organizer-provided copy, not env-driven bank details
// like the general PAYMENT_* messages -- this is a separate negotiated rate
// paid to a different recipient (Johann Aaron Krautheim, not PAYMENT_HOLDER).
function buildHotelNotifyMessage(lang) {
  const isDe = lang !== 'en';

  if (isDe) {
    return (
      `Liebe Goldmünder,\n\n` +
      `ihr gehört zu den erlauchten die sich für eine edle Unterkunft - das Hotel Maximilian entschieden haben. Wir konnten mit dem Hotel einen Deal aushandeln was es uns ermöglicht für nur einen Bruchteil des eigentlichen Preises dort zu nächtigen. Dieser Deal beläuft sich auf 112 Euro pro Person für drei Nächte (Do/Fr/Sa - eine frühere bzw. spätere Anreise ist deshalb leider möglich). Bitte überweist die 112 Euro an die Kontonummer:\n` +
      `Johann Aaron Krautheim\n` +
      `IBAN: BE47905243302780\n` +
      `Verwendungszweck: „Nachname, Vorname + Kostenbeteiligung Übernachtung"\n\n` +
      `Bitte denkt daran, dass eure Teilnahme am Goldmund ist dann als bestätigt gilt, wenn auch der Betrag für das Hotel überwiesen ist.\n\n` +
      `Sollte es Fragen geben wendet euch gerne an Jonas (TG:@chaos2202)`
    );
  }
  return (
    `Dear Goldmünder,\n\n` +
    `You are one of the illustrious people who have chosen noble accommodation - the Hotel Maximilian. We were able to negotiate a deal with the hotel that allowed us to stay there for just a fraction of the actual price. This deal amounts to 112 euros per person for three nights (Thurs/Fri/Sat - an earlier or later arrival is therefore unfortunately possible). Please transfer the 112 euros to the account number:\n` +
    `Johann Aaron Krautheim\n` +
    `IBAN: BE47905243302780\n` +
    `Purpose: "Last name, first name + Kostenbeteiligung Übernachtung"\n\n` +
    `Please note that your participation in Goldmund is only considered confirmed once the payment for the hotel has been transferred.\n\n` +
    `If you have any questions, please contact Jonas (TG:@chaos2202)`
  );
}

function buildHotelReminderMessage(lang) {
  const isDe = lang !== 'en';

  if (isDe) {
    return (
      `Goldmund,\n\n` +
      `kurze Erinnerung: Deine Zahlung für die Unterkunft im Hotel Maximilian (112€, 3 Nächte) steht noch aus.\n\n` +
      `Johann Aaron Krautheim\n` +
      `IBAN: BE47905243302780\n` +
      `Verwendungszweck: „Nachname, Vorname + Kostenbeteiligung Übernachtung"\n\n` +
      `Denk daran: deine Teilnahme gilt erst als bestätigt, wenn auch die Hotelzahlung eingegangen ist.\n\n` +
      `Fragen? Wende dich an Jonas (@chaos2202).`
    );
  }
  return (
    `Goldmund,\n\n` +
    `quick reminder: your payment for accommodation at Hotel Maximilian (€112, 3 nights) is still outstanding.\n\n` +
    `Johann Aaron Krautheim\n` +
    `IBAN: BE47905243302780\n` +
    `Purpose: "Last name, first name + Kostenbeteiligung Übernachtung"\n\n` +
    `Remember: your participation is only confirmed once the hotel payment is received too.\n\n` +
    `Questions? Reach out to Jonas (@chaos2202).`
  );
}

// Returns {text, replyMarkup} rather than just text, since the inline
// keyboard's callback_data needs the regId baked in per-recipient.
function buildArrivalChangeMessage(regId, lang) {
  const isDe = lang !== 'en';
  const text = isDe
    ? `Goldmund,\n\nkurzes wichtiges Update: Wir brauchen tatsächlich alle bereits am Donnerstag bis 20:00 Uhr vor Ort — eine Anreise erst am Freitag ist leider nicht möglich.\n\nSchaffst du es, bis Donnerstag 20:00 Uhr da zu sein?`
    : `Goldmund,\n\nquick important update: we actually need everyone on-site by Thursday 20:00 — arriving Friday instead isn't possible after all.\n\nCan you make it there by Thursday 20:00?`;
  const replyMarkup = {
    inline_keyboard: [[
      { text: isDe ? '✅ Ja, ich schaffe das' : '✅ Yes, I can make it', callback_data: `arrival_yes:${regId}` },
      { text: isDe ? '❌ Nein, das schaffe ich nicht' : "❌ No, I can't", callback_data: `arrival_no:${regId}` },
    ]],
  };
  return { text, replyMarkup };
}

function buildInviteMessage(groupLink, lang) {
  const isDe = lang !== 'en';

  if (isDe) {
    return (
      `Goldmund,\n\n` +
      `deine Überweisung ist eingegangen. Dein Platz beim Goldenen Kongress ist gesichert.\n\n` +
      `Tritt jetzt der Gäste-Gruppe bei — hier wird in den kommenden Wochen alles Weitere verkündet:\n${esc(groupLink)}\n\n` +
      `Die Mauern von Zeitz warten darauf, zum Klingen gebracht zu werden.\n\n` +
      `Du hast angeboten mitzuwirken — wir melden uns dazu bald.\n\n` +
      `— Der Goldene Kongress\n1.–4. Oktober 2026 · Zeitz`
    );
  }
  return (
    `Goldmund,\n\n` +
    `your transfer has been received. Your place at the Golden Congress is secured.\n\n` +
    `Join the guest group — all further details will be shared here in the coming weeks:\n${esc(groupLink)}\n\n` +
    `The walls of Zeitz are waiting to be made to sing.\n\n` +
    `You offered to contribute — we'll be in touch about that soon.\n\n` +
    `— The Golden Congress\nOctober 1–4, 2026 · Zeitz`
  );
}

async function callTelegramApi(method, params) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram API error (${method}): ${json.description || 'unknown'}`);
  return json;
}

// extra can carry things like { message_thread_id } to target a forum topic.
async function sendMessage(chatId, html, extra) {
  return callTelegramApi('sendMessage', Object.assign({ chat_id: chatId, text: html, parse_mode: 'HTML' }, extra));
}

async function deleteMessage(chatId, messageId) {
  return callTelegramApi('deleteMessage', { chat_id: chatId, message_id: messageId });
}

async function pinChatMessage(chatId, messageId) {
  return callTelegramApi('pinChatMessage', { chat_id: chatId, message_id: messageId });
}

async function createForumTopic(chatId, name) {
  return callTelegramApi('createForumTopic', { chat_id: chatId, name });
}

async function getChatMember(chatId, userId) {
  return callTelegramApi('getChatMember', { chat_id: chatId, user_id: userId });
}

// Clears the loading spinner on the tapped button. text is an optional
// small toast Telegram shows the user -- not used here since a real
// follow-up message covers the confirmation.
async function answerCallbackQuery(callbackQueryId, text) {
  return callTelegramApi('answerCallbackQuery', Object.assign({ callback_query_id: callbackQueryId }, text ? { text } : {}));
}

// Strips the inline keyboard off an already-sent message (pass an empty
// inline_keyboard) so a tapped button can't be tapped again.
async function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  return callTelegramApi('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup });
}

module.exports = {
  buildConfirmationMessage,
  buildWaitlistMessage,
  buildReminderMessage,
  buildInviteMessage,
  buildHotelNotifyMessage,
  buildHotelReminderMessage,
  buildArrivalChangeMessage,
  sendMessage,
  deleteMessage,
  pinChatMessage,
  createForumTopic,
  getChatMember,
  answerCallbackQuery,
  editMessageReplyMarkup,
  esc,
};
