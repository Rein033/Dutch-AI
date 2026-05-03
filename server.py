#!/usr/bin/env python3
"""Dutchy web server — Flask backend with SSE streaming."""

import json
import os
import sys

try:
    import anthropic
except ImportError:
    print("Error: 'anthropic' not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    from flask import Flask, Response, request, send_from_directory, stream_with_context
except ImportError:
    print("Error: 'flask' not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


SYSTEM_PROMPT = """Je bent Dutchy — een persoonlijke AI-assistent met een Nederlandse ziel.
(You are Dutchy — a personal AI assistant with a Dutch soul.)

Personality:
- Direct and no-nonsense, like a true Nederlander — you say what you mean
- Warm and down-to-earth; you treat the user like a good friend (a "maatje")
- Clever and resourceful — you find solutions, not excuses
- Occasionally drop in Dutch phrases, expressions, or a bit of Dutch humour
  (e.g. "lekker bezig!", "doe maar gewoon", "gezellig", "alsjeblieft", "tot ziens")
- Confident but never arrogant — you admit when you don't know something

Your role:
- You are the user's personal Jarvis — their intelligent companion for tasks,
  questions, brainstorming, coding help, advice, and everyday conversations
- You remember everything said in this session and use it to give better answers
- You proactively point out better approaches when you spot them
- You are thorough but concise — no filler, no waffle

Communication style:
- Natural, conversational Dutch-accented English
- Use "you" not "the user" — speak directly to the person
- Format answers clearly: use bullet points or code blocks when helpful
- Match the tone of the conversation: casual for small talk, sharp for technical work
"""

app = Flask(__name__, static_folder="static")

# In-memory conversation history (single-user, session-scoped)
messages: list[dict] = []


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def generate_stream(user_message: str):
    """Generator yielding SSE events for a single turn."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        yield _sse({"type": "error", "message": "No API key configured on the server."})
        return

    messages.append({"role": "user", "content": user_message})
    client = anthropic.Anthropic(api_key=api_key)
    full_text = ""
    thinking_started = False

    try:
        with client.messages.stream(
            model="claude-opus-4-7",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            thinking={"type": "adaptive"},
            messages=messages,
        ) as stream:
            for event in stream:
                if event.type == "content_block_start":
                    block = event.content_block
                    if block.type == "thinking" and not thinking_started:
                        thinking_started = True
                        yield _sse({"type": "thinking_start"})
                    elif block.type == "text":
                        yield _sse({"type": "text_start"})

                elif event.type == "content_block_delta":
                    if event.delta.type == "text_delta":
                        chunk = event.delta.text
                        full_text += chunk
                        yield _sse({"type": "text", "content": chunk})

    except anthropic.BadRequestError as e:
        if "thinking" in str(e).lower():
            yield from _generate_without_thinking(client, messages)
            return
        messages.pop()
        yield _sse({"type": "error", "message": str(e)})
        return

    except anthropic.AuthenticationError:
        messages.pop()
        yield _sse({"type": "error", "message": "Authentication failed — check ANTHROPIC_API_KEY."})
        return

    except anthropic.RateLimitError:
        messages.pop()
        yield _sse({"type": "error", "message": "Rate limit hit — even Dutchy needs a breather. Try again shortly."})
        return

    except anthropic.APIConnectionError:
        messages.pop()
        yield _sse({"type": "error", "message": "Connection error — check your internet. ('Geen internet? Echt niet!')"})
        return

    except anthropic.APIStatusError as e:
        messages.pop()
        yield _sse({"type": "error", "message": f"API error {e.status_code}: {e.message}"})
        return

    except Exception as e:
        messages.pop()
        yield _sse({"type": "error", "message": f"Unexpected error: {e}"})
        return

    if full_text:
        messages.append({"role": "assistant", "content": full_text})
    else:
        messages.pop()

    yield _sse({"type": "done"})


def _generate_without_thinking(client: anthropic.Anthropic, msgs: list[dict]):
    """Fallback generator — no adaptive thinking."""
    full_text = ""
    yield _sse({"type": "text_start"})
    try:
        with client.messages.stream(
            model="claude-opus-4-7",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=msgs,
        ) as stream:
            for text in stream.text_stream:
                full_text += text
                yield _sse({"type": "text", "content": text})
    except Exception as e:
        msgs.pop()
        yield _sse({"type": "error", "message": str(e)})
        return

    if full_text:
        msgs.append({"role": "assistant", "content": full_text})
    else:
        msgs.pop()

    yield _sse({"type": "done"})


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    if not user_message:
        return {"error": "Empty message"}, 400

    return Response(
        stream_with_context(generate_stream(user_message)),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/clear", methods=["POST"])
def clear():
    messages.clear()
    return {"status": "ok", "message": "Conversation cleared — fresh start!"}


@app.route("/status")
def status():
    return {"turns": len(messages)}


if __name__ == "__main__":
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("\n\033[91mNo ANTHROPIC_API_KEY found.\033[0m")
        print("  Copy .env.example → .env and add your key.\n")
        sys.exit(1)

    host = os.environ.get("DUTCHY_HOST", "0.0.0.0")
    port = int(os.environ.get("DUTCHY_PORT", 5000))
    print(f"\n\033[38;5;208m\033[1mDutchy\033[0m is running → http://{host}:{port}")
    print("  Press Ctrl-C to stop.\n")
    app.run(host=host, port=port, debug=False)
