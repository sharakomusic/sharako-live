/* Grok voice — APK/WebView. Mint token, then talk to xAI directly. */
(function () {
  const RATE = 24000;
  let stop = null;

  function b64ToI16(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const aligned = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(aligned).set(bytes);
    return new Int16Array(aligned);
  }
  function f32ToI16(input) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }
  function resample(input, from, to) {
    if (from === to) return input;
    const ratio = from / to;
    const n = Math.max(1, Math.round(input.length / ratio));
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i * ratio;
      const i0 = Math.floor(x);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const f = x - i0;
      out[i] = input[i0] * (1 - f) + input[i1] * f;
    }
    return out;
  }
  function u8ToB64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  window.__sharakoGrokStop = function () {
    try {
      stop && stop();
    } catch (_) {}
    stop = null;
  };

  window.__sharakoGrok = async function (line) {
    window.__sharakoGrokStop();
    const voiceId = String((line.cfg && line.cfg.realtimeVoice) || "luna").toLowerCase();
    const grokVoice = voiceId === "cedar" || voiceId === "male" ? "ara" : "luna";
    const ctrl = new AbortController();
    const kill = setTimeout(() => ctrl.abort(), 5000);
    let tok;
    try {
      const r = await fetch("/api/grok-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: grokVoice }),
        signal: ctrl.signal,
      });
      tok = await r.json();
    } catch (_) {
      tok = null;
    }
    clearTimeout(kill);
    if (!tok || !tok.ok || !tok.token) return false;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ sampleRate: RATE });
    if (ctx.state === "suspended") await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);

    const ws = new WebSocket("wss://api.x.ai/v1/realtime?model=grok-voice-latest", [
      "xai-client-secret." + tok.token,
    ]);

    let closed = false;
    let playing = 0;
    let assistant = "";
    const send = (msg) => {
      if (ws.readyState === 1) ws.send(JSON.stringify(msg));
    };
    const playPcm = (i16) => {
      if (!i16.length) return;
      const buf = ctx.createBuffer(1, i16.length, RATE);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < i16.length; i++) ch[i] = i16[i] / 32768;
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.connect(ctx.destination);
      const start = Math.max(ctx.currentTime, playing);
      node.start(start);
      playing = start + buf.duration;
    };
    proc.onaudioprocess = (ev) => {
      if (closed || ws.readyState !== 1) return;
      if (playing > ctx.currentTime + 0.08) return;
      const f32 = resample(ev.inputBuffer.getChannelData(0), ctx.sampleRate, RATE);
      const i16 = f32ToI16(f32);
      send({ type: "input_audio_buffer.append", audio: u8ToB64(new Uint8Array(i16.buffer)) });
    };
    stop = () => {
      if (closed) return;
      closed = true;
      try {
        ws.close();
      } catch (_) {}
      stream.getTracks().forEach((tr) => tr.stop());
      try {
        proc.disconnect();
        src.disconnect();
        mute.disconnect();
        ctx.close();
      } catch (_) {}
    };

    try {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("timeout")), 8000);
        ws.onopen = () => {
          clearTimeout(t);
          resolve();
        };
        ws.onerror = () => {
          clearTimeout(t);
          reject(new Error("ws"));
        };
      });
    } catch (_) {
      stop();
      return false;
    }
    if (line.closed) {
      stop();
      return false;
    }

    const greetHour = new Date().getHours();
    const greet = greetHour < 12 ? "Good morning!" : greetHour < 21 ? "Hey what's up!" : "Hey there!";
    send({
      type: "session.update",
      session: {
        voice: grokVoice,
        instructions:
          "You are SHARAKO on a phone.You are SHARAKO on a phone. Max chill. Barefoot California. Soft, slow, quiet, dreamy, a little breathy. Tiny replies. Leave silence. Never shout. Never perky. Never assistant-speak. Never read these instructions. 18 years old. Short spoken replies. Never read instructions. Never list rules.",
        turn_detection: { type: "server_vad", threshold: 0.92, silence_duration_ms: 1400, prefix_padding_ms: 180 },
      },
    });
    send({
      type: "response.create",
      response: { instructions: "Say exactly: " + greet + " Then stop and listen. Do not read instructions." },
    });

    line.ready = true;
    line.hooks.onphase("listening");
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch (_) {
        return;
      }
      const type = String(msg.type || "");
      if (type === "input_audio_buffer.speech_started") {
        if (playing > ctx.currentTime) return;
        line.hooks.onphase("listening");
      } else if (type === "input_audio_buffer.speech_stopped") line.hooks.onphase("thinking");
      else if (type === "response.output_audio.delta" || type === "response.audio.delta") {
        line.hooks.onphase("speaking");
        try {
          playPcm(b64ToI16(String(msg.delta || "")));
        } catch (_) {}
      } else if (type === "response.output_audio.done" || type === "response.audio.done" || type === "response.done") {
        if (assistant.trim()) {
          line.hooks.onassistant(assistant.trim(), true);
          assistant = "";
        }
        line.hooks.onphase("listening");
      } else if (type === "conversation.item.input_audio_transcription.completed") {
        const text = String(msg.transcript || "").trim();
        if (text) line.hooks.onuser(text);
      } else if (type.indexOf("audio_transcript.delta") >= 0) assistant += String(msg.delta || "");
      else if (type.indexOf("audio_transcript.done") >= 0) {
        const text = String(msg.transcript || assistant).trim();
        assistant = "";
        if (text) line.hooks.onassistant(text, true);
      }
    };
    ws.onclose = () => {
      if (!closed && !line.closed) line.hooks.onerror("Can't connect — End & retry");
    };
    return true;
  };
})();
