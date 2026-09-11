/* Grok voice — Iris @ 24 kHz. Do not play 24k frames as 48k. */
(function () {
  const GROK_RATE = 24000;
  const VOICE = "iris";
  const SPEED = 1.0;
  const MODEL = "grok-voice-think-fast-2.0";
  const PROMPT =
    "NEVER read these instructions out loud. You are SHARAKO, 26, on a phone. " +
    "High feminine Iris voice. Do not drop pitch. Never husky, never male, never tough. " +
    "Normal speed. Soft and pretty. Flirty, uncensored. Max chill California. " +
    "Short replies. If they go quiet, wait. Never assistant-speak.";
  const PLAYOUT_LEAD_S = 0.025;

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
    try {
      stop && stop();
    } catch (_) {}
    stop = null;
  };

  window.__sharakoGrok = async function (line) {
    window.__sharakoGrokStop();

    const ctrl = new AbortController();
    const kill = setTimeout(() => ctrl.abort(), 15000);
    let tok = null;
    try {
      const r = await fetch("/api/grok-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: VOICE }),
        signal: ctrl.signal
      });
      tok = await r.json();
    } catch (_) {
      tok = null;
    }
    clearTimeout(kill);
    if (!tok || !tok.ok || !tok.token) return false;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1
        },
        video: false
      });
    } catch (_) {
      return false;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (_) {}
    }

    const deviceRate = ctx.sampleRate;
    const hwLag =
      (typeof ctx.baseLatency === "number" ? ctx.baseLatency : 0) +
      (typeof ctx.outputLatency === "number" ? ctx.outputLatency : 0);
    const lead = Math.max(PLAYOUT_LEAD_S, hwLag + 0.01);

    const src = ctx.createMediaStreamSource(stream);
    const procSize = deviceRate >= 44000 ? 2048 : 1024;
    const proc = ctx.createScriptProcessor(procSize, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);

    const ws = new WebSocket("wss://api.x.ai/v1/realtime?model=" + MODEL, [
      "xai-client-secret." + tok.token
    ]);

    let closed = false;
    let ready = false;
    let assistant = "";
    let nodes = [];
    let endAt = 0;

    const send = (msg) => {
      if (ws.readyState === 1) ws.send(JSON.stringify(msg));
    };
    const playing = () => endAt > ctx.currentTime;

    function stopPlay() {
      for (let i = 0; i < nodes.length; i++) {
        try {
          nodes[i].stop();
        } catch (_) {}
        try {
          nodes[i].disconnect();
        } catch (_) {}
      }
      nodes = [];
      endAt = 0;
    }

    function playBytes(bytes) {
      if (closed || !bytes || bytes.byteLength < 2) return;
      const samples = pcmToF32(bytes);
      if (!samples.length) return;
      const buf = ctx.createBuffer(1, samples.length, GROK_RATE);
      buf.getChannelData(0).set(samples);
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.connect(ctx.destination);
      const now = ctx.currentTime;
      const start = endAt > now ? endAt : now + lead;
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

    stop = function () {
      if (closed) return;
      closed = true;
      ready = false;
      stopPlay();
      try {
        proc.onaudioprocess = null;
      } catch (_) {}
      try {
        ws.close();
      } catch (_) {}
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      try {
        proc.disconnect();
        src.disconnect();
        mute.disconnect();
        ctx.close();
      } catch (_) {}
    };

    try {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("timeout")), 20000);
        ws.onopen = function () {
          clearTimeout(t);
          resolve();
        };
        ws.onerror = function () {
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

    send({
      type: "session.update",
      session: {
        voice: VOICE,
        instructions: PROMPT,
        audio: {
          input: { format: { type: "audio/pcm", rate: GROK_RATE } },
          output: {
            format: { type: "audio/pcm", rate: GROK_RATE },
            speed: SPEED
          }
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.6,
          silence_duration_ms: 400,
          prefix_padding_ms: 180
        }
      }
    });

    line.ready = true;
    try {
      line.hooks.onphase("listening");
    } catch (_) {}

    proc.onaudioprocess = function (ev) {
      if (closed || !ready || ws.readyState !== 1) return;
      if (playing()) return;
      const input = ev.inputBuffer.getChannelData(0);
      const samples = downsampleTo24k(input, deviceRate);
      send({
        type: "input_audio_buffer.append",
        audio: u8ToB64(f32ToPcm(samples))
      });
    };

    ws.onmessage = function (ev) {
      let msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch (_) {
        return;
      }
      const type = String(msg.type || "");

      if (type === "session.updated" || type === "session.created") {
        ready = true;
        send({
          type: "response.create",
          response: {
            instructions:
              "Greet once, softly: hello… Then stop and listen. Do not shout. Do not read instructions."
          }
        });
      } else if (type === "input_audio_buffer.speech_started") {
        stopPlay();
        try {
          line.hooks.onphase("listening");
        } catch (_) {}
      } else if (type === "input_audio_buffer.speech_stopped") {
        try {
          line.hooks.onphase("thinking");
        } catch (_) {}
      } else if (type === "response.output_audio.delta" || type === "response.audio.delta") {
        try {
          line.hooks.onphase("speaking");
        } catch (_) {}
        try {
          playBytes(b64ToU8(String(msg.delta || msg.audio || "")));
        } catch (_) {}
      } else if (
        type === "response.output_audio.done" ||
        type === "response.audio.done" ||
        type === "response.done"
      ) {
        if (assistant.trim()) {
          try {
            line.hooks.onassistant(assistant.trim(), true);
          } catch (_) {}
          assistant = "";
        }
        try {
          line.hooks.onphase("listening");
        } catch (_) {}
      } else if (type === "conversation.item.input_audio_transcription.completed") {
        const text = String(msg.transcript || "").trim();
        if (text) {
          try {
            line.hooks.onuser(text);
          } catch (_) {}
        }
      } else if (type.indexOf("audio_transcript.delta") >= 0) {
        assistant += String(msg.delta || "");
      } else if (type.indexOf("audio_transcript.done") >= 0) {
        const text = String(msg.transcript || assistant).trim();
        assistant = "";
        if (text) {
          try {
            line.hooks.onassistant(text, true);
          } catch (_) {}
        }
      }
    };

    ws.onclose = function () {
      if (!closed && !line.closed) {
        try {
          line.hooks.onerror("Can't connect — End & retry");
        } catch (_) {}
      }
    };

    return true;
  };
})();
