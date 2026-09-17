(function () {
  if (window.__sharakoChatUi) return;
  window.__sharakoChatUi = 1;

  var STORE = "sharako.overlayChat";
  var history = load();
  var busy = false;

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(-40) : [];
    } catch (e) {
      return [];
    }
  }
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(history.slice(-40)));
    } catch (e) {}
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function jumpCall() {
    close();
    window.setTimeout(function () {
      if (typeof window.__sharakoStartLine === "function") {
        window.__sharakoStartLine();
        return;
      }
      var b = Array.prototype.find.call(document.querySelectorAll("button"), function (x) {
        return (x.getAttribute("aria-label") || "").trim() === "Call";
      });
      if (b) b.click();
    }, 40);
  }

  function close() {
    var w = document.querySelector("[data-sharako-chat]");
    if (w) w.remove();
  }

  function bubble(text, mine) {
    var row = el("div", mine ? "sk-row sk-mine" : "sk-row");
    if (mine) {
      var b = el("div", "sk-me", text);
      row.appendChild(b);
    } else {
      row.appendChild(el("p", "sk-her", text));
    }
    return row;
  }

  function ensureCss() {
    if (document.getElementById("sk-chat-css")) return;
    var s = document.createElement("style");
    s.id = "sk-chat-css";
    s.textContent =
      "[data-sharako-chat]{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:rgba(11,11,11,.92);color:#f5f5f3;font-family:Jost,Avenir Next,Segoe UI,sans-serif;-webkit-font-smoothing:antialiased;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}" +
      "[data-sharako-chat] *{box-sizing:border-box}" +
      "[data-sharako-chat] button{cursor:pointer;font:inherit;color:inherit;background:none;border:0}" +
      ".sk-head{display:flex;align-items:center;gap:12px;padding:max(12px,env(safe-area-inset-top)) 16px 12px;border-bottom:1px solid rgba(245,245,243,.14)}" +
      ".sk-close{height:44px;padding:0 4px;letter-spacing:.22em;font-size:.72rem;text-transform:uppercase;color:#8a8a84}" +
      ".sk-mark{font-family:Cormorant Garamond,Iowan Old Style,Georgia,serif;font-weight:300;letter-spacing:.2em;font-size:1.15rem;color:#f5f5f3}" +
      ".sk-call{margin-left:auto;height:44px;min-width:96px;padding:0 20px;border-radius:999px;background:#f5f5f3;color:#0b0b0b;letter-spacing:.2em;font-size:.62rem;text-transform:uppercase}" +
      ".sk-list{flex:1;min-height:0;overflow:auto;padding:32px 20px 12px;display:flex;flex-direction:column;gap:22px;-webkit-overflow-scrolling:touch}" +
      ".sk-time{letter-spacing:.18em;font-size:.68rem;text-transform:uppercase;color:#8a8a84}" +
      ".sk-hello{max-width:20rem;font-family:Cormorant Garamond,Iowan Old Style,Georgia,serif;font-weight:300;font-size:1.45rem;line-height:1.25;letter-spacing:.04em;color:#f5f5f3;white-space:pre-wrap}" +
      ".sk-row{display:flex;justify-content:flex-start;flex-shrink:0}" +
      ".sk-mine{justify-content:flex-end}" +
      ".sk-her{max-width:90%;margin:0;font-size:1.02rem;line-height:1.55;color:rgba(245,245,243,.92);white-space:pre-wrap}" +
      ".sk-me{max-width:86%;padding:10px 20px;border-radius:999px;background:#f5f5f3;color:#0b0b0b;font-size:.92rem;line-height:1.35;white-space:pre-wrap}" +
      ".sk-think{letter-spacing:.22em;font-size:.62rem;text-transform:uppercase;color:#8a8a84}" +
      ".sk-form{padding:12px 16px max(16px,env(safe-area-inset-bottom));display:flex;align-items:flex-end;gap:8px;border-top:1px solid rgba(245,245,243,.14)}" +
      ".sk-photo{height:44px;padding:0 4px;letter-spacing:.18em;font-size:.58rem;text-transform:uppercase;color:#8a8a84;flex-shrink:0}" +
      ".sk-field{flex:1;min-height:48px;display:flex;align-items:flex-end;border-radius:999px;background:#1a1a1a;padding:4px 8px 4px 18px;box-shadow:0 0 0 1px rgba(245,245,243,.14)}" +
      ".sk-field textarea{flex:1;resize:none;border:0;outline:none;background:transparent;font:16px/1.35 Jost,Avenir Next,system-ui,sans-serif;padding:10px 0;max-height:96px;color:#f5f5f3}" +
      ".sk-field textarea::placeholder{color:#6a6a66}" +
      ".sk-send{width:36px;height:36px;border:0;border-radius:999px;background:#f5f5f3;color:#0b0b0b;margin:4px 2px;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}" +
      ".sk-send:disabled{opacity:.35}" +
      ".sk-ghost{height:36px;margin:4px 6px;letter-spacing:.16em;font-size:.58rem;text-transform:uppercase;color:#8a8a84;flex-shrink:0}";
    document.head.appendChild(s);
  }

  function openChat() {
    if (document.querySelector("[data-sharako-chat]")) return;
    ensureCss();
    var wrap = el("div", "");
    wrap.setAttribute("data-sharako-chat", "1");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", "Text");

    var head = el("div", "sk-head");
    var back = el("button", "sk-close", "Close");
    back.type = "button";
    back.setAttribute("aria-label", "Close");
    back.onclick = close;
    var callBtn = el("button", "sk-call", "Call");
    callBtn.type = "button";
    callBtn.setAttribute("aria-label", "Call");
    callBtn.onclick = jumpCall;
    head.append(back, callBtn);

    var list = el("div", "sk-list");
    list.appendChild(
      el(
        "p",
        "sk-time",
        new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      )
    );
    list.appendChild(el("p", "sk-hello", "hey…\nwrite if you want. i'm here."));
    history.forEach(function (m) {
      list.appendChild(bubble(m.text, m.role === "user"));
    });

    var form = el("form", "sk-form");
    var file = document.createElement("input");
    file.type = "file";
    file.accept = "image/*";
    file.hidden = true;
    var plus = el("button", "sk-photo", "Photo");
    plus.type = "button";
    plus.setAttribute("aria-label", "Photo");
    plus.onclick = function () {
      file.click();
    };
    file.onchange = function () {
      file.value = "";
      send("I'm sending you a photo from here. Look with me.");
    };
    var field = el("div", "sk-field");
    var input = document.createElement("textarea");
    input.rows = 1;
    input.placeholder = "write";
    var action = el("button", "sk-ghost", "Call");
    action.type = "button";
    action.setAttribute("aria-label", "Call");
    action.onclick = function (e) {
      e.preventDefault();
      if (input.value.trim()) send();
      else jumpCall();
    };
    field.append(input, action);
    form.append(file, plus, field);

    function syncAction() {
      var has = !!input.value.trim();
      action.className = has ? "sk-send" : "sk-ghost";
      action.setAttribute("aria-label", has ? "Send" : "Call");
      action.textContent = has ? "" : "Call";
      action.innerHTML = has
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : "Call";
      action.type = has ? "submit" : "button";
    }
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 96) + "px";
      syncAction();
    });

    form.onsubmit = function (e) {
      e.preventDefault();
      send();
    };
    input.onkeydown = function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    };

    var think = null;
    function send(preset) {
      var text = (preset || input.value).trim();
      if (!text || busy) return;
      input.value = "";
      input.style.height = "auto";
      syncAction();
      history.push({ role: "user", text: text });
      save();
      list.appendChild(bubble(text, true));
      think = el("div", "sk-think", "…");
      list.appendChild(think);
      list.scrollTop = list.scrollHeight;
      busy = true;
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          var reply = (d && d.ok && d.text) || (d && d.error) || "Can't connect — try again.";
          history.push({ role: "assistant", text: reply });
          save();
          if (think && think.parentNode) think.remove();
          list.appendChild(bubble(reply, false));
          list.scrollTop = list.scrollHeight;
        })
        .catch(function () {
          if (think && think.parentNode) think.remove();
          list.appendChild(bubble("Can't connect — try again.", false));
        })
        .then(function () {
          busy = false;
          think = null;
        });
    }

    wrap.append(head, list, form);
    document.body.appendChild(wrap);
    list.scrollTop = list.scrollHeight;
    window.setTimeout(function () {
      input.focus();
    }, 50);
  }

  function isTextBtn(node) {
    if (!node || !node.getAttribute) return false;
    var aria = (node.getAttribute("aria-label") || "").trim();
    if (aria === "Text") return true;
    var vis = node.querySelector && node.querySelector("span.absolute");
    if (vis && (vis.textContent || "").trim() === "Text") return true;
    return false;
  }

  document.addEventListener(
    "click",
    function (e) {
      var t = e.target && e.target.closest && e.target.closest("button, a");
      if (!t || !isTextBtn(t)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      openChat();
    },
    true
  );

  window.__sharakoOpenChat = openChat;
})();
