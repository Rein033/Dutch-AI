"use strict";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const chatArea   = document.getElementById("chat-area");
const inputEl    = document.getElementById("user-input");
const sendBtn    = document.getElementById("send-btn");
const micBtn     = document.getElementById("mic-btn");
const clearBtn   = document.getElementById("clear-btn");
const voiceToggle = document.getElementById("voice-toggle");
const voiceIconOn  = document.getElementById("voice-icon-on");
const voiceIconOff = document.getElementById("voice-icon-off");
const statusBadge  = document.getElementById("status-badge");
const orbWrap    = document.getElementById("orb-wrap");
const stateLabel = document.getElementById("state-label");

// ── Orb state machine ─────────────────────────────────────────────────────────
const ORB = { IDLE: "idle", LISTENING: "listening", THINKING: "thinking", SPEAKING: "speaking" };
const STATE_LABELS = { idle: "", listening: "luisteren…", thinking: "denken…", speaking: "spreken…" };

let currentOrb = ORB.IDLE;

function setOrb(state) {
  orbWrap.classList.remove(ORB.IDLE, ORB.LISTENING, ORB.THINKING, ORB.SPEAKING);
  orbWrap.classList.add(state);
  stateLabel.textContent = STATE_LABELS[state] || "";
  currentOrb = state;
}

// Start idle
setOrb(ORB.IDLE);

// ── Voice output toggle ────────────────────────────────────────────────────────
let voiceEnabled = true;

voiceToggle.classList.add("voice-on");
voiceToggle.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  if (!voiceEnabled) {
    window.speechSynthesis?.cancel();
    voiceToggle.classList.remove("voice-on");
    voiceToggle.classList.add("voice-off");
    voiceIconOn.style.display  = "none";
    voiceIconOff.style.display = "";
    if (currentOrb === ORB.SPEAKING) setOrb(ORB.IDLE);
  } else {
    voiceToggle.classList.remove("voice-off");
    voiceToggle.classList.add("voice-on");
    voiceIconOn.style.display  = "";
    voiceIconOff.style.display = "none";
  }
});

// ── Speech Synthesis (TTS) ────────────────────────────────────────────────────
function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, "codeblok weggelaten")
    .replace(/`[^`\n]+`/g, "")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

function speak(text) {
  if (!voiceEnabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = stripMarkdown(text);
  if (!clean) return;

  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang  = "nl-NL";
  utt.rate  = 1.05;
  utt.pitch = 0.95;

  utt.onstart  = () => setOrb(ORB.SPEAKING);
  utt.onend    = () => setOrb(ORB.IDLE);
  utt.onerror  = () => setOrb(ORB.IDLE);

  // Pick a decent voice when available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    /nl.*(NL|BE)/i.test(v.lang)
  ) || voices.find(v => /nl/i.test(v.lang));
  if (preferred) utt.voice = preferred;

  window.speechSynthesis.speak(utt);
}

// Voices may load async
window.speechSynthesis?.addEventListener("voiceschanged", () => {});

// ── Web Speech Recognition (STT) ─────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let micActive   = false;

// Add transcript preview element above the input wrap
const transcriptEl = document.createElement("div");
transcriptEl.id = "transcript-preview";
document.querySelector("footer").prepend(transcriptEl);

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous      = false;
  recognition.interimResults  = true;
  recognition.lang            = "nl-NL";

  recognition.onstart = () => {
    micActive = true;
    micBtn.classList.add("active");
    setOrb(ORB.LISTENING);
    window.speechSynthesis?.cancel();
  };

  recognition.onresult = (e) => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
    transcriptEl.textContent = transcript;
    transcriptEl.classList.add("visible");
    inputEl.value = transcript;

    if (e.results[e.results.length - 1].isFinal) {
      recognition.stop();
      // Small delay so the user sees the final transcript before it's sent
      setTimeout(() => sendMessage(), 200);
    }
  };

  recognition.onend = () => {
    micActive = false;
    micBtn.classList.remove("active");
    transcriptEl.classList.remove("visible");
    if (currentOrb === ORB.LISTENING) setOrb(ORB.IDLE);
  };

  recognition.onerror = (e) => {
    micActive = false;
    micBtn.classList.remove("active");
    transcriptEl.classList.remove("visible");
    setOrb(ORB.IDLE);
    if (e.error !== "no-speech" && e.error !== "aborted") {
      console.warn("Speech error:", e.error);
    }
  };

  micBtn.addEventListener("click", () => {
    if (streaming) return;
    if (micActive) {
      recognition.stop();
    } else {
      inputEl.value = "";
      recognition.start();
    }
  });
} else {
  micBtn.classList.add("no-voice");
  micBtn.title = "Spraakinvoer wordt niet ondersteund in deze browser";
  micBtn.disabled = true;
}

// ── Markdown renderer (no CDN) ────────────────────────────────────────────────
function esc(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function renderMarkdown(raw) {
  let s = raw;
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) =>
    `<pre><code>${esc(code.trimEnd())}</code></pre>`);
  s = s.replace(/`([^`\n]+)`/g, (_, c) => `<code>${esc(c)}</code>`);
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm,  "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm,   "<h1>$1</h1>");
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g,     "<em>$1</em>");
  s = s.replace(/((?:^[ \t]*[-*+] .+\n?)+)/gm, m => {
    const items = m.trim().split(/\n/).map(l => `<li>${l.replace(/^[ \t]*[-*+] /,"")}</li>`).join("");
    return `<ul>${items}</ul>`;
  });
  s = s.replace(/((?:^[ \t]*\d+\. .+\n?)+)/gm, m => {
    const items = m.trim().split(/\n/).map(l => `<li>${l.replace(/^[ \t]*\d+\. /,"")}</li>`).join("");
    return `<ol>${items}</ol>`;
  });
  s = s.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return "";
    if (/^<(h[1-6]|ul|ol|pre)/.test(block)) return block;
    return `<p>${block.replace(/\n/g,"<br>")}</p>`;
  }).join("\n");
  return s;
}

