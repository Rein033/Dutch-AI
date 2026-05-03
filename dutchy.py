#!/usr/bin/env python3
"""Dutchy — your Dutch personal AI assistant, powered by Claude."""

import os
import sys

try:
    import anthropic
except ImportError:
    print("Error: 'anthropic' not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# ── ANSI colours ────────────────────────────────────────────────────────────
class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    CYAN    = "\033[96m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    RED     = "\033[91m"
    ORANGE  = "\033[38;5;208m"
    BLUE    = "\033[94m"
    WHITE   = "\033[97m"


# ── Dutchy's personality ─────────────────────────────────────────────────────
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


# ── ASCII banner ─────────────────────────────────────────────────────────────
BANNER = rf"""
{C.ORANGE}{C.BOLD}  ____        _       _
 |  _ \  _  _| |_ ___| |__  _   _
 | | | || | | | __/ __| '_ \| | | |
 | |_| || |_| | || (__| | | | |_| |
 |____/  \__,_|\__\___|_| |_|\__, |
                               |___/{C.RESET}
{C.DIM}  Jouw persoonlijke AI-assistent  ·  Your Dutch AI companion{C.RESET}
"""

HELP_TEXT = f"""
{C.BOLD}Commands{C.RESET}
  {C.CYAN}/help{C.RESET}     Show this message
  {C.CYAN}/clear{C.RESET}    Reset conversation history and start fresh
  {C.CYAN}/status{C.RESET}   Show conversation length
  {C.CYAN}/exit{C.RESET}     Quit  (or Ctrl-C)

{C.BOLD}Tips{C.RESET}
  · Ask Dutchy anything — tasks, code, advice, casual chat
  · Conversation history is kept in-session so Dutchy remembers context
  · Use {C.CYAN}/clear{C.RESET} to start a brand-new conversation
"""


# ── Core chat logic ───────────────────────────────────────────────────────────
def stream_response(client: anthropic.Anthropic, messages: list[dict]) -> str:
    """Stream Claude's response and return the full reply text."""
    full_text = ""
    thinking_shown = False
    response_started = False

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
                    if block.type == "thinking" and not thinking_shown:
                        # Thinking is happening — show a subtle indicator
                        print(f"\n{C.DIM}  ⟳ aan het denken…{C.RESET}", flush=True)
                        thinking_shown = True
                    elif block.type == "text" and not response_started:
                        gap = "\n" if thinking_shown else ""
                        print(
                            f"{gap}{C.ORANGE}{C.BOLD}Dutchy{C.RESET}"
                            f"{C.DIM} ›{C.RESET} ",
                            end="", flush=True,
                        )
                        response_started = True

                elif event.type == "content_block_delta":
                    if event.delta.type == "text_delta":
                        if not response_started:
                            print(
                                f"\n{C.ORANGE}{C.BOLD}Dutchy{C.RESET}"
                                f"{C.DIM} ›{C.RESET} ",
                                end="", flush=True,
                            )
                            response_started = True
                        print(event.delta.text, end="", flush=True)
                        full_text += event.delta.text

    except anthropic.BadRequestError as e:
        # Thinking + certain features can clash; fall back without thinking
        if "thinking" in str(e).lower():
            return _stream_without_thinking(client, messages)
        raise

    print(f"\n{C.DIM}{'─' * 52}{C.RESET}\n")
    return full_text


def _stream_without_thinking(
    client: anthropic.Anthropic, messages: list[dict]
) -> str:
    """Fallback stream without adaptive thinking."""
    full_text = ""
    print(
        f"\n{C.ORANGE}{C.BOLD}Dutchy{C.RESET}{C.DIM} ›{C.RESET} ",
        end="", flush=True,
    )
    with client.messages.stream(
        model="claude-opus-4-7",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
            full_text += text
    print(f"\n{C.DIM}{'─' * 52}{C.RESET}\n")
    return full_text


# ── Main loop ─────────────────────────────────────────────────────────────────
def main() -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print(f"\n{C.RED}No API key found.{C.RESET}")
        print(
            f"  Set {C.CYAN}ANTHROPIC_API_KEY{C.RESET} in your environment "
            f"or create a {C.DIM}.env{C.RESET} file.\n"
            f"  Copy {C.DIM}.env.example{C.RESET} to get started.\n"
        )
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    messages: list[dict] = []

    print(BANNER)
    print(
        f"  {C.DIM}Type {C.CYAN}/help{C.RESET}{C.DIM} for commands "
        f"· {C.CYAN}Ctrl-C{C.RESET}{C.DIM} to quit{C.RESET}\n"
    )

    while True:
        # ── prompt ──────────────────────────────────────────────────────────
        try:
            user_input = input(
                f"{C.GREEN}{C.BOLD}You{C.RESET}{C.DIM} ›{C.RESET} "
            ).strip()
        except (KeyboardInterrupt, EOFError):
            print(f"\n{C.DIM}Tot ziens! 👋{C.RESET}\n")
            break

        if not user_input:
            continue

        # ── built-in commands ────────────────────────────────────────────────
        cmd = user_input.lower()

        if cmd in ("/exit", "/quit"):
            print(f"\n{C.DIM}Tot ziens! 👋{C.RESET}\n")
            break

        if cmd == "/help":
            print(HELP_TEXT)
            continue

        if cmd == "/clear":
            messages.clear()
            print(f"  {C.DIM}Conversation cleared — fresh start! 🌷{C.RESET}\n")
            continue

        if cmd == "/status":
            turns = len(messages)
            print(
                f"  {C.DIM}{turns} message{'s' if turns != 1 else ''} "
                f"in this conversation.{C.RESET}\n"
            )
            continue

        # ── send to Dutchy ───────────────────────────────────────────────────
        messages.append({"role": "user", "content": user_input})

        try:
            reply = stream_response(client, messages)
            if reply:
                messages.append({"role": "assistant", "content": reply})
            else:
                messages.pop()  # no reply — don't corrupt history

        except anthropic.AuthenticationError:
            print(f"  {C.RED}Auth failed — check your ANTHROPIC_API_KEY.{C.RESET}\n")
            messages.pop()

        except anthropic.RateLimitError:
            print(
                f"  {C.YELLOW}Rate limit hit — even Dutchy needs a moment. "
                f"Try again shortly.{C.RESET}\n"
            )
            messages.pop()

        except anthropic.APIConnectionError:
            print(
                f"  {C.RED}Connection error — check your internet. "
                f"('Geen internet? Echt niet!'){C.RESET}\n"
            )
            messages.pop()

        except anthropic.APIStatusError as e:
            print(f"  {C.RED}API error {e.status_code}: {e.message}{C.RESET}\n")
            messages.pop()

        except Exception as e:
            print(f"  {C.RED}Unexpected error: {e}{C.RESET}\n")
            messages.pop()


if __name__ == "__main__":
    main()
