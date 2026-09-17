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

  function svg(html) {
    var s = document.createElement("span");
    s.className = "sk-ico";
    s.innerHTML = html;
    return s;
  }

  var PHONE =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.2 3.8c.5-.5 1.3-.6 1.9-.2l1.7 1.1c.6.4.8 1.2.5 1.9l-.7 1.7c-.2.4-.1.9.2 1.2l3.7 3.7c.3.3.8.4 1.2.2l1.7-.7c.7-.3 1.5-.1 1.9.5l1.1 1.7c.4.6.3 1.4-.2 1.9l-1.1 1.1c-.6.6-1.4.9-2.2.8-2.1-.3-5.1-1.7-8-4.6-2.9-2.9-4.3-5.9-4.6-8-.1-.8.2-1.6.8-2.2l1.1-1.1Z"/></svg>';
  var MENU =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var PLUS =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  var MIC =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  var SEND =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHAT =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 4.8A2.8 2.8 0 0 1 7.8 2h8.4A2.8 2.8 0 0 1 19 4.8v7.4A2.8 2.8 0 0 1 16.2 15H11l-4.4 3.4c-.7.5-1.6 0-1.6-.9V4.8Z"/></svg>';

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
    var b = el("div", mine ? "sk-bubble sk-me" : "sk-bubble", text);
    row.appendChild(b);
    return row;
  }

  function callCard() {
    var row = el("div", "sk-row");
    var b = el("div", "sk-bubble");
    b.appendChild(el("p", "", "Want me on the line? You can always call from here."));
    var action = el("button", "sk-callnow");
    action.type = "button";
    action.setAttribute("aria-label", "Call now");
    action.appendChild(el("span", "", "Call now"));
    var go = el("span", "sk-callgo");
    go.innerHTML = PHONE;
    action.appendChild(go);
    action.onclick = jumpCall;
    b.appendChild(action);
    row.appendChild(b);
    return row;
  }

  function ensureCss() {
    if (document.getElementById("sk-chat-css")) return;
    var s = document.createElement("style");
    s.id = "sk-chat-css";
    s.textContent =
      "[data-sharako-chat]{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#faf9f7;color:#1c1b19;font-family:Jost,Avenir Next,Segoe UI,sans-serif;-webkit-font-smoothing:antialiased}" +
      "[data-sharako-chat] *{box-sizing:border-box}" +
      "[data-sharako-chat] button{cursor:pointer;font:inherit;color:inherit}" +
      ".sk-head{display:flex;align-items:center;gap:10px;padding:max(10px,env(safe-area-inset-top)) 16px 6px 16px}" +
      ".sk-round{width:44px;height:44px;border:1px solid rgba(28,27,25,.1);border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center;padding:0}" +
      ".sk-callpill{height:44px;padding:0 16px;border:1px solid rgba(28,27,25,.1);border-radius:999px;background:#fff;display:flex;align-items:center;gap:8px;font-size:14px}" +
      ".sk-ident{display:flex;flex-direction:column;align-items:center;padding:2px 16px 12px}" +
      ".sk-ident img{width:92px;height:92px;border-radius:999px;object-fit:cover;background:#eceae6;display:block}" +
      ".sk-name{margin-top:-10px;padding:3px 12px;border-radius:999px;background:#fff;font-size:13px;letter-spacing:.02em;box-shadow:0 1px 0 rgba(28,27,25,.06)}" +
      ".sk-time{margin-top:6px;font-size:12px;color:#8a8680}" +
      ".sk-list{flex:1;min-height:0;overflow:auto;padding:0 16px 8px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}" +
      ".sk-row{display:flex;justify-content:flex-start;flex-shrink:0}" +
      ".sk-mine{justify-content:flex-end}" +
      ".sk-bubble{max-width:92%;padding:14px 16px;border-radius:18px;background:#ebe9e5;color:#1c1b19;font-size:15.5px;line-height:1.5;white-space:pre-wrap}" +
      ".sk-me{background:#1c1b19;color:#faf9f7;border-radius:18px 18px 6px 18px}" +
      ".sk-bubble p{margin:0}" +
      ".sk-callnow{margin-top:12px;width:100%;min-height:48px;display:flex;align-items:center;justify-content:space-between;padding:6px 6px 6px 16px;border:1.5px dashed rgba(28,27,25,.16);border-radius:999px;background:#fff;font-size:15px;color:#1c1b19}" +
      ".sk-callgo{width:36px;height:36px;border-radius:999px;background:#1c1b19;color:#faf9f7;display:flex;align-items:center;justify-content:center;flex-shrink:0}" +
      ".sk-think{padding:4px 6px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#8a8680}" +
      ".sk-form{padding:8px 12px 4px;display:flex;align-items:flex-end;gap:6px}" +
      ".sk-plus{width:44px;height:44px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;padding:0;color:#1c1b19;flex-shrink:0}" +
      ".sk-field{flex:1;min-height:48px;display:flex;align-items:flex-end;border:1.5px dashed rgba(28,27,25,.14);border-radius:999px;background:#fff;padding:4px 6px 4px 16px}" +
      ".sk-field textarea{flex:1;resize:none;border:0;outline:none;background:transparent;font:16px/1.35 Jost,Avenir Next,system-ui,sans-serif;padding:10px 0;max-height:96px;color:#1c1b19}" +
      ".sk-field textarea::placeholder{color:#b0aba4}" +
      ".sk-mic{width:36px;height:36px;border:0;border-radius:999px;background:transparent;margin:4px 2px;display:flex;align-items:center;justify-content:center;padding:0;color:#1c1b19;flex-shrink:0}" +
      ".sk-send{width:36px;height:36px;border:0;border-radius:999px;background:#1c1b19;color:#faf9f7;margin:4px 2px;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}" +
      ".sk-send:disabled{opacity:.35}" +
      ".sk-tabs{display:flex;justify-content:space-around;align-items:center;padding:8px 48px max(12px,env(safe-area-inset-bottom))}" +
      ".sk-tab{border:0;background:transparent;width:48px;height:44px;display:flex;align-items:center;justify-content:center;color:#c4bfb8;padding:0}" +
      ".sk-tab.on{color:#1c1b19}" +
      ".sk-ico{display:flex;align-items:center;justify-content:center}";
    document.head.appendChild(s);
  }

  function openChat() {
    if (document.querySelector("[data-sharako-chat]")) return;
    ensureCss();
    var wrap = el("div", "");
    wrap.setAttribute("data-sharako-chat", "1");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", "Text chat");

    var head = el("div", "sk-head");
    var menu = el("button", "sk-round");
    menu.type = "button";
    menu.setAttribute("aria-label", "Back");
    menu.appendChild(svg(MENU));
    menu.onclick = close;
    var callBtn = el("button", "sk-callpill");
    callBtn.type = "button";
    callBtn.setAttribute("aria-label", "Call");
    callBtn.appendChild(svg(PHONE));
    callBtn.appendChild(document.createTextNode("Call"));
    callBtn.onclick = jumpCall;
    head.append(menu, callBtn);

    var ident = el("div", "sk-ident");
    var img = document.createElement("img");
    img.src = "/sharako-avatar.jpg?v=3";
    img.alt = "";
    img.width = 92;
    img.height = 92;
    ident.appendChild(img);
    ident.appendChild(el("div", "sk-name", "SHARAKO"));
    ident.appendChild(
      el(
        "div",
        "sk-time",
        new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      )
    );

    var list = el("div", "sk-list");
    list.appendChild(
      bubble("Hey — I’m SHARAKO, your quiet companion.\nText here whenever. Call when you want my voice.", false)
    );
    list.appendChild(
      bubble(
        "A bit about how I work:\n\n• Call is the real phone line. Stay in the app.\n• See is during the call — snap as many as you want while we’re talking.\n• The more we talk, the more I’ll remember.",
        false
      )
    );
    list.appendChild(callCard());
    history.forEach(function (m) {
      list.appendChild(bubble(m.text, m.role === "user"));
    });

    var form = el("form", "sk-form");
    var file = document.createElement("input");
    file.type = "file";
    file.accept = "image/*";
    file.hidden = true;
    var plus = el("button", "sk-plus");
    plus.type = "button";
    plus.setAttribute("aria-label", "Attach");
    plus.appendChild(svg(PLUS));
    plus.onclick = function () {
      file.click();
    };
    file.onchange = function () {
      file.value = "";
      send("I’m sending you a photo from here.");
    };
    var field = el("div", "sk-field");
    var input = document.createElement("textarea");
    input.rows = 1;
    input.placeholder = "Message";
    var action = el("button", "sk-mic");
    action.type = "button";
    action.setAttribute("aria-label", "Call");
    action.appendChild(svg(MIC));
    action.onclick = function (e) {
      e.preventDefault();
      if (input.value.trim()) send();
      else jumpCall();
    };
    field.append(input, action);
    form.append(file, plus, field);

    function syncAction() {
      var has = !!input.value.trim();
      action.className = has ? "sk-send" : "sk-mic";
      action.setAttribute("aria-label", has ? "Send" : "Call");
      action.innerHTML = has ? SEND : MIC;
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
      think = el("div", "sk-think", "Thinking");
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

    var tabs = el("nav", "sk-tabs");
    tabs.setAttribute("aria-label", "Chat shortcuts");
    var chatTab = el("span", "sk-tab on");
    chatTab.appendChild(svg(CHAT));
    var callTab = el("button", "sk-tab");
    callTab.type = "button";
    callTab.setAttribute("aria-label", "Call");
    callTab.appendChild(svg(PHONE));
    callTab.onclick = jumpCall;
    tabs.append(chatTab, callTab);

    wrap.append(head, ident, list, form, tabs);
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
