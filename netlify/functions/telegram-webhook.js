const { findRowByRegId, updateCell } = require('./lib/sheets');
const { buildConfirmationMessage, sendMessage, deleteMessage, pinChatMessage, createForumTopic, getChatMember } = require('./lib/telegram');

function rowToEntry(row) {
  return {
    regId: row[0] || '',
    name: row[1] || '',
    housing: row[6] || '',
    contribution: Number(row[7]) || 0,
    topFaction: row[8] || '',
    scores: { M: Number(row[9]) || 0, S: Number(row[10]) || 0, R: Number(row[11]) || 0, T: Number(row[12]) || 0, K: Number(row[13]) || 0 },
    lang: row[17] || 'de',
  };
}

const SETUP_WELCOME_MESSAGE =
  `<b>Goldmund,</b>\n\n` +
  `willkommen in der offiziellen Gäste-Gruppe des Goldenen Kongresses.\n\n` +
  `Dies ist euer Raum — zum Planen, Koordinieren und Kennenlernen. In den nächsten Wochen werdet ihr hier alles Wichtige erfahren: Anfahrt, Unterkunft, Programm und was ihr mitbringen sollt.\n\n` +
  `Unten findet ihr Themen-Kanäle für die verschiedenen Bereiche des Kongresses. Schaut rein, wo ihr euch einbringen wollt — jede und jeder von euch ist Veranstaltende*r und Teilnehmer*in zugleich.\n\n` +
  `<i>Goldmund ist ein Spektakel ohne Zuschauer. Nur durch euch kommt die Schönheit in die Welt.</i>\n\n` +
  `— Der Goldene Kongress\nZeitz · 1.–4. Oktober 2026`;

