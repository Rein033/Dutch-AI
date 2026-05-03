"use strict";

// ── DOM refs ─────────────────────────────────────────────────────────────────
const chatArea  = document.getElementById("chat-area");
const input     = document.getElementById("user-input");
const sendBtn   = document.getElementById("send-btn");
const clearBtn  = document.getElementById("clear-btn");
const statusBadge = document.getElementById("status-badge");

let turnCount = 0;
let streaming = false;

// ── Welcome screen ────────────────────────────────────────────────────────────
const STARTERS = [
  "What can you help me with?",
  "Tell me something interesting",
  "Help me write some code",
  "Wat is jouw favoriete Nederlandse uitdrukking?",
];

function renderWelcome() {
  chatArea.innerHTML = "";
  const div = document.createElement("div");
  div.className = "welcome";
  div.innerHTML = `
    <div class="welcome-logo">D</div>
    <h1>Hallo! Ik ben Dutchy.</h1>
    <p>Your personal AI companion — direct, warm, and a little Dutch.<br>
       Ask me anything: code, advice, brainstorming, casual chat.</p>
    <div class="hint-chips">
      ${STARTERS.map(s => `<button class="chip">${escHtml(s)}</button>`).join("")}
    </div>
  `;
  chatArea.appendChild(div);

  div.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      input.value = chip.textContent;
      sendMessage();
    });
  });
}

// ── Markdown renderer (no CDN — fully self-contained) ────────────────────────
function renderMarkdown(raw) {
  let s = raw;

  // Fenced code blocks
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${escHtml(code.trimEnd())}</code></pre>`;
  });

  // Inline code
  s = s.replace(/`([^`\n]+)`/g, (_, code) => `<code>${escHtml(code)}</code>`);

  // Headers
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm,  "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm,   "<h1>$1</h1>");

  // Bold / italic
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g,     "<em>$1</em>");

  // Unordered lists (group consecutive items)
  s = s.replace(/((?:^[ \t]*[-*+] .+\n?)+)/gm, match => {
    const items = match.trim().split(/\n/).map(line =>
      `<li>${line.replace(/^[ \t]*[-*+] /, "")}</li>`
    ).join("");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  s = s.replace(/((?:^[ \t]*\d+\. .+\n?)+)/gm, match => {
    const items = match.trim().split(/\n/).map(line =>
      `<li>${line.replace(/^[ \t]*\d+\. /, "")}</li>`
    ).join("");
    return `<ol>${items}</ol>`;
  });

  // Paragraphs — wrap double-newline-separated blocks that aren't already HTML
  s = s.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return "";
    if (/^<(h[1-6]|ul|ol|pre|li)/.test(block)) return block;
    return `<p>${block.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return s;
}

function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Message rendering ─────────────────────────────────────────────────────────
function appendUserMsg(text) {
  const msg = document.createElement("div");
  msg.className = "msg user";
  msg.innerHTML = `
    <div class="avatar">U</div>
    <div class="bubble">${escHtml(text).replace(/\n/g, "<br>")}</div>
  `;
  chatArea.appendChild(msg);
  scrollBottom();
}

function createAssistantMsg() {
  // Remove welcome screen on first message
  const welcome = chatArea.querySelector(".welcome");
  if (welcome) welcome.remove();

  const msg = document.createElement("div");
  msg.className = "msg assistant";
  msg.innerHTML = `
    <div class="avatar">D</div>
    <div class="bubble">
      <div class="thinking-row" id="thinking-row">
        <div class="thinking-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="thinking-label">aan het denken…</span>
      </div>
      <div class="response-text" id="response-text"></div>
    </div>
  `;
  chatArea.appendChild(msg);
  scrollBottom();
  return msg;
}

function scrollBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function updateStatus() {
  statusBadge.textContent = `${turnCount} bericht${turnCount !== 1 ? "en" : ""}`;
}

// ── Streaming fetch via SSE ───────────────────────────────────────────────────
async function sendMessage() {
  const text = input.value.trim();
  if (!text || streaming) return;

  streaming = true;
  sendBtn.disabled = true;
  input.value = "";
  input.style.height = "auto";

  appendUserMsg(text);
  const assistantMsg = createAssistantMsg();
  const thinkingRow  = assistantMsg.querySelector("#thinking-row");
  const responseText = assistantMsg.querySelector("#response-text");

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
      showError(assistantMsg, err.error || "Something went wrong.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let event;
        try { event = JSON.parse(line.slice(6)); } catch { continue; }

        if (event.type === "thinking_start") {
          // dots already visible — nothing extra needed
        } else if (event.type === "text_start") {
          thinkingRow.style.display = "none";
          textStarted = true;
        } else if (event.type === "text") {
          rawText += event.content;
          // Render markdown incrementally but only update DOM every chunk
          responseText.innerHTML = renderMarkdown(rawText);
          scrollBottom();
        } else if (event.type === "done") {
          // Final clean markdown render
          responseText.innerHTML = renderMarkdown(rawText);
          turnCount++;
          updateStatus();
          scrollBottom();
        } else if (event.type === "error") {
          showError(assistantMsg, event.message);
        }
      }
    }

  } catch (err) {
    showError(assistantMsg, "Network error — check your connection.");
  } finally {
    // Clean up thinking indicator if still showing
    if (!textStarted) thinkingRow.style.display = "none";
    streaming = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

function showError(msgEl, message) {
  const thinkingRow  = msgEl.querySelector("#thinking-row");
  const responseText = msgEl.querySelector("#response-text");
  if (thinkingRow) thinkingRow.style.display = "none";
  if (responseText) {
    responseText.innerHTML = `<em style="color:#e05252;">${escHtml(message)}</em>`;
  }
}

// ── Clear conversation ────────────────────────────────────────────────────────
clearBtn.addEventListener("click", async () => {
  if (streaming) return;
  try {
    await fetch("/clear", { method: "POST" });
  } catch (_) {}
  turnCount = 0;
  updateStatus();
  renderWelcome();
});

// ── Textarea auto-resize ──────────────────────────────────────────────────────
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

// ── Enter to send / Shift+Enter for newline ───────────────────────────────────
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener("click", sendMessage);

// ── Init ──────────────────────────────────────────────────────────────────────
renderWelcome();
updateStatus();
input.focus();
