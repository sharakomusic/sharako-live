(function () {
  if (window.__sharakoChatUi) return;
  window.__sharakoChatUi = 1;

  var history = [];

  function el(tag, style, text) {
    var n = document.createElement(tag);
    if (style) n.style.cssText = style;
    if (text != null) n.textContent = text;
    return n;
  }

  function jumpCall() {
    close();
    if (typeof window.__sharakoStartLine === "function") {
      window.__sharakoStartLine();
      return;
    }
    var b = Array.prototype.find.call(document.querySelectorAll("button"), function (x) {
      return (x.getAttribute("aria-label") || "").trim() === "Call";
    });
    if (b) b.click();
  }

  function close() {
    var w = document.querySelector("[data-sharako-chat]");
    if (w) w.remove();
  }

  function bubble(text, mine) {
    var row = el("div", mine ? "display:flex;justify-content:flex-end" : "display:flex;justify-content:flex-start");
    var b = el(
      "div",
      mine
        ? "max-width:92%;padding:12px 16px;border-radius:18px 18px 6px 18px;background:#1c1b19;color:#f6f4f0;font:15px/1.45 Jost,system-ui,sans-serif;white-space:pre-wrap"
        : "max-width:92%;padding:12px 16px;border-radius:18px;background:#eceae6;color:#1c1b19;font:15px/1.45 Jost,system-ui,sans-serif;white-space:pre-wrap",
      text
    );
    row.appendChild(b);
    return row;
  }

  function openChat() {
    if (document.querySelector("[data-sharako-chat]")) return;
    var wrap = el(
      "div",
      "position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#f6f4f0;color:#1c1b19"
    );
    wrap.setAttribute("data-sharako-chat", "1");

    var head = el(
      "div",
      "display:flex;align-items:center;justify-content:space-between;padding:max(8px,env(safe-area-inset-top)) 12px 4px"
    );
    var menu = el("button", "width:44px;height:44px;border:1px solid rgba(28,27,25,.1);border-radius:999px;background:#fff;font-size:18px", "");
    menu.type = "button";
    menu.setAttribute("aria-label", "Back");
    menu.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    menu.onclick = close;
    var callBtn = el(
      "button",
      "height:44px;padding:0 16px;border:1px solid rgba(28,27,25,.1);border-radius:999px;background:#fff;display:flex;align-items:center;gap:8px;font:13px Jost,system-ui,sans-serif"
    );
    callBtn.type = "button";
    callBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.2 3.8c.5-.5 1.3-.6 1.9-.2l1.7 1.1c.6.4.8 1.2.5 1.9l-.7 1.7c-.2.4-.1.9.2 1.2l3.7 3.7c.3.3.8.4 1.2.2l1.7-.7c.7-.3 1.5-.1 1.9.5l1.1 1.7c.4.6.3 1.4-.2 1.9l-1.1 1.1c-.6.6-1.4.9-2.2.8-2.1-.3-5.1-1.7-8-4.6-2.9-2.9-4.3-5.9-4.6-8-.1-.8.2-1.6.8-2.2l1.1-1.1Z"/></svg> Call';
    callBtn.onclick = jumpCall;
    head.append(menu, callBtn);

    var ident = el("div", "display:flex;flex-direction:column;align-items:center;padding:4px 16px 10px");
    var img = document.createElement("img");
    img.src = "/sharako-avatar.jpg";
    img.alt = "";
    img.width = 88;
    img.height = 88;
    img.style.cssText = "width:88px;height:88px;border-radius:999px;object-fit:cover;background:#eceae6";
    var name = el(
      "div",
      "margin-top:-8px;padding:2px 12px;border-radius:999px;background:#fff;font:13px Jost,system-ui,sans-serif;box-shadow:0 1px 0 rgba(28,27,25,.06)",
      "SHARAKO"
    );
    var time = el(
      "div",
      "margin-top:4px;font:12px Jost,system-ui,sans-serif;color:#8a8680",
      new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    );
    ident.append(img, name, time);

    var list = el("div", "flex:1;min-height:0;overflow:auto;padding:0 16px 8px;display:flex;flex-direction:column;gap:10px");
    list.appendChild(
      bubble("Hey — I’m SHARAKO. Text here, or tap Call when you want me on the line.", false)
    );
    list.appendChild(
      bubble(
        "A bit about how I work:\n\n• Call is the real phone line. Stay in the app.\n• See is during the call — snap while we’re talking.\n• The more we talk, the more I’ll remember.",
        false
      )
    );
    history.forEach(function (m) {
      list.appendChild(bubble(m.text, m.role === "user"));
    });

    var form = el("form", "padding:8px 12px max(8px,env(safe-area-inset-bottom));display:flex;align-items:flex-end;gap:8px");
    var plus = el("button", "width:44px;height:44px;border:0;background:transparent;font-size:26px;line-height:1;color:#1c1b19", "+");
    plus.type = "button";
    plus.setAttribute("aria-label", "Attach");
    var field = el(
      "div",
      "flex:1;min-height:48px;display:flex;align-items:flex-end;border:1px dashed rgba(28,27,25,.14);border-radius:999px;background:#fff;padding:4px 6px 4px 16px"
    );
    var input = document.createElement("textarea");
    input.rows = 1;
    input.placeholder = "Message";
    input.style.cssText =
      "flex:1;resize:none;border:0;outline:none;background:transparent;font:16px/1.35 Jost,system-ui,sans-serif;padding:10px 0;max-height:96px;color:#1c1b19";
    var mic = el("button", "width:36px;height:36px;border:0;border-radius:999px;background:transparent;margin:4px", "");
    mic.type = "button";
    mic.setAttribute("aria-label", "Call");
    mic.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    mic.onclick = jumpCall;
    field.append(input, mic);
    form.append(plus, field);

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

    function send() {
      var text = input.value.trim();
      if (!text) return;
      input.value = "";
      history.push({ role: "user", text: text });
      list.appendChild(bubble(text, true));
      list.scrollTop = list.scrollHeight;
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
          list.appendChild(bubble(reply, false));
          list.scrollTop = list.scrollHeight;
        })
        .catch(function () {
          list.appendChild(bubble("Can't connect — try again.", false));
        });
    }

    var tabs = el("div", "display:flex;justify-content:space-around;padding:4px 24px 8px;font:11px Jost,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase");
    var chatTab = el("span", "color:#1c1b19", "Chat");
    var callTab = el("button", "border:0;background:transparent;color:#8a8680;letter-spacing:.18em;text-transform:uppercase;font:11px Jost,system-ui,sans-serif", "Call");
    callTab.type = "button";
    callTab.onclick = jumpCall;
    tabs.append(chatTab, callTab);

    wrap.append(head, ident, list, form, tabs);
    document.body.appendChild(wrap);
    setTimeout(function () {
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
