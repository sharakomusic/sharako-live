/* SHARAKO — GROK ARA + PCM16 + SIMPLE PLAYOUT QUEUE
   Drop-in replacement for the Opus/WebCodecs client.
   Same hooks: window.__sharakoGrok(line), window.__sharakoGrokStop()
*/
(function () {
  const SUPPORTED_RATES = [8000, 16000, 22050, 24000, 32000, 44100, 48000];
  const PLAYOUT_LEAD_S = 0.08;
  const VOICE = "ara";
  const PROMPT = "Calm and sweet. Speak naturally, like a real person. Keep answers short.";

  let stop = null;

  function nearestRate(hz) {
    let best = SUPPORTED_RATES[0];
    let bestD = Math.abs(hz - best);
    for (let i = 1; i < SUPPORTED_RATES.length; i++) {
      const d = Math.abs(hz - SUPPORTED_RATES[i]);
      if (d < bestD) {
        best = SUPPORTED_RATES[i];
        bestD = d;
      }
    }
    return best;
  }

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

  function floatToPcm16Bytes(input) {
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

  function pcm16BytesToFloat(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const n = (bytes.byteLength / 2) | 0;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = view.getInt16(i * 2, true);
      out[i] = v / (v < 0 ? 0x8000 : 0x7fff);
    }
    return out;
  }

  function resampleLinear(input, from, to) {
    if (from === to) return input instanceof Float32Array ? input : new Float32Array(input);
    const ratio = from / to;
    const n = Math.max(1, Math.round(input.length / ratio));
    const out = new Float32Array(n);
    const last = input.length - 1;
    for (let i = 0; i < n; i++) {
      const x = i * ratio;
      const i0 = Math.min(last, Math.floor(x));
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

    const hook = (name, arg) => {
      try {
        line && line.hooks && typeof line.hooks[name] === "function" && line.hooks[name](arg);
      } catch (_) {}
    };

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

    if (!tok || !tok.ok || !tok.token) {
      hook("onerror", "Failed to get Grok voice token");
      return false;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      });
    } catch (err) {
      hook("onerror", "Mic permission failed");
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
    const grokRate = nearestRate(deviceRate);

    console.log("DEVICE AUDIO RATE:", deviceRate);
    console.log("GROK PCM RATE:", grokRate);
    console.log("GROK VOICE:", VOICE);

    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);

    const ws = new WebSocket("wss://api.x.ai/v1/realtime?model=grok-voice-latest", [
      "xai-client-secret." + tok.token
    ]);

    let closed = false;
    let sessionReady = false;
    let assistant = "";
    let playing = [];
    let lastScheduledEnd = 0;

    const send = (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };

    function stopPlayback() {
      for (let i = 0; i < playing.length; i++) {
        try {
          playing[i].stop();
        } catch (_) {}
        try {
          playing[i].disconnect();
        } catch (_) {}
      }
      playing = [];
      lastScheduledEnd = 0;
    }

    function playPcm16(bytes) {
      if (closed || !bytes || bytes.byteLength < 2) return;

      let samples = pcm16BytesToFloat(bytes);
      if (grokRate !== deviceRate) samples = resampleLinear(samples, grokRate, deviceRate);
      if (!samples.length) return;

      const buf = ctx.createBuffer(1, samples.length, deviceRate);
      buf.getChannelData(0).set(samples);

      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.connect(ctx.destination);

      const now = ctx.currentTime;
      if (lastScheduledEnd < now + PLAYOUT_LEAD_S) lastScheduledEnd = now + PLAYOUT_LEAD_S;
      const startAt = lastScheduledEnd;
      lastScheduledEnd += buf.duration;

      try {
        node.start(startAt);
        playing.push(node);
        node.onended = function () {
          const ix = playing.indexOf(node);
          if (ix >= 0) playing.splice(ix, 1);
        };
      } catch (err) {
        console.error("PLAY:", err);
      }
    }

    function teardown() {
      if (closed) return;
      closed = true;
      sessionReady = false;
      stopPlayback();
      try {
        proc.onaudioprocess = null;
      } catch (_) {}
      try {
        src.disconnect();
      } catch (_) {}
      try {
        proc.disconnect();
      } catch (_) {}
      try {
        mute.disconnect();
      } catch (_) {}
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      try {
        ws.close();
      } catch (_) {}
      try {
        ctx.close();
      } catch (_) {}
    }

    stop = teardown;

    proc.onaudioprocess = function (ev) {
      if (closed || !sessionReady || ws.readyState !== WebSocket.OPEN) return;
      const input = ev.inputBuffer.getChannelData(0);
      let samples = input;
      if (deviceRate !== grokRate) samples = resampleLinear(input, deviceRate, grokRate);
      send({
        type: "input_audio_buffer.append",
        audio: u8ToB64(floatToPcm16Bytes(samples))
      });
    };

    ws.onopen = function () {
      send({
        type: "session.update",
        session: {
          voice: VOICE,
          instructions: PROMPT,
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          },
          audio: {
            input: { format: { type: "audio/pcm", rate: grokRate } },
            output: { format: { type: "audio/pcm", rate: grokRate } }
          }
        }
      });
    };

    ws.onmessage = function (ev) {
      if (closed) return;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (_) {
        return;
      }

      const type = msg && msg.type;

      if (type === "session.updated" || type === "session.created") {
        sessionReady = true;
        hook("onstatus", "ready");
        return;
      }

      if (type === "error") {
        console.error("GROK:", msg);
        hook("onerror", (msg.error && (msg.error.message || msg.error.code)) || "Grok session error");
        return;
      }

      if (type === "input_audio_buffer.speech_started") {
        stopPlayback();
        hook("onstatus", "listening");
        return;
      }

      if (type === "response.created") {
        assistant = "";
        hook("onstatus", "speaking");
        return;
      }

      if (type === "response.output_audio.delta" || type === "response.audio.delta") {
        const b64 = msg.delta || msg.audio;
        if (b64) playPcm16(b64ToU8(b64));
        return;
      }

      if (
        type === "response.output_audio_transcript.delta" ||
        type === "response.audio_transcript.delta"
      ) {
        assistant += msg.delta || "";
        hook("ontranscript", assistant);
        return;
      }

      if (type === "response.done") {
        hook("onassistant", assistant);
        hook("onstatus", "idle");
      }
    };

    ws.onerror = function () {
      hook("onerror", "WebSocket error");
    };

    ws.onclose = function () {
      teardown();
    };

    return true;
  };
})();