// ── Welcome screen ────────────────────────────────────────────────────────────
const STARTERS = [
  "Waarmee kan je me helpen?",
  "Help me een bug oplossen",
  "Wat betekent 'gezellig'?",
  "Vertel me iets interessants",
];

function renderWelcome() {
  chatArea.innerHTML = `
    <div class="welcome">
      <div class="welcome-orb-wrap">
        <div class="welcome-orb-glow"></div>
        <div class="welcome-orb"></div>
      </div>
      <h1>Hallo! Ik ben Dutchy.</h1>
      <p>Jouw persoonlijke AI-assistent — direct, warm en nuchter.<br>
         Typ je vraag of klik op de microfoon en spreek gewoon.</p>
      <div class="hint-chips">
        ${STARTERS.map(s => `<button class="chip">${esc(s)}</button>`).join("")}
      </div>
    </div>`;
  chatArea.querySelectorAll(".chip").forEach(chip =>
    chip.addEventListener("click", () => { inputEl.value = chip.textContent; sendMessage(); })
  );
}

// ── Message rendering ─────────────────────────────────────────────────────────
let turnCount = 0;
let streaming = false;

function updateStatus() {
  statusBadge.textContent = `${turnCount} bericht${turnCount !== 1 ? "en" : ""}`;
}

function appendUserMsg(text) {
  chatArea.querySelector(".welcome")?.remove();
  const div = document.createElement("div");
  div.className = "msg user";
  div.innerHTML = `<div class="avatar">U</div>
    <div class="bubble">${esc(text).replace(/\n/g,"<br>")}</div>`;
  chatArea.appendChild(div);
  scrollBottom();
}

function createAssistantMsg() {
  const div = document.createElement("div");
  div.className = "msg assistant";
  div.innerHTML = `
    <div class="avatar">D</div>
    <div class="bubble">
      <div class="thinking-row" id="tr">
        <div class="thinking-dots"><span></span><span></span><span></span></div>
        <span class="thinking-label">aan het denken…</span>
      </div>
      <div id="rt"></div>
    </div>`;
  chatArea.appendChild(div);
  scrollBottom();
  return div;
}

function scrollBottom() { chatArea.scrollTop = chatArea.scrollHeight; }

// ── Core send/stream ──────────────────────────────────────────────────────────
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || streaming) return;

  streaming = true;
  sendBtn.disabled = true;
  inputEl.value = "";
  inputEl.style.height = "auto";

  appendUserMsg(text);
  const msgEl  = createAssistantMsg();
  const thinkRow = msgEl.querySelector("#tr");
  const respEl   = msgEl.querySelector("#rt");

  setOrb(ORB.THINKING);

  let rawText = "";
  let textStarted = false;

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      showBubbleError(thinkRow, respEl, err.error || "Er ging iets mis.");
      setOrb(ORB.IDLE);
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let ev;
        try { ev = JSON.parse(line.slice(6)); } catch { continue; }

        if (ev.type === "text_start") {
          thinkRow.style.display = "none";
          textStarted = true;
        } else if (ev.type === "text") {
          rawText += ev.content;
          respEl.innerHTML = renderMarkdown(rawText);
          scrollBottom();
        } else if (ev.type === "done") {
          respEl.innerHTML = renderMarkdown(rawText);
          turnCount++;
          updateStatus();
          scrollBottom();
          speak(rawText);           // TTS — sets orb to SPEAKING then IDLE
          if (!voiceEnabled) setOrb(ORB.IDLE);
        } else if (ev.type === "error") {
          showBubbleError(thinkRow, respEl, ev.message);
          setOrb(ORB.IDLE);
        }
      }
    }

  } catch (err) {
    showBubbleError(thinkRow, respEl, "Netwerkfout — controleer je verbinding.");
    setOrb(ORB.IDLE);
  } finally {
    if (!textStarted) thinkRow.style.display = "none";
    streaming = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

function showBubbleError(thinkRow, respEl, message) {
  thinkRow.style.display = "none";
  respEl.innerHTML = `<em style="color:#e05252;">${esc(message)}</em>`;
}

// ── Clear conversation ────────────────────────────────────────────────────────
clearBtn.addEventListener("click", async () => {
  if (streaming) return;
  window.speechSynthesis?.cancel();
  setOrb(ORB.IDLE);
  try { await fetch("/clear", { method: "POST" }); } catch (_) {}
  turnCount = 0;
  updateStatus();
  renderWelcome();
});

// ── Textarea auto-resize ──────────────────────────────────────────────────────
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
});

inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

sendBtn.addEventListener("click", sendMessage);

// ── Init ──────────────────────────────────────────────────────────────────────
renderWelcome();
updateStatus();
inputEl.focus();