const SETUP_TOPICS = [
  ['📢 Ankündigungen', 'Offizielle Updates vom Orga-Team.'],
  ['🚗 Mitfahrgelegenheiten', 'Biete oder suche eine Mitfahrgelegenheit nach Zeitz. Bitte angeben: Abfahrtsort, Tag, Uhrzeit, freie Plätze.'],
  ['🛏 Unterkunft', 'Fragen und Koordination rund um Hotel, Bibliothek-Zimmer, Indoor-Camping und Camper-Stellplätze.'],
  ['🎭 Programm & Workshops', 'Workshops, Performances, neue Ideen — hier koordinieren wir.'],
  ['🎵 Musik & DJs', 'Line-up, Jam-Sessions, Instrumente mitbringen, Sets abstimmen.'],
  ['🎨 Deko & Räume', 'Raumgestaltung, Stoffe, Licht, Installationen.'],
  ['🍳 Essen & Küche', 'Essensplanung, Kochschichten, Potluck-Ideen. Alles vegan.'],
  ['🍸 Bar', 'Getränke, Barschichten, Bowle-Regelung.'],
  ['🔧 Aufbau & Abbau', 'Wer kommt früher? Wer bleibt länger? Werkzeug, Transporter, Helfende.'],
  ['🛡 Awareness & Welfare', 'Awareness-Schichten, Briefing, Welfare-Raum.'],
  ['🧖 Sauna & Wellness', 'Sauna, Aufgüsse, Schwitzhütte, Wellness-Angebote.'],
  ['❓ Fragen & Sonstiges', 'Alles was in keinen anderen Kanal passt.'],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Accepts the hardcoded ADMIN_TELEGRAM_ID as a fast path, but that alone
// missed real organizers -- Telegram distinguishes the group's "creator"
// (owner) from promoted "administrator" accounts, and a single fixed ID
// can't represent either of those roles for everyone who should be able
// to run /setup. Falls back to asking Telegram directly whether the
// sender is the group's creator or an administrator.
async function isAuthorizedSender(chatId, fromId) {
  if (!fromId) return false;
  if (String(fromId) === String(process.env.ADMIN_TELEGRAM_ID)) return true;
  try {
    const res = await getChatMember(chatId, fromId);
    const status = res.result && res.result.status;
    return status === 'creator' || status === 'administrator';
  } catch (e) {
    console.error('setup: could not check chat member status', e);
    return false;
  }
}

async function handleSetup(message) {
  const chatId = message.chat.id;
  const fromId = message.from && message.from.id;

  const authorized = await isAuthorizedSender(chatId, fromId);
  if (!authorized) {
    try {
      await sendMessage(chatId, 'Nur für Organisator*innen.');
    } catch (e) {
      console.error('setup reject send error', e);
    }
    return { statusCode: 200, body: 'ok' };
  }

  try {
    await deleteMessage(chatId, message.message_id);
  } catch (e) {
    console.error('setup: could not delete /setup message (missing Delete Messages permission?)', e);
  }

  try {
    const welcomeRes = await sendMessage(chatId, SETUP_WELCOME_MESSAGE);
    const welcomeMessageId = welcomeRes.result && welcomeRes.result.message_id;
    if (welcomeMessageId) {
      try {
        await pinChatMessage(chatId, welcomeMessageId);
      } catch (e) {
        console.error('setup: could not pin welcome message (missing Pin Messages permission?)', e);
      }
    }

    let createdCount = 0;
    for (let i = 0; i < SETUP_TOPICS.length; i++) {
      const [name, starter] = SETUP_TOPICS[i];
      try {
        const topicRes = await createForumTopic(chatId, name);
        const threadId = topicRes.result && topicRes.result.message_thread_id;
        if (threadId) {
          await sendMessage(chatId, starter, { message_thread_id: threadId });
        }
        createdCount++;
      } catch (err) {
        console.error(`setup: could not create topic "${name}"`, err);
        if (i === 0) {
          // First topic failing is almost always a systemic issue (forum mode
          // not enabled, or the bot lacks "Manage Topics") rather than a
          // one-off -- surface that clearly instead of silently retrying
          // eleven more times and reporting "0 topics created" at the end.
          try {
            await sendMessage(
              chatId,
              'Konnte keine Themen-Kanäle erstellen. Bitte prüfen: Ist "Themen" (Forum-Modus) in den Gruppeneinstellungen aktiviert, und hat der Bot als Admin die Berechtigung "Themen verwalten"?'
            );
          } catch (e) {
            console.error('setup: could not send topic-failure notice', e);
          }
          return { statusCode: 200, body: 'ok' };
        }
      }
      await sleep(300);
    }

    await sendMessage(chatId, `✓ ${createdCount} Themen-Kanäle wurden erstellt. Schaut euch um und tragt euch ein, wo ihr mitwirken wollt.`);
  } catch (err) {
    console.error('setup error', err);
  }

  return { statusCode: 200, body: 'ok' };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let update;
  try {
    update = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 200, body: 'ignored' };
  }

  const message = update.message;
  const chatId = message && message.chat && message.chat.id;
  const text = (message && message.text) || '';

  // Always ack 200 to Telegram — non-200 responses trigger retries.
  if (!chatId) return { statusCode: 200, body: 'ignored' };

  const trimmedText = text.trim();
  if (/^\/setup(?:@\w+)?/.test(trimmedText)) {
    return handleSetup(message);
  }

  const match = /^\/start(?:@\w+)?(?:\s+(\S+))?/.exec(trimmedText);
  if (!match) return { statusCode: 200, body: 'ignored' };

  const regId = match[1];
  if (!regId) {
    try {
      await sendMessage(chatId, 'Bitte nutze den Link von deiner Anmeldebestätigung, um deine Registrierung abzurufen.\n\nPlease use the link from your registration confirmation screen to retrieve your registration.');
    } catch (e) {
      console.error('telegram send error', e);
    }
    return { statusCode: 200, body: 'ok' };
  }

  try {
    const found = await findRowByRegId(regId);
    if (!found) {
      await sendMessage(chatId, `Registrierung <b>${regId}</b> nicht gefunden.\n\nRegistration <b>${regId}</b> not found.`);
      return { statusCode: 200, body: 'ok' };
    }

    await updateCell(found.rowNumber, 'Q', chatId);

    const entry = rowToEntry(found.row);
    const html = buildConfirmationMessage(entry, entry.lang);
    await sendMessage(chatId, html);
  } catch (err) {
    console.error('telegram-webhook error', err);
    try {
      await sendMessage(chatId, 'Etwas ist schiefgelaufen. Bitte versuche es später erneut oder kontaktiere die Organisator*innen.\n\nSomething went wrong. Please try again later or contact the organizers.');
    } catch (e) {
      console.error('telegram send error', e);
    }
  }

  return { statusCode: 200, body: 'ok' };
};
