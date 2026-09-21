# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a vulnerability

Do **not** open a public issue for security problems.

Report privately through [GitHub Security Advisories](https://github.com/CByBB/TG-pfp-rotator/security/advisories/new).

Please include:

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept if you have one
- Affected version or commit

We aim to acknowledge reports within 7 days and to share a fix or mitigation plan as soon as one is ready.

## What this project stores

This bot logs into **user Telegram accounts**. On disk it keeps:

- GramJS session strings (`data/users/<id>/session.txt`)
- Phone numbers and rotation settings (`user.json`)
- Uploaded profile photos

A session file is equivalent to being logged in as that user. Treat `data/` and `.env` as secrets.

## Operational rules

- Self-host the bot. Whoever runs it can use every saved session.
- Never commit `.env`, `data/`, or `*.session` files.
- Use a dedicated bot token and Telegram API credentials. Do not reuse secrets from other apps.
- Rotate `BOT_TOKEN`, `API_ID`, and `API_HASH` if they leak.
- Users should only share their phone number with a bot instance they operate and trust.
- Short rotation intervals can trigger Telegram flood limits or account restrictions.

## Scope

In scope:

- Session or credential leakage
- Path traversal or arbitrary file writes under `data/`
- Auth-flow bugs that expose login codes or 2FA passwords in logs
- Multi-user isolation failures (one user affecting another user's session or gallery)

Out of scope:

- Telegram platform outages or official API policy changes
- Abuse of a self-hosted instance by its operator
- Issues that only appear after secrets were already committed or published

## Disclosure

Please give us a reasonable window to patch before public disclosure. Credit will be given if you want it.
