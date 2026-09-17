(function () {
  if (window.__sharakoLifeUi) return;
  window.__sharakoLifeUi = 1;

  var KEY = "sharako.life.v1";
  var LINE = "+14452968787";
  var KINDS = [
    { id: "health", label: "Health" },
    { id: "kin", label: "Kin" },
    { id: "coin", label: "Coin" },
    { id: "work", label: "Work" },
    { id: "taste", label: "Taste" },
    { id: "craft", label: "Craft" },
    { id: "else", label: "Else" },
  ];
  var LINKS = [
    { id: "browser", label: "Browser", hint: "look things up with her" },
    { id: "calendar", label: "Calendar", hint: "what's coming" },
    { id: "mail", label: "Mail", hint: "if you've linked it" },
    { id: "contacts", label: "Contacts", hint: "people on this phone" },
    { id: "log", label: "Call log", hint: "time on the line" },
    { id: "facebook", label: "Facebook", hint: "she knows you use it" },
    { id: "instagram", label: "Instagram", hint: "she knows you use it" },
    { id: "threads", label: "Threads", hint: "she knows you use it" },
  ];

  function load() {
    try {
      var parsed = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!parsed || typeof parsed !== "object") parsed = {};
    } catch (e) {
      parsed = {};
    }
    return {
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      links: parsed.links && typeof parsed.links === "object" ? parsed.links : {},
      askLinks: parsed.askLinks === "always" ? "always" : "some",
      askWeb: parsed.askWeb === "always" ? "always" : "some",
      captions: parsed.captions !== false,
      notify: parsed.notify === true || localStorage.getItem("sharako.notify") === "1",
      lockOn: parsed.lockOn === true,
      pin: String(parsed.pin || ""),
      walletOn: parsed.walletOn === true,
    };
  }
  var life = load();
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(life));
      localStorage.setItem("sharako.notify", life.notify ? "1" : "0");
    } catch (e) {}
  }
  function patch(p) {
    Object.keys(p).forEach(function (k) {
      life[k] = p[k];
    });
    persist();
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function closeLife() {
    var w = document.querySelector("[data-sharako-life]");
    if (w) w.remove();
  }
  function ensureCss() {
    if (document.getElementById("sk-life-css")) return;
    var s = document.createElement("style");
    s.id = "sk-life-css";
    s.textContent =
      "[data-sharako-life]{position:fixed;inset:0;z-index:2147482500;display:flex;flex-direction:column;background:#0b0b0b;color:#f5f5f3;font-family:Jost,Avenir Next,Segoe UI,sans-serif;-webkit-font-smoothing:antialiased}" +
      "[data-sharako-life] *{box-sizing:border-box}" +
      "[data-sharako-life] button,[data-sharako-life] a{cursor:pointer;font:inherit;color:inherit;background:none;border:0;text-decoration:none}" +
      ".lf-back{height:40px;padding:0 16px;letter-spacing:.16em;font-size:.5rem;text-transform:uppercase;color:#8a8a84;flex-shrink:0;text-align:left}" +
      ".lf-body{flex:1;min-height:0;overflow:auto;padding:0 20px 64px;-webkit-overflow-scrolling:touch}" +
      ".lf-title{font-family:Cormorant Garamond,Iowan Old Style,Georgia,serif;font-weight:500;font-size:1.25rem;color:#f5f5f3;margin:0 0 8px}" +
      ".lf-lead{max-width:20rem;font-family:Cormorant Garamond,Iowan Old Style,Georgia,serif;font-weight:300;font-size:1.15rem;line-height:1.3;color:rgba(245,245,243,.8);margin:0 0 24px}" +
      ".lf-row{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:14px 0;border-bottom:1px solid rgba(245,245,243,.14);text-align:left}" +
      ".lf-kicker{display:block;letter-spacing:.14em;font-size:.58rem;text-transform:uppercase;color:#f5f5f3}" +
      ".lf-hint{display:block;margin-top:4px;font-size:.78rem;color:#8a8a84}" +
      ".lf-open{letter-spacing:.16em;font-size:.5rem;text-transform:uppercase;color:#8a8a84;flex-shrink:0}" +
      ".lf-chip{height:32px;padding:0 10px;border-radius:2px;letter-spacing:.12em;font-size:.5rem;text-transform:uppercase;color:#8a8a84;box-shadow:0 0 0 1px rgba(245,245,243,.14)}" +
      ".lf-chip.on{background:#f5f5f3;color:#0b0b0b;box-shadow:none}" +
      ".lf-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}" +
      ".lf-form{display:flex;gap:8px;margin-bottom:28px}" +
      ".lf-in{flex:1;height:44px;border:0;outline:none;border-radius:2px;background:rgba(245,245,243,.08);color:#f5f5f3;padding:0 12px;font:14px/1.4 Jost,sans-serif}" +
      ".lf-go{height:44px;padding:0 16px;border-radius:2px;background:#f5f5f3;color:#0b0b0b;letter-spacing:.12em;font-size:.5rem;text-transform:uppercase}" +
      ".lf-note{font-size:.9rem;color:#8a8a84;margin:0 0 16px}" +
      ".lf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
      ".lf-shot{aspect-ratio:3/4;overflow:hidden;border-radius:8px;padding:0}" +
      ".lf-shot img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".lf-ask{background:rgba(245,245,243,.08);border-radius:8px;padding:16px;margin-bottom:24px}" +
      ".lf-sw{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid rgba(245,245,243,.14)}" +
      ".lf-knob{position:relative;width:48px;height:28px;border-radius:999px;background:#3a3a38;flex-shrink:0}" +
      ".lf-knob i{position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:999px;background:#141414;transition:transform .15s}" +
      ".lf-knob.on{background:#f5f5f3}" +
      ".lf-knob.on i{transform:translateX(20px);background:#0b0b0b}";
    document.head.appendChild(s);
  }

  function shell(title, build) {
    closeLife();
    ensureCss();
    var wrap = el("div", "");
    wrap.setAttribute("data-sharako-life", "1");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", title);
    var back = el("button", "lf-back", "Back");
    back.type = "button";
    back.onclick = function () {
      closeLife();
    };
    var body = el("div", "lf-body");
    body.appendChild(el("h2", "lf-title", title));
    build(body);
    wrap.append(back, body);
    document.body.appendChild(wrap);
  }

  function switchRow(body, label, hint, on, fn) {
    var row = el("div", "lf-sw");
    var left = el("div", "");
    left.appendChild(el("p", "lf-kicker", label));
    if (hint) left.appendChild(el("p", "lf-hint", hint));
    var btn = el("button", "lf-knob" + (on ? " on" : ""));
    btn.type = "button";
    btn.setAttribute("role", "switch");
    btn.setAttribute("aria-checked", on ? "true" : "false");
    btn.appendChild(el("i", ""));
    btn.onclick = function () {
      fn(!on);
    };
    row.append(left, btn);
    body.appendChild(row);
  }

  function openHub() {
    // unused — Settings stays the original screen
  }

  function openOriginalSettings() {
    closeLife();
  }

  function openView(id) {
    if (id === "marks") return openMarks();
    if (id === "sight") return openSight();
    if (id === "links") return openLinks();
    if (id === "purse") return openPurse();
    if (id === "word") return openWord();
    if (id === "channels") return openChannels();
    if (id === "lock") return openLock();
  }

  function openMarks() {
    var kind = "else";
    shell("Marks", function (body) {
      body.appendChild(el("p", "lf-lead", "what you're keeping."));
      var chips = el("div", "lf-chips");
      KINDS.forEach(function (k) {
        var c = el("button", "lf-chip" + (k.id === kind ? " on" : ""), k.label);
        c.type = "button";
        c.onclick = function () {
          kind = k.id;
          openMarks();
        };
        chips.appendChild(c);
      });
      body.appendChild(chips);
      var form = el("form", "lf-form");
      var input = el("input", "lf-in");
      input.placeholder = "a mark";
      var go = el("button", "lf-go", "Keep");
      go.type = "submit";
      form.append(input, go);
      form.onsubmit = function (e) {
        e.preventDefault();
        var title = (input.value || "").trim();
        if (!title) return;
        life.goals = [{ id: String(Date.now()), kind: kind, title: title, done: false }].concat(life.goals).slice(0, 80);
        persist();
        openMarks();
      };
      body.appendChild(form);
      var open = life.goals.filter(function (g) {
        return !g.done;
      });
      var done = life.goals.filter(function (g) {
        return g.done;
      });
      if (!open.length && !done.length) body.appendChild(el("p", "lf-note", "nothing marked yet."));
      open.forEach(function (g) {
        var row = el("div", "lf-row");
        var left = el("button", "");
        left.type = "button";
        left.style.textAlign = "left";
        left.appendChild(el("span", "lf-kicker", (KINDS.find(function (k) { return k.id === g.kind; }) || {}).label || "Else"));
        left.appendChild(el("span", "lf-hint", g.title));
        left.style.fontFamily = "Cormorant Garamond, Georgia, serif";
        left.onclick = function () {
          g.done = true;
          persist();
          openMarks();
        };
        var drop = el("button", "lf-open", "Drop");
        drop.type = "button";
        drop.onclick = function () {
          life.goals = life.goals.filter(function (x) {
            return x.id !== g.id;
          });
          persist();
          openMarks();
        };
        row.append(left, drop);
        body.appendChild(row);
      });
      if (done.length) {
        body.appendChild(el("p", "lf-kicker", "Done"));
        done.forEach(function (g) {
          var b = el("button", "lf-hint", g.title);
          b.type = "button";
          b.style.textDecoration = "line-through";
          b.style.display = "block";
          b.style.margin = "8px 0";
          b.onclick = function () {
            g.done = false;
            persist();
            openMarks();
          };
          body.appendChild(b);
        });
      }
    });
  }

  var dbp;
  function sightDb() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      var req = indexedDB.open("sharako-sight", 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains("shots")) req.result.createObjectStore("shots", { keyPath: "id", autoIncrement: true });
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
    return dbp;
  }
  function saveSight(blob) {
    return sightDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("shots", "readwrite");
        tx.objectStore("shots").add({ blob: blob, at: Date.now() });
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }
  function listSight() {
    return sightDb()
      .then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction("shots", "readonly");
          var req = tx.objectStore("shots").getAll();
          req.onsuccess = function () {
            resolve(req.result || []);
          };
          req.onerror = function () {
            reject(req.error);
          };
        });
      })
      .catch(function () {
        return [];
      });
  }
  window.__sharakoSaveSight = saveSight;

  function openSight() {
    shell("Sight", function (body) {
      body.appendChild(el("p", "lf-lead", "what she saw."));
      var file = document.createElement("input");
      file.type = "file";
      file.accept = "image/*";
      file.style.display = "none";
      file.onchange = function () {
        var f = file.files && file.files[0];
        file.value = "";
        if (!f) return;
        saveSight(f).then(openSight);
      };
      body.appendChild(file);
      var add = el("button", "lf-go", "Add");
      add.type = "button";
      add.style.marginBottom = "24px";
      add.onclick = function () {
        file.click();
      };
      body.appendChild(add);
      var grid = el("div", "lf-grid");
      body.appendChild(grid);
      listSight().then(function (rows) {
        rows.sort(function (a, b) {
          return (b.at || 0) - (a.at || 0);
        });
        if (!rows.length) {
          grid.appendChild(el("p", "lf-note", "nothing seen yet. use See, or add one."));
          return;
        }
        rows.slice(0, 40).forEach(function (row) {
          var b = el("button", "lf-shot");
          b.type = "button";
          var img = document.createElement("img");
          img.alt = "";
          img.src = URL.createObjectURL(row.blob);
          b.appendChild(img);
          b.onclick = function () {
            sightDb().then(function (db) {
              var tx = db.transaction("shots", "readwrite");
              tx.objectStore("shots").delete(row.id);
              tx.oncomplete = openSight;
            });
          };
          grid.appendChild(b);
        });
      });
    });
  }

  function openLinks() {
    var pending = null;
    function go(id, label) {
      var mode = id === "browser" ? life.askWeb : life.askLinks;
      if (mode === "always" || (mode === "some" && !life.links[id])) {
        pending = { id: id, label: label };
        openLinks();
        return;
      }
      connect(id, label);
    }
    function connect(id, label) {
      pending = null;
      if (id === "contacts") {
        var nav = navigator;
        if (nav.contacts && nav.contacts.select) {
          nav.contacts.select(["name", "tel"], { multiple: true }).then(function (people) {
            life.links[id] = true;
            persist();
            openLinks();
          }).catch(function () {
            life.links[id] = true;
            persist();
            openLinks();
          });
          return;
        }
      }
      life.links[id] = !life.links[id];
      persist();
      openLinks();
    }
    shell("Links", function (body) {
      body.appendChild(el("p", "lf-lead", "what she can reach."));
      if (pending) {
        var ask = el("div", "lf-ask");
        ask.appendChild(el("p", "lf-lead", "let her use " + pending.label + "?"));
        var yes = el("button", "lf-go", "Yes");
        yes.type = "button";
        yes.onclick = function () {
          connect(pending.id, pending.label);
        };
        var no = el("button", "lf-open", "Not now");
        no.type = "button";
        no.style.marginLeft = "12px";
        no.onclick = function () {
          pending = null;
          openLinks();
        };
        ask.append(yes, no);
        body.appendChild(ask);
      }
      LINKS.forEach(function (row) {
        var on = !!life.links[row.id];
        var b = el("button", "lf-row");
        b.type = "button";
        var left = el("span", "");
        left.appendChild(el("span", "lf-kicker", row.label));
        left.appendChild(el("span", "lf-hint", on ? "on" : row.hint));
        b.append(left, el("span", "lf-open", on ? "Open" : "Link"));
        b.onclick = function () {
          go(row.id, row.label);
        };
        body.appendChild(b);
      });
    });
  }

  function openPurse() {
    shell("Purse", function (body) {
      body.appendChild(el("p", "lf-lead", "your Stripe. monthly, top-up, a card on file."));
      body.appendChild(el("p", "lf-kicker", "SHARAKO monthly"));
      body.appendChild(el("p", "lf-hint", "$19.99 / month"));
      var m = el("button", "lf-go", "$19.99 / month");
      m.type = "button";
      m.style.margin = "12px 0 24px";
      m.onclick = function () {
        window.location.href = "/?paid=monthly";
      };
      body.appendChild(m);
      var t = el("button", "lf-go", "$9.99 top-up");
      t.type = "button";
      t.style.background = "rgba(245,245,243,.15)";
      t.style.color = "#f5f5f3";
      t.style.marginBottom = "28px";
      t.onclick = function () {
        window.location.href = "/?paid=boost";
      };
      body.appendChild(t);
      body.appendChild(el("p", "lf-kicker", "Card"));
      body.appendChild(el("p", "lf-hint", life.walletOn ? "a card is on Stripe." : "keep a card so the line stays easy."));
      var link = el("button", "lf-go", "Link by Stripe");
      link.type = "button";
      link.style.marginTop = "12px";
      link.style.background = "rgba(245,245,243,.15)";
      link.style.color = "#f5f5f3";
      link.onclick = function () {
        patch({ walletOn: true });
        openPurse();
      };
      body.appendChild(link);
    });
  }

  function openWord() {
    shell("Word", function (body) {
      body.appendChild(el("p", "lf-lead", "when she asks before she acts."));
      body.appendChild(el("p", "lf-kicker", "Links"));
      [
        { id: "some", label: "Ask for some", hint: "before she reaches somewhere new" },
        { id: "always", label: "Always ask", hint: "before any reach" },
      ].forEach(function (opt) {
        var b = el("button", "lf-row");
        b.type = "button";
        var left = el("span", "");
        left.appendChild(el("span", "lf-kicker", opt.label));
        left.appendChild(el("span", "lf-hint", opt.hint));
        b.append(left, el("span", "lf-open", life.askLinks === opt.id ? "·" : ""));
        b.onclick = function () {
          patch({ askLinks: opt.id });
          openWord();
        };
        body.appendChild(b);
      });
      body.appendChild(el("p", "lf-kicker", "Web"));
      body.style;
      [
        { id: "some", label: "Ask for some", hint: "when the place is new" },
        { id: "always", label: "Always ask", hint: "before she looks around" },
      ].forEach(function (opt) {
        var b = el("button", "lf-row");
        b.type = "button";
        var left = el("span", "");
        left.appendChild(el("span", "lf-kicker", opt.label));
        left.appendChild(el("span", "lf-hint", opt.hint));
        b.append(left, el("span", "lf-open", life.askWeb === opt.id ? "·" : ""));
        b.onclick = function () {
          patch({ askWeb: opt.id });
          openWord();
        };
        body.appendChild(b);
      });
      switchRow(body, "Captions", "show what she hears on a call", life.captions, function (on) {
        patch({ captions: on });
        openWord();
      });
      switchRow(body, "Notify", "ping when she calls", life.notify, function (on) {
        patch({ notify: on });
        if (on && typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
        openWord();
      });
    });
  }

  function openChannels() {
    shell("Channels", function (body) {
      body.appendChild(el("p", "lf-lead", "other ways in. same girl."));
      var line = el("div", "lf-row");
      var lleft = el("span", "");
      lleft.appendChild(el("span", "lf-kicker", "The line"));
      lleft.appendChild(el("span", "lf-hint", LINE));
      line.appendChild(lleft);
      body.appendChild(line);
      var sms = el("a", "lf-row");
      sms.href = "sms:" + LINE;
      var sleft = el("span", "");
      sleft.appendChild(el("span", "lf-kicker", "Text"));
      sleft.appendChild(el("span", "lf-hint", "SMS to the line"));
      sms.append(sleft, el("span", "lf-open", "Open"));
      body.appendChild(sms);
      var wa = el("a", "lf-row");
      wa.href = "https://wa.me/" + LINE.replace("+", "");
      wa.target = "_blank";
      wa.rel = "noreferrer";
      var wleft = el("span", "");
      wleft.appendChild(el("span", "lf-kicker", "WhatsApp"));
      wleft.appendChild(el("span", "lf-hint", "same number"));
      wa.append(wleft, el("span", "lf-open", "Open"));
      body.appendChild(wa);
    });
  }

  function openLock() {
    shell("Lock", function (body) {
      body.appendChild(el("p", "lf-lead", "pin the house."));
      switchRow(body, "Lock", "ask for the pin when you open the app", life.lockOn, function (on) {
        patch({ lockOn: on });
        openLock();
      });
      var form = el("form", "lf-form");
      form.style.marginTop = "24px";
      var input = el("input", "lf-in");
      input.inputMode = "numeric";
      input.placeholder = "four digits";
      input.maxLength = 4;
      var go = el("button", "lf-go", "Set");
      go.type = "submit";
      form.append(input, go);
      var msg = el("p", "lf-note", "");
      form.onsubmit = function (e) {
        e.preventDefault();
        var pin = (input.value || "").replace(/\D/g, "").slice(0, 4);
        if (pin.length !== 4) {
          msg.textContent = "four digits";
          return;
        }
        patch({ pin: pin, lockOn: true });
        msg.textContent = "locked";
      };
      body.append(form, msg);
    });
  }

  function lockGate() {
    if (!life.lockOn || !life.pin) return;
    try {
      if (sessionStorage.getItem("sharako.unlocked") === "1") return;
    } catch (e) {}
    ensureCss();
    var wrap = el("div", "");
    wrap.setAttribute("data-sharako-life", "lock");
    wrap.style.zIndex = "2147483646";
    var body = el("div", "lf-body");
    body.style.paddingTop = "64px";
    body.appendChild(el("h2", "lf-title", "SHARAKO"));
    body.appendChild(el("p", "lf-lead", "the house is locked."));
    var form = el("form", "");
    var input = el("input", "lf-in");
    input.inputMode = "numeric";
    input.placeholder = "pin";
    input.maxLength = 4;
    var go = el("button", "lf-go", "Open");
    go.type = "submit";
    go.style.width = "100%";
    go.style.marginTop = "16px";
    var bad = el("p", "lf-note", "");
    form.append(input, go, bad);
    form.onsubmit = function (e) {
      e.preventDefault();
      if ((input.value || "") === life.pin) {
        try {
          sessionStorage.setItem("sharako.unlocked", "1");
        } catch (err) {}
        wrap.remove();
        return;
      }
      bad.textContent = "not that.";
    };
    body.appendChild(form);
    wrap.appendChild(body);
    document.body.appendChild(wrap);
  }

  function findSettingsScroll() {
    var marin = Array.prototype.find.call(document.querySelectorAll("button"), function (x) {
      return ((x.textContent || "").replace(/\s+/g, " ").trim() === "Marin");
    });
    if (!marin) return null;
    var n = marin.parentElement;
    var best = null;
    while (n && n !== document.body) {
      var st = window.getComputedStyle(n);
      var cls = n.className || "";
      if (
        st.overflowY === "auto" ||
        st.overflowY === "scroll" ||
        /overflow-y-auto|overflow-auto|overflow-y-scroll/.test(cls)
      ) {
        best = n;
      }
      n = n.parentElement;
    }
    if (best) return best;
    n = marin.parentElement;
    while (n && n !== document.body) {
      var st2 = window.getComputedStyle(n);
      if (st2.position === "absolute" || st2.position === "fixed") return n;
      n = n.parentElement;
    }
    return marin.parentElement;
  }

  function injectHouseRows() {
    if (document.querySelector("[data-sharako-life]")) return false;
    if (document.querySelector("[data-sharako-house-rows]")) return true;
    var body = findSettingsScroll();
    if (!body) return false;
    var box = el("div", "");
    box.setAttribute("data-sharako-house-rows", "1");
    box.style.cssText = "margin:32px 0 64px;padding-top:4px;border-top:1px solid rgba(245,245,243,.14)";
    var kicker = el("p", "");
    kicker.textContent = "House";
    kicker.style.cssText =
      "margin:16px 0 8px;letter-spacing:.16em;font-size:.5rem;text-transform:uppercase;color:#8a8a84";
    box.appendChild(kicker);
    [
      { id: "marks", label: "Marks", hint: "what you're keeping" },
      { id: "sight", label: "Sight", hint: "what she saw" },
      { id: "links", label: "Links", hint: "what she can reach" },
      { id: "purse", label: "Purse", hint: "Stripe" },
      { id: "word", label: "Word", hint: "when she asks" },
      { id: "channels", label: "Channels", hint: "other ways in" },
      { id: "lock", label: "Lock", hint: "pin the house" },
    ].forEach(function (row) {
      var b = document.createElement("button");
      b.type = "button";
      b.style.cssText =
        "display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:14px 0;border:0;border-bottom:1px solid rgba(245,245,243,.14);background:none;color:inherit;font:inherit;text-align:left;cursor:pointer";
      var left = document.createElement("span");
      var lab = document.createElement("span");
      lab.textContent = row.label;
      lab.style.cssText =
        "display:block;letter-spacing:.14em;font-size:.58rem;text-transform:uppercase;color:#f5f5f3";
      var hint = document.createElement("span");
      hint.textContent = row.hint;
      hint.style.cssText = "display:block;margin-top:4px;font-size:.78rem;color:#8a8a84";
      left.append(lab, hint);
      var open = document.createElement("span");
      open.textContent = "Open";
      open.style.cssText = "letter-spacing:.16em;font-size:.5rem;text-transform:uppercase;color:#8a8a84;flex-shrink:0";
      b.append(left, open);
      b.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openView(row.id);
      };
      box.appendChild(b);
    });
    body.appendChild(box);
    return true;
  }

  document.addEventListener(
    "click",
    function (e) {
      var t = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!t) return;
      var label = (t.getAttribute("aria-label") || "").trim();
      if (label === "Snap") {
        var v = document.querySelector("video");
        if (v && v.videoWidth) {
          var c = document.createElement("canvas");
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          c.getContext("2d").drawImage(v, 0, 0);
          c.toBlob(function (blob) {
            if (blob) saveSight(blob);
          }, "image/jpeg", 0.88);
        }
      }
    },
    true
  );

  var obs = new MutationObserver(function () {
    injectHouseRows();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  injectHouseRows();
})();
