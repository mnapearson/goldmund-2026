const { findRowByRegId, findRowByChatId, updateCell } = require('./lib/sheets');
const { buildConfirmationMessage, buildWaitlistMessage, sendMessage, deleteMessage, pinChatMessage, createForumTopic, getChatMember, esc } = require('./lib/telegram');

function rowToEntry(row) {
  return {
    regId: row[0] || '',
    name: row[1] || '',
    housing: row[6] || '',
    contribution: Number(row[7]) || 0,
    topFaction: row[8] || '',
    scores: { M: Number(row[9]) || 0, S: Number(row[10]) || 0, R: Number(row[11]) || 0, T: Number(row[12]) || 0, K: Number(row[13]) || 0 },
    lang: row[17] || 'de',
    waitlisted: row[25] === 'TRUE',
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

// Filled in from each topic's Telegram share link (long-press the topic ->
// Copy Link -> the number after the last "/"), since createForumTopic's
// returned message_thread_id from /setup was never persisted anywhere.
const TOPIC_IDS = {
  announcements: 16, // 📢 Ankündigungen
  music: 24,         // 🎵 Musik & DJs
  workshops: 22,     // 🎭 Programm & Workshops
  bar: 30,           // 🍸 Bar
  buildStrike: 32,   // 🔧 Aufbau & Abbau
  decor: 26,         // 🎨 Deko & Räume
};

const LAUNCH_MESSAGES = [
  { topic: 'announcements', text:
    `Goldmund,\n\n` +
    `der Schichtplan ist live! Küche, Bar (Phonotek & Saal), Awareness, Aufbau, LNT, Sauna, Site Lead, Playroom und mehr — alles wartet auf euch.\n\n` +
    `Trage dich für mindestens 3 Schichten ein, wo auch immer dich es hinzieht:\n` +
    `https://docs.google.com/spreadsheets/d/1qvCOeQUDSM0zTF5FMtexHPZ2MBDJBBzH5XlcWOGLsb8/edit?usp=sharing\n\n` +
    `Goldmund lebt von Co-Creation. Ohne euch läuft nichts — mit euch läuft alles.\n\n` +
    `— Der Goldene Kongress` },
  { topic: 'music', text:
    `Goldmund,\n\n` +
    `Steffi sucht noch eine*n Co-Lead für die Musikalische Leitung — jemand, der/die Lust hat, gemeinsam Line-up, Jam-Sessions und den musikalischen roten Faden des Wochenendes mitzugestalten.\n\n` +
    `Wenn dich das reizt, meldet euch bei Steffi oder hier im Kanal.` },
  { topic: 'workshops', text:
    `Goldmund,\n\n` +
    `wir suchen noch eine*n Playroom-Lead — Gestaltung des Playroom-Vibes, Opening Hours, Safer-Sex-Materialien und Consent-Regeln im Blick behalten. Wenn dich das anspricht, melde dich!` },
  { topic: 'bar', text:
    `Goldmund,\n\n` +
    `wir haben jetzt ZWEI Bars — Phonotek Bar und Saal Bar — und beide suchen noch eine*n Lead! Getränkeauswahl, Barschichten koordinieren, Bowle-Regeln festlegen. Wer Lust hat, das Zepter für eine der beiden Bars zu übernehmen, meldet sich hier.` },
  { topic: 'buildStrike', text:
    `Goldmund,\n\n` +
    `zwei Rollen sind noch offen:\n` +
    `— Strike Lead (Abbau Sonntag) — Aaron hält aktuell nur provisorisch die Stellung.\n` +
    `— Transport & Aufbau Lead — Koordination von Autos, Transportern, Be- und Entladen zwischen Leipzig und Berlin.\n\n` +
    `Wer Lust hat, meldet sich hier oder bei Micky.` },
  { topic: 'decor', text:
    `Goldmund,\n\n` +
    `hier ein erster Blick in unsere Räume aus dem Location-Tour letzte Woche — Bibliothek (EG, OG, Keller, Garten) und Nikolaikirche (Innenraum, Außenbereich):\n\n` +
    `https://drive.google.com/drive/folders/14yHsmA5kXHbPr1rCDf7vSncX270ceUWi?usp=sharing\n\n` +
    `Nutzt die Fotos für eure Deko-Planung — was passt wo?` },
];

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
              `Konnte keine Themen-Kanäle erstellen (${esc(err.message)}). Bitte prüfen: Ist "Themen" (Forum-Modus) in den Gruppeneinstellungen aktiviert, und hat der Bot als Admin die Berechtigung "Themen verwalten"?`
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

async function handleLaunch(message) {
  const chatId = message.chat.id;
  const fromId = message.from && message.from.id;

  const authorized = await isAuthorizedSender(chatId, fromId);
  if (!authorized) {
    try {
      await sendMessage(chatId, 'Nur für Organisator*innen.');
    } catch (e) {
      console.error('launch reject send error', e);
    }
    return { statusCode: 200, body: 'ok' };
  }

  const missingTopics = Object.entries(TOPIC_IDS).filter(([, id]) => !id).map(([key]) => key);
  if (missingTopics.length) {
    try {
      await sendMessage(chatId, `TOPIC_IDS ist noch nicht vollständig ausgefüllt (fehlt: ${missingTopics.join(', ')}). Bitte in telegram-webhook.js eintragen und neu deployen.`);
    } catch (e) {
      console.error('launch missing-topic-ids notice error', e);
    }
    return { statusCode: 200, body: 'ok' };
  }

  for (const { topic, text } of LAUNCH_MESSAGES) {
    try {
      await sendMessage(chatId, text, { message_thread_id: TOPIC_IDS[topic] });
    } catch (err) {
      console.error(`launch: could not send to topic "${topic}"`, err);
    }
    await sleep(300);
  }

  try {
    await sendMessage(chatId, 'Launch messages posted.');
  } catch (e) {
    console.error('launch confirmation send error', e);
  }

  return { statusCode: 200, body: 'ok' };
}

// Keeps "Joined Group" fresh between manual Sync Group Status runs -- fires
// the moment someone actually joins, instead of only on the next check-membership sweep.
async function handleNewChatMembers(chatId, newMembers) {
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!groupChatId || String(chatId) !== String(groupChatId)) {
    return { statusCode: 200, body: 'ignored' };
  }

  const now = new Date().toISOString();
  for (const member of newMembers) {
    if (!member || member.is_bot || member.id == null) continue;
    try {
      const found = await findRowByChatId(member.id);
      if (!found) continue;
      await updateCell(found.rowNumber, 'V', 'TRUE');
      await updateCell(found.rowNumber, 'W', now);
    } catch (e) {
      console.error('new_chat_members: could not update row for', member.id, e);
    }
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

  if (Array.isArray(message.new_chat_members) && message.new_chat_members.length) {
    return handleNewChatMembers(chatId, message.new_chat_members);
  }

  const trimmedText = text.trim();
  if (/^\/setup(?:@\w+)?/.test(trimmedText)) {
    return handleSetup(message);
  }
  if (/^\/launch(?:@\w+)?/.test(trimmedText)) {
    return handleLaunch(message);
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
    const html = entry.waitlisted ? buildWaitlistMessage(entry, entry.lang) : buildConfirmationMessage(entry, entry.lang);
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
