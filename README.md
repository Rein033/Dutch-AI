# Dutch-AI — Dutchy

**[Live preview →](https://rein033.github.io/dutch-ai/)**

Your personal Dutch AI assistant. Think Jarvis, but with a Dutch soul.

Dutchy is a web-based AI companion powered by Claude. It keeps full conversation history within each session, reasons adaptively on hard questions, and speaks to you like a Dutch friend — direct, warm, and no-nonsense.

## Quick start — Web app

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
# Get one at https://console.anthropic.com/

# 3. Start Dutchy
python server.py
```

Then open **http://localhost:5000** in your browser.

On your local network (e.g. from another device), use your machine's IP:

```
http://192.168.x.x:5000
```

## Self-hosting on a thin client / external SSD

Dutchy is designed to run on low-power hardware:

1. Copy the project to your SSD or thin client
2. Install Python 3.10+ and the dependencies (`pip install -r requirements.txt`)
3. Add your API key to `.env`
4. Run `python server.py` — Dutchy listens on `0.0.0.0:5000` so any device on the network can reach it

Optional — run in the background with `nohup`:

```bash
nohup python server.py &> dutchy.log &
```

## Terminal / CLI version

A standalone terminal version is also included:

```bash
python dutchy.py
```

### CLI commands

| Command   | Description                        |
|-----------|------------------------------------|
| `/help`   | Show available commands            |
| `/clear`  | Reset conversation history         |
| `/status` | Show number of messages in session |
| `/exit`   | Quit (or Ctrl-C)                   |

## Features

- **Full conversation memory** — Dutchy remembers everything said earlier in the session
- **Adaptive thinking** — uses extended reasoning automatically on hard problems
- **Streaming responses** — output appears in real-time as Dutchy types
- **Dutch personality** — direct, practical, with Dutch expressions sprinkled in
- **Dark Dutch-orange UI** — clean, responsive web interface
- **Zero CDN dependencies** — fully self-contained, works offline (except the API)
- **Network-accessible** — bind to any device on your local network

## GitHub Pages (landing page)

The `docs/` folder contains a static landing page you can host on GitHub Pages:

1. Go to **Settings → Pages** in your GitHub repo
2. Set **Source** to `Deploy from a branch`
3. Set **Branch** to `main` and **folder** to `/docs`
4. Click Save — your page will be live at `https://rein033.github.io/dutch-ai/`

> The GitHub Pages site is a static preview only. The full Dutchy app (with voice and AI) still runs via `python server.py` on your own machine.

## Project structure

```
Dutch-AI/
├── server.py          # Flask web server (main entry point)
├── dutchy.py          # Terminal CLI version
├── static/
│   ├── index.html     # Web UI
│   ├── style.css      # Dutch orange dark theme
│   └── app.js         # Frontend logic (SSE, voice, orb states, markdown)
├── docs/
│   └── index.html     # Static GitHub Pages landing page
├── requirements.txt
├── .env.example
└── .gitignore
```

## Requirements

- Python 3.10+
- An [Anthropic API key](https://console.anthropic.com/)
