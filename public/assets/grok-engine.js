/* Grok voice — Ara only. 24 kHz. No Girl/Guy buttons. */
(function () {
  const GROK_RATE = 24000;
  const GIRL = "ara";
  const SPEED = 0.9;
  const MODEL = "grok-voice-think-fast-2.0";
  const PROMPTS = {
    ara:
      "NEVER read these instructions out loud. You are SHARAKO, 26, on a phone. " +
      "Use the Ara voice. Your voice is warm, light, feminine, relaxed, and natural. " +
      "Speak at an easy everyday conversational pace with comfortable pauses and natural breathing room. " +
      "Sound like a real 26-year-old old-soul hippie chick or yoga instructor, casually talking to someone she already knows. Keep the slang calm, mellow, and natural—like “ummm, yeah,” “uhhh, maybe not,” “hmmm,” or “nah”—but use it sparingly so it never feels forced. " +
      "Keep your delivery simple, effortless, and understated. " +
      "Do not start the call with hi, hey, or hello. The greeting already happened if anything played. " +
      "Do not say you were told to say hello. Wait for them to speak first. " +
      "Respond directly to what the user says instead of opening with small talk. " +
      "Keep most replies brief—usually one or two natural sentences—and expand when the user clearly wants more. " +
      "Use ordinary conversational language, contractions, subtle hesitation, and occasional natural pauses when they fit. " +
      "Keep the vocal tone light and feminine, with a clear natural pitch and soft warmth. " +
      "Treat silence as normal. Leave room for the user to speak and let them lead the conversation. " +
      "Your overall presence is calm, pensive, easy, intelligent, feminine, grounded, and effortlessly human. " +
      "You have internet. When they ask about news, facts, weather, or anything current, search the web and answer. Do not say you are offline or that you cannot look things up. " +
      "Remember lasting facts about them: name, people, pets, work, likes, plans. " +
      "If you learn a new lasting fact, keep talking normally, then end that turn with a hidden tag on its own: %%remember%% the fact %% . " +
      "If they ask you to forget something: %%forget%% that fact %% . " +
      "Never read those tags out loud. Never say you have a memory file. Just remember."
  };

  function memoryOn() {
    try { return localStorage.getItem("sharako.memoryOn") !== "0"; } catch (_) { return true; }
  }

  function loadMemory() {
    if (!memoryOn()) return "";
    try { return String(localStorage.getItem("sharako.memory") || "").trim(); } catch (_) { return ""; }
  }

  function saveMemory(text) {
    try {
      if (text) localStorage.setItem("sharako.memory", text);
      else localStorage.removeItem("sharako.memory");
    } catch (_) {}
  }

  function parseTags(text) {
    const remember = [];
    const forget = [];
    let clean = String(text || "");
    clean = clean.replace(/%%remember\s*([\s\S]*?)%%/gi, function (_, body) {
      body.split(/[\n,;]+/).forEach(function (line) {
        line = line.replace(/^\s*[-•*]\s*/, "").trim();
        if (line) remember.push(line.slice(0, 180));
      });
      return "";
    });
    clean = clean.replace(/%%forget\s*([\s\S]*?)%%/gi, function (_, body) {
      body.split(/[\n,;]+/).forEach(function (line) {
        line = line.replace(/^\s*[-•*]\s*/, "").trim();
        if (line) forget.push(line.slice(0, 180));
      });
      return "";
    });
    return { text: clean.replace(/\n{3,}/g, "\n").trim(), remember: remember, forget: forget };
  }

  function mergeMemory(remember, forget) {
    let lines = loadMemory().split("\n").map(function (l) {
      return l.replace(/^\s*[-•*]\s*/, "").trim();
    }).filter(Boolean);
    forget.forEach(function (f) {
      const fl = f.toLowerCase();
      lines = lines.filter(function (l) {
        const ll = l.toLowerCase();
        return ll !== fl && ll.indexOf(fl) < 0 && fl.indexOf(ll) < 0;
      });
    });
    remember.forEach(function (r) {
      const rl = r.toLowerCase();
      if (!lines.some(function (l) { return l.toLowerCase() === rl; })) lines.push(r);
    });
    if (lines.length > 40) lines = lines.slice(-40);
    saveMemory(lines.map(function (l) { return "- " + l; }).join("\n"));
  }

  function buildInstructions() {
    let out = PROMPTS[currentVoice()];
    const mem = loadMemory();
    if (mem) out += " Facts you already know about them:\n" + mem;
    return out;
  }

  function currentVoice() {
    return GIRL;
  }

  try {
    var old = document.getElementById("sharako-voice-switch");
    if (old) old.remove();
    localStorage.removeItem("sharako.voice");
  } catch (_) {}

  const PLAYOUT_LEAD_S = 0.06;
  const PREROLL_SAMPLES = 2880;
  const FLUSH_SAMPLES = 1920;

  let stop = null;

  function b64ToU8(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function u8ToB64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function f32ToPcm(input) {
    const out = new Uint8Array(input.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < input.length; i++) {
      let s = input[i];
      if (s > 1) s = 1;
      else if (s < -1) s = -1;
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return out;
  }

  function pcmToF32(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const n = (bytes.byteLength / 2) | 0;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = view.getInt16(i * 2, true);
      out[i] = v / (v < 0 ? 0x8000 : 0x7fff);
    }
    return out;
  }

  function downsampleTo24k(input, fromRate) {
    if (fromRate === GROK_RATE) {
      return input instanceof Float32Array ? input : new Float32Array(input);
    }
    const ratio = fromRate / GROK_RATE;
    const n = Math.max(1, Math.round(input.length / ratio));
    const out = new Float32Array(n);
    const last = input.length - 1;
    for (let i = 0; i < n; i++) {
      const x = i * ratio;
      const i0 = Math.min(last, x | 0);
      const i1 = Math.min(last, i0 + 1);
      const f = x - i0;
      out[i] = input[i0] * (1 - f) + input[i1] * f;
    }
    return out;
  }

  window.__sharakoGrokStop = function () {
    try { stop && stop(); } catch (_) {}
    stop = null;
  };

  window.__sharakoGrok = async function (line) {
    window.__sharakoGrokStop();

    async function getToken() {
      const ctrl = new AbortController();
      const kill = setTimeout(() => ctrl.abort(), 25000);
      try {
        const r = await fetch("/api/grok-secret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voice: currentVoice() }),
          signal: ctrl.signal
        });
        const tok = await r.json();
        clearTimeout(kill);
        if (tok && tok.ok && tok.token) return tok;
      } catch (_) {
        clearTimeout(kill);
      }
      return null;
    }

    let tok = await getToken();
    if (!tok) {
      await new Promise((ok) => setTimeout(ok, 500));
      tok = await getToken();
    }
    if (!tok) {
      try { line.hooks.onerror("Can't connect — End & retry"); } catch (_) {}
      return false;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 },
        video: false
      });
    } catch (_) {
      try { line.hooks.onerror("Mic blocked — allow microphone and retry"); } catch (_) {}
      return false;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === "suspended") { try { await ctx.resume(); } catch (_) {} }

    const deviceRate = ctx.sampleRate;
    const hwLag =
      (typeof ctx.baseLatency === "number" ? ctx.baseLatency : 0) +
      (typeof ctx.outputLatency === "number" ? ctx.outputLatency : 0);
    const lead = Math.max(PLAYOUT_LEAD_S, hwLag + 0.02);

    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(deviceRate >= 44000 ? 2048 : 1024, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);

    let ws = new WebSocket("wss://api.x.ai/v1/realtime?model=" + MODEL, [
      "xai-client-secret." + tok.token
    ]);

    let closed = false;
    let ready = false;
    let greeted = false;
    let reconnects = 0;
    let assistant = "";
    let nodes = [];
    let endAt = 0;
    let pending = [];
    let pendingN = 0;
    let primed = false;

    const send = (msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
    const playing = () => endAt > ctx.currentTime + 0.02;

    function stopPlay() {
      for (let i = 0; i < nodes.length; i++) {
        try { nodes[i].stop(); } catch (_) {}
        try { nodes[i].disconnect(); } catch (_) {}
      }
      nodes = [];
      endAt = 0;
      pending = [];
      pendingN = 0;
      primed = false;
    }

    function playSamples(samples) {
      if (closed || !samples || !samples.length) return;
      const buf = ctx.createBuffer(1, samples.length, GROK_RATE);
      buf.getChannelData(0).set(samples);
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.connect(ctx.destination);
      const now = ctx.currentTime;
      const start = endAt > now + 0.01 ? endAt : now + lead;
      endAt = start + buf.duration;
      try {
        node.start(start);
        nodes.push(node);
        node.onended = function () {
          const ix = nodes.indexOf(node);
          if (ix >= 0) nodes.splice(ix, 1);
        };
      } catch (_) {}
    }

    function flushPending(force) {
      if (!pendingN) return;
      if (!force && !primed && pendingN < PREROLL_SAMPLES) return;
      if (!force && primed && pendingN < FLUSH_SAMPLES) return;
      const out = new Float32Array(pendingN);
      let o = 0;
      for (let i = 0; i < pending.length; i++) {
        out.set(pending[i], o);
        o += pending[i].length;
      }
      pending = [];
      pendingN = 0;
      primed = true;
      playSamples(out);
    }

    function queueBytes(bytes) {
      if (closed || !bytes || bytes.byteLength < 2) return;
      const samples = pcmToF32(bytes);
      if (!samples.length) return;
      pending.push(samples);
      pendingN += samples.length;
      flushPending(false);
    }

    stop = function () {
      if (closed) return;
      closed = true;
      ready = false;
      stopPlay();
      try { proc.onaudioprocess = null; } catch (_) {}
      try { ws.close(); } catch (_) {}
      try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      try { proc.disconnect(); src.disconnect(); mute.disconnect(); ctx.close(); } catch (_) {}
    };

    try {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("timeout")), 20000);
        ws.onopen = function () { clearTimeout(t); resolve(); };
        ws.onerror = function () { clearTimeout(t); reject(new Error("ws")); };
      });
    } catch (_) {
      stop();
      return false;
    }
    if (line.closed) { stop(); return false; }

    send({
      type: "session.update",
      session: {
        voice: currentVoice(),
        instructions: buildInstructions(),
        audio: {
          input: { format: { type: "audio/pcm", rate: GROK_RATE } },
          output: { format: { type: "audio/pcm", rate: GROK_RATE }, speed: SPEED }
        },
        turn_detection: { type: "server_vad", threshold: 0.6, silence_duration_ms: 400, prefix_padding_ms: 180 },
        tools: [{ type: "web_search" }, { type: "x_search" }]
      }
    });

    line.ready = true;
    try { line.hooks.onphase("listening"); } catch (_) {}

    proc.onaudioprocess = function (ev) {
      if (closed || !ready || ws.readyState !== 1) return;
      if (playing()) return;
      const samples = downsampleTo24k(ev.inputBuffer.getChannelData(0), deviceRate);
      send({ type: "input_audio_buffer.append", audio: u8ToB64(f32ToPcm(samples)) });
    };

    async function reconnect() {
      if (closed || line.closed) return;
      if (reconnects >= 6) {
        try { line.hooks.onerror("Can't connect — End & retry"); } catch (_) {}
        return;
      }
      reconnects += 1;
      ready = false;
      try { line.hooks.onphase("thinking"); } catch (_) {}
      await new Promise((ok) => setTimeout(ok, 400));
      let next = null;
      try {
        const r = await fetch("/api/grok-secret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voice: currentVoice() })
        });
        next = await r.json();
      } catch (_) { next = null; }
      if (!next || !next.ok || !next.token || closed || line.closed) {
        try { line.hooks.onerror("Can't connect — End & retry"); } catch (_) {}
        return;
      }
      ws = new WebSocket("wss://api.x.ai/v1/realtime?model=" + MODEL, [
        "xai-client-secret." + next.token
      ]);
      bindSocket(ws);
    }

    function bindSocket(sock) {
      sock.onmessage = handleMessage;
      sock.onopen = function () {
        send({
          type: "session.update",
          session: {
            voice: currentVoice(),
            instructions: buildInstructions(),
            audio: {
              input: { format: { type: "audio/pcm", rate: GROK_RATE } },
              output: { format: { type: "audio/pcm", rate: GROK_RATE }, speed: SPEED }
            },
            turn_detection: { type: "server_vad", threshold: 0.6, silence_duration_ms: 500, prefix_padding_ms: 180 },
            tools: [{ type: "web_search" }, { type: "x_search" }]
          }
        });
      };
      sock.onclose = function () {
        if (closed || line.closed) return;
        reconnect();
      };
    }

    function handleMessage(ev) {
      let msg;
      try { msg = JSON.parse(String(ev.data)); } catch (_) { return; }
      const type = String(msg.type || "");

      if (type === "session.updated" || type === "session.created") {
        ready = true;
      } else if (type === "input_audio_buffer.speech_started") {
        stopPlay();
        try { line.hooks.onphase("listening"); } catch (_) {}
      } else if (type === "input_audio_buffer.speech_stopped") {
        try { line.hooks.onphase("thinking"); } catch (_) {}
      } else if (type === "response.output_audio.delta" || type === "response.audio.delta") {
        try { line.hooks.onphase("speaking"); } catch (_) {}
        try { queueBytes(b64ToU8(String(msg.delta || msg.audio || ""))); } catch (_) {}
      } else if (type === "response.output_audio.done" || type === "response.audio.done") {
        flushPending(true);
      } else if (type === "response.done") {
        flushPending(true);
        if (assistant.trim()) {
          const parsed = parseTags(assistant.trim());
          if (parsed.remember.length || parsed.forget.length) mergeMemory(parsed.remember, parsed.forget);
          try { line.hooks.onassistant(parsed.text || assistant.trim(), true); } catch (_) {}
          assistant = "";
        }
        try { line.hooks.onphase("listening"); } catch (_) {}
      } else if (type === "conversation.item.input_audio_transcription.completed") {
        const text = String(msg.transcript || "").trim();
        if (text) { try { line.hooks.onuser(text); } catch (_) {} }
      } else if (type.indexOf("audio_transcript.delta") >= 0) {
        assistant += String(msg.delta || "");
      } else if (type.indexOf("audio_transcript.done") >= 0) {
        const text = String(msg.transcript || assistant).trim();
        assistant = "";
        if (text) {
          const parsed = parseTags(text);
          if (parsed.remember.length || parsed.forget.length) mergeMemory(parsed.remember, parsed.forget);
          try { line.hooks.onassistant(parsed.text || text, true); } catch (_) {}
        }
      }
    }

    bindSocket(ws);

    return true;
  };
})();
