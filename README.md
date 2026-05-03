# Dutch-AI — Dutchy

Your personal Dutch AI assistant. Think Jarvis, but with a Dutch soul.

Dutchy is a terminal-based AI companion powered by Claude. It keeps a full conversation history within each session, reasons adaptively on hard questions, and speaks to you like a Dutch friend — direct, warm, and no-nonsense.

## Quick start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
# Get one at https://console.anthropic.com/

# 3. Run
python dutchy.py
```

## Commands

| Command   | Description                        |
|-----------|------------------------------------|
| `/help`   | Show available commands            |
| `/clear`  | Reset conversation history         |
| `/status` | Show number of messages in session |
| `/exit`   | Quit (or Ctrl-C)                   |

## Features

- **Full conversation memory** — Dutchy remembers everything you said earlier in the session
- **Adaptive thinking** — uses extended reasoning automatically on hard problems
- **Streaming responses** — output appears in real-time as Dutchy types
- **Dutch personality** — direct, practical, with Dutch expressions sprinkled in
- **Clean terminal UI** — colour-coded, readable output with a thinking indicator

## Requirements

- Python 3.10+
- An [Anthropic API key](https://console.anthropic.com/)
