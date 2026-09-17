/**
 * Minimal OpenAI Realtime WebRTC client for static Muse home.
 * Mirrors main-web/src/lib/realtime.ts startWebRtcBody — no SPA bundle.
 * Session: window.__SHARAKO_SESSION_URL (must stay openai-realtime-test.onrender.com/session)
 */
(function () {
  "use strict";

  var SESSION =
    (typeof window !== "undefined" && window.__SHARAKO_SESSION_URL) ||
    "https://openai-realtime-test.onrender.com/session";
  var VOICE = "marin";

  var tap = document.getElementById("tap");
  var errEl = document.getElementById("err");
  var callUi = document.getElementById("call-ui");
  var statusEl = document.getElementById("call-status");
  var hintEl = document.getElementById("call-hint");
  var hangBtn = document.getElementById("hang");
  var toastEl = document.getElementById("toast");
  var home = document.getElementById("home");

  var pc = null;
  var dc = null;
  var localStream = null;
  var remoteAudio = null;
  var callGen = 0;
  var ready = false;
  var greetingSent = false;
  var connecting = false;

  function showErr(m) {
    if (!errEl) return;
    errEl.style.display = "block";
    errEl.textContent = m;
  }
  function clearErr() {
    if (!errEl) return;
    errEl.style.display = "none";
    errEl.textContent = "";
  }
  function setStatus(s, hint) {
    if (statusEl) statusEl.textContent = s;
    if (hintEl && hint != null) hintEl.textContent = hint;
  }
  function toast(m) {
    if (!toastEl) return;
    toastEl.textContent = m;
    toastEl.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      toastEl.style.display = "none";
    }, 2800);
  }

  function withTimeout(p, ms, label) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () {
        reject(new Error(label));
      }, ms);
      p.then(
        function (v) {
          clearTimeout(t);
          resolve(v);
        },
        function (e) {
          clearTimeout(t);
          reject(e);
        }
      );
    });
  }

  function ensureRemoteAudio() {
    if (remoteAudio) return remoteAudio;
    var el = document.getElementById("sharako-remote-audio");
    if (!el) {
      el = document.createElement("audio");
      el.id = "sharako-remote-audio";
      el.autoplay = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("autoplay", "");
      el.style.cssText =
        "position:fixed;width:1px;height:1px;max-width:1px;max-height:1px;opacity:0;pointer-events:none;left:0;bottom:0;z-index:-1";
      document.body.appendChild(el);
    }
    el.volume = 1;
    remoteAudio = el;
    return el;
  }

  function safeDcSend(obj) {
    if (!dc || dc.readyState !== "open") return false;
    try {
      dc.send(JSON.stringify(obj));
      return true;
    } catch (e) {
      return false;
    }
  }

  function sendGreetingOnce() {
    if (greetingSent) return;
    greetingSent = true;
    // Same as realtime.ts Tap path: use /session instructions only
    safeDcSend({ type: "response.create" });
  }

  function setMicEnabled(on) {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(function (t) {
      try {
        t.enabled = on;
      } catch (e) {}
    });
  }

  function cleanup() {
    ready = false;
    greetingSent = false;
    try {
      if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
      }
    } catch (e) {}
    if (localStream) {
      try {
        localStream.getTracks().forEach(function (t) {
          t.stop();
        });
      } catch (e) {}
      localStream = null;
    }
    if (dc) {
      try {
        dc.onmessage = null;
        dc.onopen = null;
        dc.onclose = null;
        dc.onerror = null;
        dc.close();
      } catch (e) {}
      dc = null;
    }
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.close();
      } catch (e) {}
      pc = null;
    }
  }

  function showHome() {
    if (callUi) callUi.classList.remove("on");
    if (home) home.style.display = "";
    if (tap) {
      tap.disabled = false;
      tap.textContent = "Tap to call";
    }
    connecting = false;
  }

  function showCallUi() {
    if (home) home.style.display = "none";
    if (callUi) callUi.classList.add("on");
  }

  function hangup() {
    callGen += 1;
    cleanup();
    showHome();
    setStatus("Ended", "");
  }

  function handleOaiEvent(raw) {
    var msg;
    try {
      msg = JSON.parse(String(raw));
    } catch (e) {
      return;
    }
    var t = String(msg.type || "");
    if (t === "session.created" || t === "session.updated") {
      ready = true;
    } else if (t === "input_audio_buffer.speech_started") {
      setStatus("Listening…", "Speak — SHARAKO is on the line.");
    } else if (t === "input_audio_buffer.speech_stopped") {
      setStatus("Thinking…", "");
    } else if (
      t === "output_audio_buffer.started" ||
      t === "response.output_audio.delta" ||
      t === "response.audio.delta"
    ) {
      setStatus("Speaking…", "");
    } else if (
      t === "output_audio_buffer.stopped" ||
      t === "response.output_audio.done" ||
      t === "response.audio.done"
    ) {
      setStatus("Listening…", "Speak — SHARAKO is on the line.");
    } else if (t === "error") {
      var detail =
        (msg.error && (msg.error.message || msg.error.code)) || "server error";
      setStatus("Error", String(detail));
    }
  }

  async function startWebRtc() {
    var gen = ++callGen;
    greetingSent = false;
    ready = false;
    cleanup();
    // cleanup bumped nothing — re-set gen after cleanup? cleanup doesn't touch callGen
    // but cleanup nulls pc; we already incremented gen

    setStatus("Connecting…", "Allow the microphone if prompted.");

    var stream = await withTimeout(
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      }),
      10000,
      "mic timeout — allow microphone"
    );
    if (gen !== callGen) {
      stream.getTracks().forEach(function (t) {
        t.stop();
      });
      return;
    }
    localStream = stream;
    stream.getAudioTracks().forEach(function (t) {
      t.enabled = false;
    });

    pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onconnectionstatechange = function () {
      if (gen !== callGen || !pc) return;
      var st = pc.connectionState;
      if (st === "failed") {
        setStatus("Connection failed", "Hang up and try again.");
      } else if (st === "connected" && ready) {
        setStatus("Connected", "Speak — SHARAKO is on the line.");
      }
    };

    pc.ontrack = function (ev) {
      if (gen !== callGen) return;
      var el = ensureRemoteAudio();
      var remote = (ev.streams && ev.streams[0]) || new MediaStream([ev.track]);
      el.srcObject = remote;
      el.volume = 1;
      el.play().catch(function () {});
    };

    stream.getAudioTracks().forEach(function (track) {
      pc.addTrack(track, stream);
    });

    dc = pc.createDataChannel("oai-events");
    dc.onopen = function () {
      if (gen !== callGen) return;
      ready = true;
      setMicEnabled(true);
      sendGreetingOnce();
      setStatus("Connected", "Speak — SHARAKO is on the line.");
    };
    dc.onclose = function () {
      if (gen !== callGen) return;
      ready = false;
    };
    dc.onerror = function () {
      if (gen !== callGen) return;
      setStatus("Data channel error", "Hang up and try again.");
    };
    dc.onmessage = function (ev) {
      if (gen !== callGen) return;
      handleOaiEvent(ev.data);
    };

    var offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (gen !== callGen) return;

    if (pc.iceGatheringState !== "complete") {
      await new Promise(function (resolve) {
        var done = function () {
          pc.removeEventListener("icegatheringstatechange", onChange);
          resolve();
        };
        var onChange = function () {
          if (pc.iceGatheringState === "complete") done();
        };
        pc.addEventListener("icegatheringstatechange", onChange);
        setTimeout(done, 1500);
      });
    }
    if (gen !== callGen) return;

    var localSdp = (pc.localDescription && pc.localDescription.sdp) || offer.sdp || "";
    var sep = SESSION.indexOf("?") >= 0 ? "&" : "?";
    var url = SESSION + sep + "voice=" + encodeURIComponent(VOICE);

    setStatus("Connecting…", "Linking to SHARAKO…");

    var sdpResponse = await withTimeout(
      fetch(url, {
        method: "POST",
        body: localSdp,
        headers: {
          "Content-Type": "application/sdp",
          "X-Sharako-Voice": VOICE,
        },
      }),
      20000,
      "session timeout"
    );
    var answerText = await sdpResponse.text();
    if (gen !== callGen) return;
    if (!sdpResponse.ok) {
      var detail = answerText.slice(0, 400);
      try {
        var j = JSON.parse(answerText);
        detail = j.detail || j.error || detail;
      } catch (e) {}
      throw new Error("SESSION " + sdpResponse.status + ": " + String(detail).slice(0, 180));
    }

    await pc.setRemoteDescription({ type: "answer", sdp: answerText });

    await withTimeout(
      new Promise(function (resolve, reject) {
        if (ready || (dc && dc.readyState === "open")) {
          resolve();
          return;
        }
        if (!dc) {
          reject(new Error("no data channel"));
          return;
        }
        var onOpen = function () {
          cleanupWait();
          resolve();
        };
        var onErr = function () {
          cleanupWait();
          reject(new Error("data channel failed"));
        };
        var cleanupWait = function () {
          dc.removeEventListener("open", onOpen);
          dc.removeEventListener("error", onErr);
        };
        dc.addEventListener("open", onOpen);
        dc.addEventListener("error", onErr);
      }),
      15000,
      "connect timeout"
    );
    if (gen !== callGen) return;

    if (dc && dc.readyState === "open") {
      setMicEnabled(true);
      sendGreetingOnce();
      setStatus("Connected", "Speak — SHARAKO is on the line.");
    }
  }

  async function onTap() {
    if (connecting) return;
    connecting = true;
    clearErr();
    if (tap) {
      tap.disabled = true;
      tap.textContent = "Connecting…";
    }
    showCallUi();
    setStatus("Connecting…", "Allow the microphone if prompted.");
    try {
      await startWebRtc();
    } catch (e) {
      console.error(e);
      callGen += 1;
      cleanup();
      showHome();
      showErr(
        (e && e.message) || "Could not start call. Check connection and try again."
      );
    } finally {
      connecting = false;
      if (tap && !callUi.classList.contains("on")) {
        tap.disabled = false;
        tap.textContent = "Tap to call";
      }
    }
  }

  if (tap) tap.addEventListener("click", onTap);
  if (hangBtn) hangBtn.addEventListener("click", hangup);

  // Easy Call me / Settings — toast only (no SPA)
  var rowCall = document.getElementById("row-callme");
  var rowSet = document.getElementById("row-settings");
  if (rowCall) {
    rowCall.addEventListener("click", function (e) {
      e.preventDefault();
      toast("Call me — open the app for reminders.");
    });
  }
  if (rowSet) {
    rowSet.addEventListener("click", function (e) {
      e.preventDefault();
      toast("Settings — coming soon on web.");
    });
  }

  // Expose for debug
  window.__sharakoHangup = hangup;
})();
