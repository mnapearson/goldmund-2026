# SPEC — Goldmund 2026 Landing Page Backend

## Context

I have a self-contained HTML landing page (`index.html`) for "Der Goldene Kongress" — an immersive 100-person event in Zeitz, Germany, October 1–4, 2026. The page includes a bilingual (DE/EN) multi-step signup wizard: personal info → housing selection → sliding-scale contribution (€111–444) → 15-question faction quiz → review → submit. There's also a passphrase-gated organizer dashboard.

The file currently uses `window.storage` (Claude artifact storage) which needs to be replaced with real infrastructure. **Do not change the CSS, layout, type system, or visual design of the page. Only modify the JavaScript submission/admin logic and add the serverless functions.**

## Stack

- **Hosting & functions:** Netlify (static site + serverless functions)
- **Data capture & payment tracking:** Google Sheets API (service account)
- **Confirmation messages:** Telegram Bot API
- **No email service needed**

## What I need you to build

### 1. Google Sheets integration

Create a Netlify serverless function at `netlify/functions/register.js` that:

1. Receives form data as a POST (JSON body)
2. Validates required fields (name, email, housing, contribution)
3. Appends a row to a Google Sheet via the Google Sheets API (using a service account)
4. Returns the row number / registration ID to the frontend

**Google Sheet structure — create a sheet called "Registrations" with these column headers in row 1:**

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Reg ID | Name | Email | Telegram | Phone | Arrival | Housing | Contribution (€) | Top Faction | M | S | R | T | K | Payment Status | Submitted At |

- Reg ID: auto-generated (e.g. `GM-001`, `GM-002`, incrementing)
- Payment Status: default value "Ausstehend"
- The sheet should live in the same Google Drive as the Goldmund mastersheet

**Google Sheets API setup (service account):**
- Create a Google Cloud project
- Enable the Google Sheets API
- Create a Service Account → download the JSON key file
- Share the Google Sheet with the service account email (as Editor)
- Store the service account credentials in environment variables (not the JSON file — extract the `client_email` and `private_key` into env vars)

### 2. Telegram Bot for confirmation messages

Create a Telegram bot via @BotFather:
- Name: Goldmund Kongress Bot (or similar)
- Username: e.g. @GoldmundKongressBot

The bot needs one handler: when a user sends `/start REG_ID`, the bot:
1. Looks up the registration in the Google Sheet by Reg ID
2. Sends a rich Telegram message with:
   - Greeting with their name
   - Their housing choice
   - Their contribution amount
   - Their faction quiz result (top faction + all 5 scores as a visual bar)
   - Bank transfer details:
     - Betrag: €[their amount]
     - Bank: [BANK NAME]
     - IBAN: [IBAN]
     - BIC: [BIC]
     - Kontoinhaber: [NAME]
     - Verwendungszweck: "GM2026 — [their full name]"
   - Note: "Dein Platz ist erst bestätigt, wenn die Zahlung eingegangen ist."
   - A contact for questions
3. Uses Telegram's MarkdownV2 or HTML formatting for a clean, readable message

**Implementation:** Create a Netlify function at `netlify/functions/telegram-webhook.js` that:
- Handles incoming Telegram webhook updates (POST from Telegram)
- Parses the `/start` command + reg ID
- Looks up the registration in Google Sheets
- Sends the confirmation message back via the Telegram Bot API

