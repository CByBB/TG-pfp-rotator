# Telegram Profile Photo Rotator

Public repo: [https://github.com/CByBB/TG-pfp-rotator](https://github.com/CByBB/TG-pfp-rotator)

A multi-user Telegram bot that asks for your phone number, logs into that account, and rotates your profile photo through a gallery you upload. Images are cropped and resized to a square before they are saved. There is no database — each user is stored as files under `data/`.

Donate: [https://nowpayments.io/donation/CodeByBB](https://nowpayments.io/donation/CodeByBB)

## Features

- `/start` shows the full welcome/help text and asks permission to read your phone number
- After you share the number, the bot starts a user-account login and asks for the Telegram code
- The code is entered with an inline number pad (tap digits one by one, backspace, confirm)
- If the account has 2FA, the bot asks for the cloud password
- Send photos or image files after login; they are resized/cropped and stored as your gallery
- Sending a new batch **clears the previous gallery** and keeps only the new images
- Profile photos rotate on an interval you choose: 30 seconds, 1 minute, 5 minutes, … 1 day
- `/pause` and `/resume` stop and start rotation
- Each chat has its own session, gallery, interval, and pause state

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io)
- A bot token from [@BotFather](https://t.me/BotFather)
- `api_id` and `api_hash` from [https://my.telegram.org](https://my.telegram.org)

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill `.env`:

```env
BOT_TOKEN=123456:your-bot-token
API_ID=123456
API_HASH=your-api-hash
DATA_DIR=./data
REPO_URL=https://github.com/CByBB/TG-pfp-rotator
DONATION_URL=https://nowpayments.io/donation/CodeByBB
LOG_LEVEL=info
```

Run in development:

```bash
pnpm dev
```

Build and run:

```bash
pnpm build
pnpm start
```

## Commands

| Command     | What it does                                  |
| ----------- | --------------------------------------------- |
| `/start`    | Welcome text and phone-number permission      |
| `/help`     | Same full guide as `/start`                   |
| `/interval` | Inline buttons: 30s, 1 min, 5 min, … 1 day    |
| `/pause`    | Pause rotation                                |
| `/resume`   | Resume rotation                               |
| `/status`   | Login, gallery size, interval, running/paused |
| `/donate`   | Donation page and public repository link      |

Optional BotFather `/setcommands` list:

```text
start - Welcome and request phone access
help - Show the full usage guide
interval - Choose rotation speed
pause - Pause profile photo rotation
resume - Resume profile photo rotation
status - Show gallery and rotation state
donate - Donation and public repo links
```

## Storage layout

User data is written as files, not a database:

```text
data/users/<telegram-user-id>/
  user.json      # interval, pause state, gallery file names
  session.txt    # GramJS string session for that account
  images/        # processed 640x640 JPEG profile photos
    000.jpg
    001.jpg
```

`data/` is gitignored. Do not commit sessions or `.env`.

## Scripts

| Script           | Purpose                       |
| ---------------- | ----------------------------- |
| `pnpm dev`       | Run with `tsx` watch          |
| `pnpm build`     | Compile TypeScript to `dist/` |
| `pnpm start`     | Run the compiled bot          |
| `pnpm lint`      | ESLint                        |
| `pnpm format`    | Prettier                      |
| `pnpm typecheck` | `tsc --noEmit`                |

Husky runs `lint-staged` on commit (ESLint + Prettier).

## Security

Whoever hosts this bot can use the saved sessions to act as the connected Telegram accounts. Self-host it. Only share phone access with a bot instance you operate and trust.

Userbots can conflict with Telegram’s terms. Use this at your own risk, especially with very short intervals.

## License

MIT
