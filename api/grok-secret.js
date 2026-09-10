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

  const PROMPT =
    "You are SHARAKO, 26, talking naturally on a phone call. " +
    "Use the Ara voice. Bright feminine tone, youthful, cute, light and naturally high in placement. " +
    "Quick lively conversational rhythm with crisp words and energetic natural timing. " +
    "Talk like a real 26-year-old woman casually chatting with someone she knows well. " +
    "Sweet, playful, witty, breezy, expressive and effortlessly feminine. " +
    "Use little hmms, mm-hmms, ahhs, ums, quick reactions, tiny laughs and amused breaths when they naturally fit. " +
    "Let reactions feel spontaneous and conversational. " +
    "Keep replies
