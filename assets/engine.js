// Ballot Brain AZ: engine front end. Talks only to /api/chat. All model text is rendered with textContent.
(function () {
  "use strict";

  var SILENCE_MS = 10000; // voice input turns off after this much silence
  var STORE_KEY = "bb-chat-v1";
  var MAX_SEND = 24;
  var PROJECT = "Ballot Brain AZ";
  var ASSISTANT_LABEL = "Ballot Brain";

  var $ = function (id) { return document.getElementById(id); };
  var log = $("chat-log"), form = $("composer"), input = $("chat-input"), sendBtn = $("send-btn");
  var countChip = $("msg-count"), resetBtn = $("reset-btn"), dlBtn = $("download-btn");
  var fullBtn = $("full-btn"), fullLabel = $("full-label"), card = $("chat-card");
  var micBtn = $("mic-btn"), micStatus = $("mic-status"), micError = $("mic-error");

  var state = load() || { messages: [], matches: [], selected: null, nextStep: "" };
  var busy = false;

  function load() { try { var s = sessionStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function save() { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } }

  // ---------- parsing ----------
  function splitReply(text) {
    var lines = String(text).split(/\r?\n/);
    var visible = [], matches = [], next = "";
    lines.forEach(function (line) {
      var t = line.trim();
      if (/^MATCH:/i.test(t)) {
        try {
          var obj = JSON.parse(t.replace(/^MATCH:\s*/i, ""));
          if (obj && obj.title) {
            var sc = Math.max(0, Math.min(100, Math.round(Number(obj.score) || 0)));
            var details = {};
            if (obj.details && typeof obj.details === "object") Object.keys(obj.details).forEach(function (k) { if (typeof obj.details[k] !== "object") details[String(k)] = String(obj.details[k]); });
            matches.push({ id: String(obj.id || ""), title: String(obj.title), score: sc, why: String(obj.why || ""), details: details });
          }
        } catch (e) { /* malformed MATCH line: hidden anyway */ }
        return;
      }
      if (/^next step:/i.test(t)) next = t.replace(/^next step:\s*/i, "");
      visible.push(line);
    });
    return { text: visible.join("\n").replace(/\n{3,}/g, "\n\n").trim(), matches: matches.sort(function (a, b) { return b.score - a.score; }), next: next };
  }

  // ---------- rendering ----------
  function appendLinked(el, text) {
    var re = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = document.createElement("a");
      a.href = m[1]; a.textContent = m[1]; a.target = "_blank"; a.rel = "noopener noreferrer";
      el.appendChild(a);
      last = m.index + m[1].length;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }

  function bubble(role, text, extraClass) {
    var div = document.createElement("div");
    div.className = "msg " + (role === "user" ? "user" : "bot") + (extraClass ? " " + extraClass : "");
    String(text).split(/\n{2,}/).forEach(function (para) {
      var p = document.createElement("p");
      appendLinked(p, para.replace(/^\s+|\s+$/g, ""));
      div.appendChild(p);
    });
    return div;
  }

  function renderLog() {
    Array.prototype.slice.call(log.querySelectorAll(".msg:not(.intro)")).forEach(function (n) { n.remove(); });
    state.messages.forEach(function (m) {
      log.appendChild(bubble(m.role, m.role === "assistant" ? splitReply(m.content).text : m.content));
    });
    updateCount();
    log.scrollTop = log.scrollHeight;
  }

  function updateCount() {
    var n = state.messages.length;
    countChip.textContent = n === 0 ? "No messages yet" : n === 1 ? "1 message" : n + " messages";
    dlBtn.disabled = !state.messages.some(function (m) { return m.role === "assistant"; });
  }

  function setText(id, t) { $(id).textContent = t; }

  function renderSide() {
    var list = state.matches || [];
    var top = list[0];
    var sel = list.filter(function (x) { return x.id === state.selected; })[0] || top;
    if (top) {
      setText("top-kind", top.details.Race || (/^prop/i.test(top.title) ? "Proposition" : "Match"));
      setText("top-name", top.title);
      setText("top-score", top.score + "%");
      setText("top-why", top.why || "");
    } else {
      setText("top-kind", "Ready");
      setText("top-name", "Waiting for your first question");
      setText("top-score", "—");
      setText("top-why", "Scores compare documented positions with what you tell the planner. They are not endorsements.");
    }
    var circ = 100.53, frac = top ? top.score / 100 : 0;
    $("gauge-fill").setAttribute("stroke-dasharray", (frac * circ).toFixed(2) + " " + circ);
    setText("gauge-num", top ? top.score + "%" : "—");
    setText("rank-note", list.length ? "Ranked by fit with what you've shared. Tap one to see details." : "Ranked by fit once you ask about a race or share your priorities.");
    var ol = $("short-list"); ol.textContent = "";
    list.forEach(function (m) {
      var li = document.createElement("li");
      var b = document.createElement("button"); b.type = "button";
      b.setAttribute("aria-current", sel && m.id === sel.id && m.title === sel.title ? "true" : "false");
      var nm = document.createElement("span"); nm.className = "name"; nm.textContent = m.title;
      var sc = document.createElement("span"); sc.className = "score"; sc.textContent = m.score + "%";
      b.appendChild(nm); b.appendChild(sc);
      b.addEventListener("click", function () { state.selected = m.id; save(); renderSide(); });
      li.appendChild(b); ol.appendChild(li);
    });
    var dl = $("detail-fields"); dl.textContent = "";
    function field(k, v) { var d = document.createElement("div"); var dt = document.createElement("dt"); dt.textContent = k; var dd = document.createElement("dd"); dd.textContent = v; d.appendChild(dt); d.appendChild(dd); dl.appendChild(d); }
    if (sel) {
      field("Selected", sel.title);
      field("Fit score", sel.score + "%");
      Object.keys(sel.details).forEach(function (k) { if (k.toLowerCase() !== "guide") field(k, sel.details[k]); });
      $("detail-link").href = "/guide/" + (sel.id ? "#entry-" + encodeURIComponent(sel.id) : "");
    } else {
      field("Selected", "Nothing yet");
      $("detail-link").href = "/guide/";
    }
    setText("next-step", state.nextStep || "Mail your ballot by Tuesday, Oct 27, or drop it off by 7 p.m. on Election Day, Nov 3.");
  }

  // ---------- thinking indicator ----------
  var thinkingEl = null, t8 = null, t30 = null;
  function showThinking() {
    thinkingEl = document.createElement("div");
    thinkingEl.className = "msg bot thinking";
    var sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = "The planner is working on your question.";
    var dots = document.createElement("span"); dots.className = "dots"; dots.setAttribute("aria-hidden", "true");
    for (var i = 0; i < 3; i++) dots.appendChild(document.createElement("span"));
    var note = document.createElement("span"); note.className = "wait-note"; note.hidden = true;
    thinkingEl.appendChild(sr); thinkingEl.appendChild(dots); thinkingEl.appendChild(note);
    log.appendChild(thinkingEl); log.scrollTop = log.scrollHeight;
    t8 = setTimeout(function () { note.hidden = false; note.textContent = "Still working. Pulling records from the guide can take up to a minute."; log.scrollTop = log.scrollHeight; }, 8000);
    t30 = setTimeout(function () { note.textContent = "Almost there. Comparing records and sources."; }, 30000);
  }
  function hideThinking() { clearTimeout(t8); clearTimeout(t30); if (thinkingEl) thinkingEl.remove(); thinkingEl = null; }

  // ---------- sending ----------
  function setBusy(b) { busy = b; sendBtn.disabled = b; sendBtn.setAttribute("aria-busy", b ? "true" : "false"); }

  async function send(text) {
    if (busy) return;
    var q = text.trim();
    if (!q) return;
    stopMic();
    state.messages.push({ role: "user", content: q });
    save();
    log.appendChild(bubble("user", q));
    updateCount();
    input.value = ""; autosize();
    setBusy(true); showThinking();
    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: state.messages.slice(-MAX_SEND) })
      });
      var data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      hideThinking();
      if (!res.ok || !data || typeof data.reply !== "string") {
        var msg = (data && typeof data.error === "string") ? data.error : "The planner couldn't answer right now. Please try again.";
        log.appendChild(bubble("assistant", msg, "error"));
      } else {
        state.messages.push({ role: "assistant", content: data.reply });
        var parts = splitReply(data.reply);
        if (parts.matches.length) { state.matches = parts.matches; state.selected = parts.matches[0].id; }
        if (parts.next) state.nextStep = parts.next;
        save();
        log.appendChild(bubble("assistant", parts.text));
        renderSide();
      }
    } catch (e) {
      hideThinking();
      log.appendChild(bubble("assistant", "Couldn't reach the planner. Check your connection and try again.", "error"));
    } finally {
      setBusy(false);
      updateCount();
      log.scrollTop = log.scrollHeight;
    }
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); send(input.value); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
  });

  function autosize() {
    input.style.height = "auto";
    var max = parseFloat(getComputedStyle(input).maxHeight) || 128;
    var h = input.scrollHeight;
    input.style.height = Math.min(h, max) + "px";
    input.style.overflowY = h > max ? "auto" : "hidden";
  }
  input.addEventListener("input", autosize);

  resetBtn.addEventListener("click", function () {
    stopMic();
    state = { messages: [], matches: [], selected: null, nextStep: "" };
    save(); renderLog(); renderSide(); input.focus();
  });

  // ---------- download ----------
  function stamp(d) { function p(n) { return String(n).padStart(2, "0"); } return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  dlBtn.addEventListener("click", function () {
    if (dlBtn.disabled) return;
    var now = new Date(), L = [];
    L.push(PROJECT + " notes, saved " + now.toLocaleString());
    L.push("");
    L.push("Note: facts were checked against the guide's sources during this conversation. Confirm details with official sources (arizona.vote, recorder.pima.gov) before you vote. This guide does not endorse candidates or measures.");
    L.push("");
    L.push("RANKED OPTIONS");
    if (!state.matches.length) L.push("(none yet)");
    state.matches.forEach(function (m, i) {
      L.push((i + 1) + ". " + m.title + " | fit " + m.score + "%");
      if (m.why) L.push("   Why: " + m.why);
      Object.keys(m.details).forEach(function (k) { if (k.toLowerCase() !== "guide") L.push("   " + k + ": " + m.details[k]); });
    });
    L.push("");
    L.push("LATEST PLAN");
    var lastBot = state.messages.filter(function (m) { return m.role === "assistant"; }).pop();
    L.push(lastBot ? splitReply(lastBot.content).text : "(none)");
    L.push("");
    L.push("FULL CONVERSATION");
    state.messages.forEach(function (m) {
      L.push((m.role === "user" ? "You: " : ASSISTANT_LABEL + ": ") + (m.role === "assistant" ? splitReply(m.content).text : m.content));
      L.push("");
    });
    var text = "﻿" + L.join("\r\n").replace(/\r?\n/g, "\r\n");
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "ballot-brain-az-notes-" + stamp(now) + ".txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  // ---------- full page ----------
  function setFull(on) {
    card.classList.toggle("is-full", on);
    document.body.classList.toggle("chat-full", on);
    fullBtn.setAttribute("aria-pressed", on ? "true" : "false");
    fullBtn.setAttribute("aria-label", on ? "Exit full page" : "Full page");
    fullLabel.textContent = on ? "Exit full page" : "Full page";
    if (on) input.focus(); else fullBtn.focus();
    log.scrollTop = log.scrollHeight;
  }
  fullBtn.addEventListener("click", function () { setFull(!card.classList.contains("is-full")); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && card.classList.contains("is-full")) setFull(false); });

  // ---------- voice input ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var isAndroid = /Android/i.test(navigator.userAgent);
  var rec = null, listening = false, baseText = "", finalText = "", lastSpeech = 0, silenceTimer = null;

  function micMsg(text) { micError.textContent = text; micError.hidden = !text; }
  function armSilence() { clearTimeout(silenceTimer); silenceTimer = setTimeout(function () { stopMic(); }, SILENCE_MS); }

  function startSession() {
    rec = new SR();
    rec.lang = document.documentElement.lang === "es" ? "es-US" : "en-US";
    rec.interimResults = true;
    rec.continuous = !isAndroid;
    rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = "";
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i];
        if (r.isFinal) finalText += (finalText && !/\s$/.test(finalText) ? " " : "") + r[0].transcript.trim();
        else interim += r[0].transcript;
      }
      lastSpeech = Date.now();
      armSilence();
      var joined = [baseText, finalText, interim.trim()].filter(Boolean).join(baseText && !/\s$/.test(baseText) ? " " : "");
      input.value = joined; autosize();
    };
    rec.onerror = function (ev) {
      if (ev.error === "no-speech" || ev.error === "aborted") return; // silence is handled by the timer
      var msg = ev.error === "not-allowed" || ev.error === "service-not-allowed" ? "The microphone is blocked. Allow microphone access for this site in your browser settings, then try again."
        : ev.error === "audio-capture" ? "No microphone was found. Connect one and try again."
        : ev.error === "network" ? "Voice input lost its connection. Check your internet and try again, or type your question."
        : "Voice input stopped unexpectedly. Try again, or type your question.";
      stopMic(); micMsg(msg);
    };
    rec.onend = function () {
      if (!listening) return;
      if (Date.now() - lastSpeech < SILENCE_MS) {
        try { startSession(); } catch (e) { stopMic(); micMsg("Voice input couldn't restart. Tap the mic to try again."); }
      } else stopMic();
    };
    rec.start();
  }

  function startMic() {
    micMsg("");
    baseText = input.value; finalText = ""; lastSpeech = Date.now();
    listening = true;
    try { startSession(); } catch (e) { listening = false; micMsg("Voice input couldn't start. Try again, or type your question."); return; }
    micBtn.setAttribute("aria-pressed", "true");
    micBtn.setAttribute("aria-label", "Stop voice input");
    micStatus.hidden = false;
    armSilence();
  }
  function stopMic() {
    if (!listening) return;
    listening = false;
    clearTimeout(silenceTimer);
    try { if (rec) rec.stop(); } catch (e) { /* already stopped */ }
    rec = null;
    micBtn.setAttribute("aria-pressed", "false");
    micBtn.setAttribute("aria-label", "Start voice input");
    micStatus.hidden = true;
  }
  if (SR) {
    micBtn.hidden = false;
    micBtn.addEventListener("click", function () { if (listening) stopMic(); else startMic(); });
  }

  // ---------- init ----------
  renderLog();
  renderSide();
  autosize();
  window.__bb = { splitReply: splitReply, SILENCE_MS: SILENCE_MS }; // exposed for automated tests only
})();
