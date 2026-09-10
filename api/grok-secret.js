/* SHARAKO — GROK EVE + OPUS + TIMESTAMP JITTER BUFFER */
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
    "Calm, sweet, natural, feminine, relaxed, conversational, warm, brief, and human. Never sound formal, robotic, corporate, or overly enthusiastic. Use natural pauses and soft reactions when appropriate.";

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
      EVE:
      Better target for softer, more natural
      conversational delivery.
    */
    const grokVoice = "eve";

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

          /*
            Keep AGC off.
            Prevent Android/browser gain riding
            from changing perceived character.
          */
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

    /*
      PIN MODEL VERSION.

      This avoids grok-voice-latest changing
      underneath SHARAKO later.
    */
    const ws =
      new WebSocket(
        "wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-2.0",
        [
          "xai-client-secret." +
          tok.token
        ]
      );

    let closed = false;
    let assistant = "";

    /*
      MIC OPUS STATE
    */
    let micTimestamp = 0;

    let micQueue =
      new Float32Array(0);

    /*
      DECODE INPUT TIMESTAMP

      Used only to keep incoming Opus
      packets ordered for WebCodecs.

      Playback itself uses decoded timing.
    */
    let decoderTimestamp = 0;

    /*
      TIMESTAMPED JITTER BUFFER
    */
    const jitterQueue = [];

    let playbackBaseCtx = null;
    let playbackBaseTs = null;
    let lastScheduledEnd = 0;

    /*
      60 ms initial cushion.

      3 x 20 ms frames.

      Small enough to keep latency low,
      large enough to smooth arrival jitter.
    */
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

    /*
      OPUS ENCODER
    */
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

    /*
      PLAYBACK SCHEDULER

      IMPORTANT:
      No pitch shifting.
      No time stretching.
      No playback speed change.
    */
    function scheduleJitterBuffer() {
      if (
        closed ||
        jitterQueue.length === 0
      ) {
        return;
      }

      /*
        Sort by decoded timestamps,
        NOT packet arrival time.
      */
      jitterQueue.sort(
        (a, b) =>
          a.timestamp -
          b.timestamp
      );

      /*
        Build initial 60 ms cushion
        before starting playback.
      */
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
          offsetSeconds;

        /*
          Never schedule in the past.

          Never overlap the previous
          decoded frame.
        */
        scheduledStart =
          Math.max(
            scheduledStart,
            ctx.currentTime + 0.005,
            lastScheduledEnd
          );

        const buffer =
          ctx.createBuffer(
            1,
            frame.samples.length,
            frame.sampleRate
          );

        buffer
          .getChannelData(0)
          .set(frame.samples);

        const node =
          ctx.createBufferSource();

        node.buffer = buffer;

        /*
          LOCK NATURAL SPEED.

          Do not modify this trying
          to make the voice higher.
        */
        node.playbackRate.value = 1.0;

        /*
          No detune.
          No pitch shift.
        */
        if (
          typeof node.detune !==
          "undefined"
        ) {
          node.detune.value = 0;
        }

        node.connect(
          ctx.destination
        );

        node.start(
          scheduledStart
        );

        lastScheduledEnd =
          scheduledStart +
          buffer.duration;
      }
    }

    /*
      OPUS DECODER
    */
    const decoder =
      new AudioDecoder({
        output(data) {
          try {
            const samples =
              new Float32Array(
                data.numberOfFrames
              );

            data.copyTo(
              samples,
              {
                planeIndex: 0,
                format: "f32-planar"
              }
            );

            /*
              IMPORTANT:

              Respect decoder's real
              sample rate and timing.

              NO SECOND RESAMPLE.
            */
            jitterQueue.push({
              timestamp:
                data.timestamp,

              duration:
                data.duration ||
                Math.round(
                  (
                    data.numberOfFrames /
                    data.sampleRate
                  ) *
                  1000000
                ),

              sampleRate:
                data.sampleRate,

              samples
            });

          } finally {
            data.close();
          }

          scheduleJitterBuffer();
        },

        error(err) {
          console.error(
            "OPUS DECODER:",
            err
          );
        }
      });

    decoder.configure({
      codec: "opus",
      sampleRate: OPUS_RATE,
      numberOfChannels: 1
    });

    /*
      EXACT 20 ms MIC FRAMES
    */
    function queueMicSamples(samples) {
      const joined =
        new Float32Array(
          micQueue.length +
          samples.length
        );

      joined.set(
        micQueue,
        0
      );

      joined.set(
        samples,
        micQueue.length
      );

      micQueue = joined;

      while (
        micQueue.length >=
        OPUS_FRAME
      ) {
        const frame =
          micQueue.slice(
            0,
            OPUS_FRAME
          );

        micQueue =
          micQueue.slice(
            OPUS_FRAME
          );

        const audioData =
          new AudioData({
            format:
              "f32-planar",

            sampleRate:
              OPUS_RATE,

            numberOfFrames:
              OPUS_FRAME,

            numberOfChannels:
              1,

            timestamp:
              micTimestamp,

            data:
              frame
          });

        encoder.encode(
          audioData
        );

        audioData.close();

        /*
          Exactly 20 ms,
          expressed in microseconds.
        */
        micTimestamp += 20000;
      }
    }

    proc.onaudioprocess = (ev) => {
      if (
        closed ||
        ws.readyState !==
        WebSocket.OPEN
      ) {
        return;
      }

      /*
        Half-duplex protection.

        Do not transmit mic while
        SHARAKO's scheduled output
        is still playing.
      */
      if (
        lastScheduledEnd >
        ctx.currentTime
      ) {
        return;
      }

      const raw =
        ev.inputBuffer
          .getChannelData(0);

      /*
        ONE resample only:

        device AudioContext rate
        -> 24 kHz Opus rate.

        If Android/WebView already
        supplies 24 kHz this is
        simply copied.
      */
      const samples =
        resample(
          raw,
          ctx.sampleRate,
          OPUS_RATE
        );

      queueMicSamples(
        samples
      );
    };

    stop = () => {
      if (closed) return;

      closed = true;

      try {
        encoder.flush();
      } catch (_) {}

      try {
        decoder.flush();
      } catch (_) {}

      try {
        encoder.close();
      } catch (_) {}

      try {
        decoder.close();
      } catch (_) {}

      try {
        ws.close();
      } catch (_) {}

      stream
        .getTracks()
        .forEach(
          (tr) => tr.stop()
        );

      try {
        proc.disconnect();
      } catch (_) {}

      try {
        src.disconnect();
      } catch (_) {}

      try {
        mute.disconnect();
      } catch (_) {}

      try {
        ctx.close();
      } catch (_) {}

      jitterQueue.length = 0;

      micQueue =
        new Float32Array(0);

      jitterStarted = false;
      playbackBaseCtx = null;
      playbackBaseTs = null;
      lastScheduledEnd = 0;
    };

    /*
      SOCKET CONNECTION WINDOW
    */
    try {
      await new Promise(
        (resolve, reject) => {

          const t =
            setTimeout(
              () =>
                reject(
                  new Error(
                    "timeout"
                  )
                ),
              20000
            );

          ws.onopen = () => {
            clearTimeout(t);
            resolve();
          };

          ws.onerror = () => {
            clearTimeout(t);

            reject(
              new Error("ws")
            );
          };
        }
      );

    } catch (_) {
      stop();

      return false;
    }

    if (line.closed) {
      stop();

      return false;
    }

    /*
      GROK SESSION
    */
    send({
      type: "session.update",

      session: {
        voice: grokVoice,

        instructions:
          PROMPT,

        audio: {
          input: {
            format: {
              type: "audio/opus"
            },

            transport: "json"
          },

          output: {
            format: {
              type: "audio/opus"
            },

            transport: "json"
          }
        },

        turn_detection: {
          type: "server_vad",

          /*
            Fairly strong threshold to avoid
            background noise triggering turns.
          */
          threshold: 0.85,

          /*
            Gives you room for human pauses
            without Grok instantly cutting in.
          */
          silence_duration_ms: 1200,

          prefix_padding_ms: 200
        }
      }
    });

    /*
      OPENING
    */
    send({
      type: "response.create",

      response: {
        instructions:
          "Say only 'Hello?' once, softly and naturally. Then stop."
      }
    });

    line.ready = true;

    line.hooks.onphase(
      "listening"
    );

    ws.onmessage = (ev) => {
      let msg;

      try {
        msg =
          JSON.parse(
            String(ev.data)
          );

      } catch (_) {
        return;
      }

      const type =
        String(
          msg.type || ""
        );

      if (
        type ===
        "input_audio_buffer.speech_started"
      ) {

        line.hooks.onphase(
          "listening"
        );

      } else if (
        type ===
        "input_audio_buffer.speech_stopped"
      ) {

        line.hooks.onphase(
          "thinking"
        );

      } else if (
        type ===
          "response.output_audio.delta" ||
        type ===
          "response.audio.delta"
      ) {

        line.hooks.onphase(
          "speaking"
        );

        try {
          const bytes =
            b64ToU8(
              String(
                msg.delta || ""
              )
            );

          const chunk =
            new EncodedAudioChunk({
              type: "key",

              /*
                Decoder ordering timestamp.

                Playback timing comes
                from decoded AudioData,
                not network arrival.
              */
              timestamp:
                decoderTimestamp,

              data:
                bytes
            });

          decoder.decode(
            chunk
          );

          decoderTimestamp +=
            20000;

        } catch (err) {
          console.error(
            "OPUS RX:",
            err
          );
        }

      } else if (
        type ===
          "response.output_audio.done" ||
        type ===
          "response.audio.done" ||
        type ===
          "response.done"
      ) {

        if (
          assistant.trim()
        ) {
          line.hooks.onassistant(
            assistant.trim(),
            true
          );

          assistant = "";
        }

        line.hooks.onphase(
          "listening"
        );

      } else if (
        type ===
        "conversation.item.input_audio_transcription.completed"
      ) {

        const text =
          String(
            msg.transcript || ""
          ).trim();

        if (text) {
          line.hooks.onuser(
            text
          );
        }

      } else if (
        type.indexOf(
          "audio_transcript.delta"
        ) >= 0
      ) {

        assistant +=
          String(
            msg.delta || ""
          );

      } else if (
        type.indexOf(
          "audio_transcript.done"
        ) >= 0
      ) {

        const text =
          String(
            msg.transcript ||
            assistant
          ).trim();

        assistant = "";

        if (text) {
          line.hooks.onassistant(
            text,
            true
          );
        }
      }
    };

    ws.onclose = () => {
      if (
        !closed &&
        !line.closed
      ) {
        line.hooks.onerror(
          "Can't connect — End & retry"
        );
      }
    };

    return true;
  };
})();
