/* SHARAKO — GROK ARA + OPUS + TIMESTAMP JITTER BUFFER */
(function () {
  const OPUS_RATE = 24000;
  const OPUS_FRAME = 480; // 20 ms @ 24 kHz

  let stop = null;

  function b64ToU8(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);

    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }

    return out;
  }

  function u8ToB64(bytes) {
    let s = "";

    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + 0x8000)
      );
    }

    return btoa(s);
  }

  function resample(input, from, to) {
    if (from === to) {
      return new Float32Array(input);
    }

    const ratio = from / to;
    const n = Math.max(
      1,
      Math.round(input.length / ratio)
    );

    const out = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const x = i * ratio;
      const i0 = Math.floor(x);
      const i1 = Math.min(
        i0 + 1,
        input.length - 1
      );

      const f = x - i0;

      out[i] =
        input[i0] * (1 - f) +
        input[i1] * f;
    }

    return out;
  }

  window.__sharakoGrokStop = function () {
    try {
      stop && stop();
    } catch (_) {}

    stop = null;
  };

  const PROMPT =
    "Calm and sweet.";

  window.__sharakoGrok = async function (line) {
    window.__sharakoGrokStop();

    if (
      typeof AudioEncoder === "undefined" ||
      typeof AudioDecoder === "undefined" ||
      typeof AudioData === "undefined" ||
      typeof EncodedAudioChunk === "undefined"
    ) {
      line.hooks.onerror(
        "Opus/WebCodecs not supported on this WebView"
      );

      return false;
    }

    const encoderSupport =
      await AudioEncoder.isConfigSupported({
        codec: "opus",
        sampleRate: OPUS_RATE,
        numberOfChannels: 1,
        bitrate: 32000
      });

    const decoderSupport =
      await AudioDecoder.isConfigSupported({
        codec: "opus",
        sampleRate: OPUS_RATE,
        numberOfChannels: 1
      });

    if (
      !encoderSupport.supported ||
      !decoderSupport.supported
    ) {
      line.hooks.onerror(
        "Opus codec not supported on this device"
      );

      return false;
    }

    /*
      TEST VOICE:
      ARA
    */
    const grokVoice = "ara";

    const ctrl =
      new AbortController();

    const kill =
      setTimeout(
        () => ctrl.abort(),
        15000
      );

    let tok;

    try {
      const r =
        await fetch(
          "/api/grok-secret",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              voice: grokVoice
            }),

            signal: ctrl.signal
          }
        );

      tok =
        await r.json();

    } catch (_) {
      tok = null;
    }

    clearTimeout(kill);

    if (
      !tok ||
      !tok.ok ||
      !tok.token
    ) {
      return false;
    }

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1
        },

        video: false
      });

    const Ctx =
      window.AudioContext ||
      window.webkitAudioContext;

    const ctx =
      new Ctx();

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    console.log(
      "DEVICE AUDIO RATE:",
      ctx.sampleRate
    );

    console.log(
      "GROK OPUS RATE:",
      OPUS_RATE
    );

    console.log(
      "GROK VOICE:",
      grokVoice
    );

    const src =
      ctx.createMediaStreamSource(
        stream
      );

    const proc =
      ctx.createScriptProcessor(
        4096,
        1,
        1
      );

    const mute =
      ctx.createGain();

    mute.gain.value = 0;

    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);

    const ws =
      new WebSocket(
        "wss://api.x.ai/v1/realtime?model=grok-voice-latest",
        [
          "xai-client-secret." +
          tok.token
        ]
      );

    let closed = false;
    let assistant = "";

    let micTimestamp = 0;
    let micQueue = new Float32Array(0);

    let decoderTimestamp = 0;

    const jitterQueue = [];

    let playbackBaseCtx = null;
    let playbackBaseTs = null;
    let lastScheduledEnd = 0;

    const JITTER_START_MS = 60;

    let jitterStarted = false;

    const send = (msg) => {
      if (
        ws.readyState ===
        WebSocket.OPEN
      ) {
        ws.send(
          JSON.stringify(msg)
        );
      }
    };

    const encoder =
      new AudioEncoder({
        output(chunk) {
          if (
            closed ||
            ws.readyState !==
            WebSocket.OPEN
          ) {
            return;
          }

          const bytes =
            new Uint8Array(
              chunk.byteLength
            );

          chunk.copyTo(bytes);

          send({
            type:
              "input_audio_buffer.append",

            audio:
              u8ToB64(bytes)
          });
        },

        error(err) {
          console.error(
            "OPUS ENCODER:",
            err
          );
        }
      });

    encoder.configure({
      codec: "opus",
      sampleRate: OPUS_RATE,
      numberOfChannels: 1,
      bitrate: 32000
    });

    function scheduleJitterBuffer() {
      if (
        closed ||
        jitterQueue.length === 0
      ) {
        return;
      }

      jitterQueue.sort(
        (a, b) =>
          a.timestamp -
          b.timestamp
      );

      if (!jitterStarted) {
        let bufferedUs = 0;

        for (
          let i = 0;
          i < jitterQueue.length;
          i++
        ) {
          bufferedUs +=
            jitterQueue[i].duration;
        }

        if (
          bufferedUs <
          JITTER_START_MS * 1000
        ) {
          return;
        }

        jitterStarted = true;

        playbackBaseCtx =
          ctx.currentTime + 0.03;

        playbackBaseTs =
          jitterQueue[0].timestamp;

        lastScheduledEnd =
          playbackBaseCtx;
      }

      while (
        jitterQueue.length > 0
      ) {
        const frame =
          jitterQueue.shift();

        const offsetSeconds =
          (
            frame.timestamp -
            playbackBaseTs
          ) / 1000000;

        let scheduledStart =
          playbackBaseCtx +
          offsetSeconds
