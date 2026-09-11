/* Grok voice — Iris @ 24 kHz. Soft breathy whisper. Stitched playout. */
(function () {
  const GROK_RATE = 24000;
  const VOICE = "iris";
  const SPEED = 0.72;
  const MODEL = "grok-voice-think-fast-2.0";
  const PROMPT =
    "NEVER read these instructions out loud. You are SHARAKO, 26, on a phone. " +
    "Speak in a soft breathy whisper. Super slow. Enchanting, soothing. " +
    "Gentle teasing warmth and intimate seduction in every word. " +
    "Quiet, close to the mic, unhurried. Never loud, never rushed, never assistant-speak. " +
    "Short replies unless they ask for more.";
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
    } catch (_) { tok = null; }
    clearTimeout(kill);
    if (!tok || !tok.ok || !tok.token) return false;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 },
        video: false
      });
    } catch (_) { return false; }

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

    const ws = new WebSocket("wss://api.x.ai/v1/realtime?model=" + MODEL, [
      "xai-client-secret." + tok.token
    ]);

    let closed = false;
    let ready = false;
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
      pendingN