After deploying, set the webhook URL via:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-SITE.netlify.app/.netlify/functions/telegram-webhook
```

### 3. Frontend changes to index.html

**In the `submitReg()` function:**
- Replace the `window.storage.set()` call with a POST to `/.netlify/functions/register`
- Send all form data + computed scores + top faction + language as JSON
- Show a loading state on the submit button while waiting
- On success: receive the Reg ID from the response

**On the success screen:**
- Show a prominent button: "📬 Bestätigung auf Telegram erhalten" / "📬 Get confirmation on Telegram"
- The button links to: `https://t.me/GoldmundKongressBot?start=REG_ID` (using the ID returned from the register function)
- Below the button, show a fallback note: "Du erhältst dort deine Fraktionsergebnisse und die Zahlungsdaten." / "You'll receive your faction results and payment details there."
- Also show the bank details directly on the success screen as a fallback (in case someone doesn't use Telegram)

**In the admin dashboard:**
- Replace the `window.storage.list/get` calls with a GET to `/.netlify/functions/admin`
- The admin function fetches all rows from the Google Sheet and returns them as JSON
- Move passphrase validation to the server side (the function checks the passphrase, not just the frontend JS)

### 4. Admin function

Create `netlify/functions/admin.js` that:
1. Accepts GET requests with a `passphrase` query parameter
2. Validates the passphrase server-side against `ADMIN_PASSPHRASE` env var
3. Reads all rows from the Google Sheet
4. Returns JSON array of all registrations
5. Supports a simple `?action=export` param that returns CSV directly

### 5. Reminder capability (bonus, if time)

Add a simple admin-triggered function `netlify/functions/remind.js` that:
1. Accepts a POST with `{ regId: "GM-042" }` and the admin passphrase
2. Looks up the registration
3. Sends a Telegram reminder to the person: "Hallo [Name], deine Zahlung für den Goldenen Kongress steht noch aus. Hier nochmal die Bankdaten: ..."
4. This requires that the bot stores the Telegram chat_id when the user first interacts with it — store this in an additional column in the Google Sheet ("Telegram Chat ID")

### 6. Environment variables

Create `.env.example`:
```
# Google Sheets (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=goldmundkongress@goldmundkongress.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDDiNMQ0PG2H5lo\nHIWv1io0ABC30gec8fdmdiO2fDCV3wU1HC6ncOSO440SVraGz+rKf1bYxwSIsgco\nAjti5YX46B/GQ560BO0H1lBKpnF7cAijNoGTjVGF9g0o/BLjQpTUBZSIyr8LSNuj\n5mnJPH6t43VUtJ+VtO58KRlIiEnpDyRU/tEBRAyvRCmzVQplTH/3IgNFgAlnBlft\n3OQFRE5PJh/wwLTF8bAuqnN6lpuVNFqCCvVw+XxrTgbfaUByLNX35HhSpgfwnu8s\nGe9iGkAopzU6KHbf/sZhfR9mtADmCyFiVqQz9AGurf0Xjm2hYNy2jvUNQCJSwQzP\n/W74p58JAgMBAAECggEAAmvqPj/yMGDXjeUliDIRK3vxOQ+QMdLCzzlpE5BZ6y88\nAaZ/0unIYNcjVv3tLIH8bMXTMePUE+vNgCK38M96H2UjiJlriJvzggh2zdfeGarf\nZoMNK4JBZ1Tu4IovozIexPntNxz4rPd55d+bgYce5AEoQbRrcgePuQiqxB3Q+YKF\nkgTP8mUBFqfbxo48pqbYUjvJ/Lms28oLmXTl8eEH8aYf0fFrymAYqhc8StDnoZWd\n1hnuODkkhp2Lwl3asiKs/PqnLyNPfZArPWTcD7Vk2V8IVCzY+876RzAYKCUZ3Wgj\n0voTkyeRI/U7TCwGcOVbrXR3BetdZE67TTkadOuxAQKBgQDtCJGvciuk2Z3s9eUf\nwdBYiOHPvIolvBkQqeEyyIzCLQ+YtlVYqiYzG2/Kl7l/qXjTY/9Wb+lf1+pxXldo\nVHemIorbr4KBlwGiA/WXrDkcAvGjA+xHPYl52PpppIIS8Iw53qywpcv/yVIeYITs\nVUzwuQkMO0oDXa2qXiKs+WwlAQKBgQDTLi7tDkNY11yHweNzmp16eo6DQIVqt3Sg\nkTi3k4sC3sOzpCpjn98whw7ajExtqBON1IIyBMXpAKiArMIuix51IwQpTNWnvsYD\nSkEjcrW2u32Zt2HJ8T7m1omeihZ8NZpF05MRP/eTpmUOBLmXFffnyonR1MvL3ppP\nGa+lkABSCQKBgQCei6jGrZs7vMPBiAgl4cG2Nni0NuxAqTwqxTZ4fWSJTRKtlugn\nUkgSzztLS4ksNvM2kiBsdJapIQcTpYLZqgYN/fTbVN36SEMzV2qidPQOJHn0C9+z\nFxopglSc7QiEGpnw61yfG4cEJGjlILJIUhYQvfOrVsz+y14qIqUXBg6sAQKBgGiJ\nwh0DJH+EDH//kNKXRUFuDcIXXHQZYJhjiwoE9Zl0ILh6mak7aMai9M1nCiZ2P0fE\nXLbZ+gZ/luormuxjXa5qqRKwwEsLewYB6gDcNevBIEnJp5TJ4XNv3Cwo+zx9ZGMQ\newrc+XeTtQ6ddCnAbDnH3zWJ+2BuT0C83GA+yonRAoGBAIUyWonofRQrvKDyIjfc\nAvIuq9QlkbRQvcXTRmvdOJX/ZXil4fcjhhFZbkKui23e3RXsB8nkSS/VvQCQDqNS\nscC00zANc3ZwYLda0mgfVxrb1ePkZvW3WlYl6BZiJnocnattLgoBov/mwjWahhhm\nMpssx/7PUV5h1kxC40sGL1WA\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1qvCOeQUDSM0zTF5FMtexHPZ2MBDJBBzH5XlcWOGLsb8

# Telegram Bot
TELEGRAM_BOT_TOKEN=8943493790:AAHss5POxzghebvB6Qk_zVwOBYiCJ1FtyRE

# Admin
ADMIN_PASSPHRASE=goldmund2026

# Payment details (used in Telegram messages)
PAYMENT_BANK=N26
PAYMENT_IBAN=DEXX XXXX XXXX XXXX XXXX XX
PAYMENT_BIC=NTSBDE1XXX
PAYMENT_HOLDER=Goldmund
PAYMENT_DEADLINE=15. September 2026
```

### 7. Config files

**`netlify.toml`:**
```toml
[build]
  functions = "netlify/functions"
  publish = "."

[functions]
  node_bundler = "esbuild"
```

**`.gitignore`:**
```
.env
node_modules/
.netlify/
```

**`package.json`:** Minimal — only dependencies needed for the functions (googleapis for Sheets API).

## File structure

```
goldmund-2026/
├── index.html
├── netlify.toml
├── .env.example
├── .env                          ← gitignored
├── .gitignore
├── package.json
├── netlify/
│   └── functions/
│       ├── register.js           ← POST: validate + write to Sheet + return reg ID
│       ├── telegram-webhook.js   ← POST: handle Telegram /start, send confirmation
│       ├── admin.js              ← GET: fetch all registrations for dashboard
│       └── remind.js             ← POST: send payment reminder via Telegram
```

## Important constraints

- **Do not change the page design** — CSS, layout, type, colors are final.
- No frameworks, no build step. Single HTML file + serverless functions.
- All secrets in .env, never in client-side code.
- Handle errors gracefully — if Sheets or Telegram fails, show the user a clear message and display the bank details on-screen as fallback.
- The Telegram message should be in the same language the person used on the form.
- The bank details should ALSO appear on the success screen directly (not only via Telegram) so nobody is blocked from paying.

## Testing

After building, walk me through:
1. Creating the Google Cloud service account and sharing the sheet
2. Creating the Telegram bot with @BotFather
3. Setting up the .env with real credentials
4. Running `netlify dev` locally
5. Testing a form submission end-to-end
6. Verifying the Google Sheet row was created
7. Testing the Telegram bot confirmation
8. Testing the admin dashboard
9. Deploying to Netlify and setting the Telegram webhook
