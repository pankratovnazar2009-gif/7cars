/* 7cars admin panel demo */
(function () {
  const S = window.SC;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ic = n => `<i data-lucide="${n}"></i>`;
  const icons = () => { try { lucide.createIcons({ attrs: { "stroke-width": 1.75 } }); } catch (e) {} };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const content = $("#content");
  const clsName = id => (S.CLASSES.find(c => c.id === id) || {}).name;
  let view = "overview", q = "", maps = [], tickers = [], drawer = null, chatCar = null;
  const filters = { map: "all", fleet: "all" };

  /* ---------- read state for chats ---------- */
  let readTs = {}; try { readTs = JSON.parse(localStorage.getItem("7cars-admin-read") || "{}"); } catch (e) {}
  const markRead = id => { readTs[id] = Date.now(); try { localStorage.setItem("7cars-admin-read", JSON.stringify(readTs)); } catch (e) {} badges(); };
  const unread = id => (S.state.chats[id] || []).filter(m => m.from === "client" && m.t > (readTs[id] || S.state.epoch)).length;

  /* ---------- status helpers ---------- */
  function stat(id, t) {
    const s = S.state.cars[id]; t = t || S.telemetry(id);
    if (s.status === "rented" && t.left < 0) return { k: "overdue", label: "Прострочка" };
    return { k: s.status, label: { rented: "В оренді", available: "Вільне", service: "ТО / мийка", reserved: "Заброньоване", delivering: "Подача" }[s.status] };
  }
  const overspeed = (id, t) => t.speed > (S.state.cars[id].route && S.ROUTES[S.state.cars[id].route].hwy ? 110 : 80);
  const outOfRegion = t => t.ll[1] < 29.6 && t.ll[0] > 49.9 && t.ll[0] < 51; // west of Kyiv oblast, rough geofence
  function alerts() {
    const out = [];
    S.FLEET.forEach(c => {
      const s = S.state.cars[c.id], t = S.telemetry(c.id), cl = s.client && S.client(s.client);
      if (s.status === "rented") {
        if (t.left < 0) out.push({ lvl: "danger", icon: "alarm-clock", id: c.id, title: "Прострочка повернення · " + S.fmtLeft(t.left), text: `${c.name} · ${cl.short} · ${t.place}`, acts: ["chat", "call"], w: 100 });
        if (overspeed(c.id, t)) out.push({ lvl: "danger", icon: "gauge", id: c.id, title: `Перевищення: ${t.speed} км/год`, text: `${c.name} · ${cl.short} · ${t.place}`, acts: ["chat", "call"], w: 90 });
        if (outOfRegion(t)) out.push({ lvl: "info", icon: "map-pinned", id: c.id, title: "Виїзд за межі Київської області", text: `${c.name} · ${cl.short} · геозона «Київщина»`, acts: ["chat"], w: 40 });
        if (t.left > 0 && t.left < 3 * S.H) out.push({ lvl: "warn", icon: "hourglass", id: c.id, title: "Закінчується через " + S.fmtLeft(t.left), text: `${c.name} · ${cl.short}`, acts: ["offer", "chat"], w: 70 });
        if (t.fuel < 18) out.push({ lvl: "warn", icon: c.ev ? "battery-low" : "fuel", id: c.id, title: `${c.ev ? "Заряд" : "Паливо"} ${t.fuel}%`, text: `${c.name} · ${cl.short}`, acts: ["chat"], w: 30 });
        if (s.immobilized) out.push({ lvl: "danger", icon: "shield-alert", id: c.id, title: "Двигун заблоковано дистанційно", text: `${c.name} · ${cl.short}`, acts: ["unimmo"], w: 95 });
      }
      if (s.status === "delivering") { const d = S.delivery(); if (d) out.push({ lvl: "info", icon: "truck", id: c.id, title: d.phase === 3 ? "Авто доставлено — клієнт робить огляд" : `Подача · прибуде через ${d.eta} хв`, text: `${c.name} → ${d.addr} · ${cl ? cl.short : ""}`, acts: ["chat"], w: 85 }); }
      const un = unread(c.id); if (un) out.push({ lvl: "acc", icon: "message-circle", id: c.id, title: `${un} нов${un === 1 ? "е повідомлення" : "і повідомлення"}`, text: `${cl ? cl.short : "Клієнт"} · ${c.name}: «${(S.state.chats[c.id].filter(m => m.from === "client").slice(-1)[0] || {}).text || ""}»`, acts: ["chat"], w: 80 });
    });
    S.state.bookings.filter(b => b.status === "new").forEach(b => out.push({ lvl: "info", icon: "calendar-plus", id: b.car, bid: b.id, title: `Нове бронювання ${b.id}`, text: `${S.car(b.car).name} · ${S.client(b.client).short} · ${S.money(b.total)} · ${b.src}`, acts: ["confirm"], w: 60 }));
    return out.sort((a, b) => b.w - a.w);
  }

  /* ---------- finance (demo model) ---------- */
  function revenueToday() {
    const now = new Date(), mid = new Date(now); mid.setHours(0, 0, 0, 0);
    const frac = (now - mid) / 864e5;
    let sum = 0;
    S.FLEET.forEach(c => { const s = S.state.cars[c.id]; if (s.status === "rented") { const days = Math.max(1, Math.round((s.end - s.start) / 864e5)); sum += S.dayPrice(c, days) * frac; } });
    S.state.bookings.filter(b => b.src === "Застосунок" && b.from > mid.getTime() - 864e5).forEach(b => sum += 0); // paid bookings counted in month
    return sum + 412; // + доп. послуги, трансфери
  }
  function revenueMonth() {
    const d = new Date().getDate();
    const base = S.FLEET.reduce((s, c) => s + c.prices.d4 * 0.64, 0) * (d - 1);
    const app = S.state.bookings.filter(b => b.src === "Застосунок").reduce((s, b) => s + b.total, 0);
    return base + revenueToday() + app;
  }
  function kmDay() {
    let s = 0; const now = Date.now();
    S.FLEET.forEach(c => { if (S.state.cars[c.id].status === "rented") { const a = S.telemetry(c.id, now).km, b = S.telemetry(c.id, now - 864e5).km; s += Math.max(0, a - b); } });
    return s;
  }
  const spark = (seed, n = 14, up = true) => { const pts = []; for (let i = 0; i < n; i++) { const v = 0.45 + 0.25 * Math.sin(i * 0.9 + seed) + (up ? i / n * 0.35 : 0) + 0.08 * Math.sin(i * 2.7 + seed * 3); pts.push(`${(i / (n - 1) * 100).toFixed(1)},${(30 - v * 26).toFixed(1)}`); } return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="${pts.join(" ")}" fill="none" stroke="var(--accent)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`; };

  /* ---------- toasts ---------- */
  function toast(title, text, icon = "bell", onClick) {
    const el = document.createElement("div"); el.className = "toast";
    el.innerHTML = `<div class="ic">${ic(icon)}</div><div><b>${esc(title)}</b><span>${esc(text || "")}</span></div>`;
    $("#toasts").prepend(el); icons();
    const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 300); };
    el.onclick = () => { close(); onClick && onClick(); };
    setTimeout(close, 5200);
    $("#bellDot").hidden = false;
    ping();
  }
  let actx; function ping() { try { actx = actx || new AudioContext(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.06, actx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.25); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.26); } catch (e) {} }
  function confirmBox(title, text, okLabel, danger, onOk) {
    const el = document.createElement("div"); el.className = "confirm"; el.setAttribute("role", "dialog");
    el.innerHTML = `<div class="box"><h3>${title}</h3><p>${text}</p><div class="acts"><button class="btn" data-x>Скасувати</button><button class="btn ${danger ? "danger" : "acc"}" data-ok>${okLabel}</button></div></div>`;
    document.body.appendChild(el);
    $("[data-x]", el).onclick = () => el.remove(); el.onclick = e => { if (e.target === el) el.remove(); };
    $("[data-ok]", el).onclick = () => { el.remove(); onOk(); };
  }

  /* ---------- actions ---------- */
  function act(kind, id, extra) {
    const c = S.car(id), s = S.state.cars[id], cl = s.client && S.client(s.client);
    if (kind === "chat") return openChat(id);
    if (kind === "call") return toast("Дзвінок клієнту", `${cl ? cl.name + " · " + cl.phone : ""} (у демо не здійснюється)`, "phone");
    if (kind === "offer") { S.addMsg(id, "manager", `${cl.short.split(" ")[0]}, бачимо, що оренда ${c.name} закінчується. Продовжимо на добу зі знижкою 10%? Натисніть «Продовжити» в застосунку.`); S.bus.post({ type: "remote", carId: id, action: "offer" }); S.logEvent(`Анна запропонувала продовження ${c.name} (−10%)`, "booking", id); S.save(); return toast("Пропозицію надіслано", `${cl.short} отримає push і повідомлення в чаті`, "badge-percent"); }
    if (kind === "lock") { s.locked = true; S.logEvent(`Анна дистанційно зачинила ${c.name}`, "key", id); S.save(); S.bus.post({ type: "remote", carId: id, action: "lock" }); return toast("Авто зачинено", c.name + " · " + c.plate, "lock"); }
    if (kind === "horn") { S.logEvent(`Анна: сигнал і фари ${c.name}`, "info", id); S.save(); S.bus.post({ type: "remote", carId: id, action: "horn" }); return toast("Сигнал подано", c.name, "volume-2"); }
    if (kind === "immo") return confirmBox("Заблокувати двигун?", `${c.name} (${c.plate}) не зможе завестися після зупинки. Використовуйте лише при підозрі на викрадення або грубе порушення договору.`, "Заблокувати", true, () => { s.immobilized = true; S.logEvent(`Двигун ${c.name} заблоковано дистанційно`, "danger", id); S.save(); S.bus.post({ type: "remote", carId: id, action: "immobilize" }); toast("Двигун заблоковано", c.name + " · " + c.plate, "shield-alert"); rerender(); });
    if (kind === "unimmo") { s.immobilized = false; delete s.immoKm; S.logEvent(`Двигун ${c.name} розблоковано`, "ok", id); S.save(); toast("Двигун розблоковано", c.name, "shield-check"); return rerender(); }
    if (kind === "confirm") { const b = S.state.bookings.find(x => x.id === extra); if (b) { b.status = "confirmed"; S.addMsg(b.car, "system", `Бронювання ${b.id} підтверджено менеджером.`); S.logEvent(`Підтверджено ${b.id}`, "ok", b.car); S.save(); toast("Бронювання підтверджено", b.id + " · клієнт отримав SMS і push", "calendar-check"); rerender(); } }
    if (kind === "wash") { s.status = "service"; s.note = "Мийка"; S.save(); toast("Відправлено на мийку", c.name, "droplets"); rerender(); }
  }

  /* ---------- views ---------- */
  const V = {};
  V.overview = () => {
    const rented = S.FLEET.filter(c => S.state.cars[c.id].status === "rented").length;
    const cnt = k => S.FLEET.filter(c => S.state.cars[c.id].status === k).length;
    const ending = S.FLEET.filter(c => S.state.cars[c.id].status === "rented").map(c => ({ c, t: S.telemetry(c.id) })).sort((a, b) => a.t.left - b.t.left).slice(0, 6);
    return {
      title: "Огляд", sub: "Стан автопарку наживо · " + S.fmtDate(Date.now(), { weekday: "long", day: "numeric", month: "long" }),
      html: `
      <div class="grid kpis">
        <div class="panel kpi accent"><div class="lbl">В оренді зараз</div><div class="v num"><span data-k="rented">${rented}</span><small> / ${S.FLEET.length}</small></div>
          <div class="util"><i style="width:${rented / 30 * 100}%;background:var(--accent)"></i><i style="width:${(cnt("reserved") + cnt("delivering")) / 30 * 100}%;background:var(--info)"></i><i style="width:${cnt("service") / 30 * 100}%;background:#7d7d84"></i></div>
          <div class="d">Завантаження <b data-k="util" style="color:var(--bg)">${Math.round(rented / 30 * 100)}%</b> · ціль 70%</div></div>
        <div class="panel kpi"><div class="lbl">Виручка сьогодні</div><div class="v num" data-k="revDay">${S.money(revenueToday())}</div><div class="d"><span class="up">↑ 18%</span> до минулого ${S.fmtDate(Date.now() - 7 * 864e5, { weekday: "short" })}</div>${spark(1)}</div>
        <div class="panel kpi"><div class="lbl">Виручка за ${new Date().toLocaleDateString("uk-UA", { month: "long" })}</div><div class="v num" data-k="revMonth">${S.money(revenueMonth())}</div><div class="d"><span class="up">↑ 12%</span> до жовтня на цю дату</div>${spark(2.3)}</div>
        <div class="panel kpi"><div class="lbl">Пробіг парку · 24 год</div><div class="v num"><span data-k="km">${kmDay().toLocaleString("uk-UA")}</span><small> км</small></div><div class="d">${S.FLEET.filter(c => S.state.cars[c.id].status === "rented" && S.telemetry(c.id).moving).length} авто зараз у русі</div>${spark(4.1, 14, false)}</div>
        <div class="panel kpi"><div class="lbl">Задоволеність</div><div class="v num">4.8<small> ★</small></div><div class="d">94% отримали авто за 30 хв</div>${spark(5.6)}</div>
      </div>

      <div class="grid row2" style="margin-top:16px">
        <div class="panel"><div class="ph"><h2>${ic("map")}Автопарк на карті</h2>
          <div class="chips" id="mapChips">${[["all", "Усі"], ["rented", "В оренді"], ["available", "Вільні"], ["alert", "З алертами"]].map(([k, l]) => `<button class="chip" data-mf="${k}" aria-pressed="${filters.map === k}">${l}</button>`).join("")}
          <span style="width:8px"></span>${[["ua", "Україна"], ["kyiv", "Київ"], ["west", "Захід"]].map(([k, l]) => `<button class="chip" data-fly="${k}">${ic("crosshair")}${l}</button>`).join("")}</div></div>
          <div class="mapbox"><div class="map" id="fleetMap"></div>
            <div class="legend"><span><i style="background:var(--accent)"></i>В оренді</span><span><i style="background:var(--ok)"></i>Вільне</span><span><i style="background:var(--info)"></i>Бронь / подача</span><span><i style="background:#7d7d84"></i>ТО</span><span><i style="background:var(--danger)"></i>Алерт</span></div></div>
        </div>
        <div class="panel"><div class="ph"><h2>${ic("siren")}Потребують уваги</h2><span class="act" data-k="alertsN"></span></div><div class="pb" style="max-height:488px;overflow:auto"><div class="alerts" id="alerts"></div></div></div>
      </div>

      <div class="grid row3" style="margin-top:16px">
        <div class="panel"><div class="ph"><h2>${ic("timer")}Повернення найближчим часом</h2></div><div class="pb" style="padding-top:6px">
          <table class="tbl"><tbody id="endingT">${ending.map(({ c, t }) => endingRow(c, t)).join("")}</tbody></table></div></div>
        <div class="panel ai-card"><div class="ph"><h2>${ic("sparkles")}AI-аналітик</h2><span class="act">на базі даних парку</span></div><div class="pb">
          <div id="insights">${insights().map((x, i) => `<div class="ins"><span class="n">0${i + 1}</span><div>${x}</div></div>`).join("")}</div>
          <form class="ai-ask" id="aiAsk"><input placeholder="Запитайте: хто повертає сьогодні? де Tesla?" aria-label="Питання AI-аналітику"><button aria-label="Запитати">${ic("arrow-up")}</button></form><div id="aiAns"></div></div></div>
        <div class="panel"><div class="ph"><h2>${ic("activity")}Події наживо</h2></div><div class="pb"><div class="feed" id="feed"></div></div></div>
      </div>`,
      mount() {
        const map = L.map("fleetMap", { zoomControl: true, attributionControl: false, scrollWheelZoom: true });
        tiles(map); map.fitBounds([[46.3, 23.8], [51.0, 35.3]]);
        const markers = {};
        const draw = () => {
          const del = S.delivery();
          S.FLEET.forEach(c => {
            const s = S.state.cars[c.id], t = S.telemetry(c.id), st = stat(c.id, t);
            const alert = st.k === "overdue" || (s.status === "rented" && (overspeed(c.id, t) || s.immobilized));
            const show = filters.map === "all" || (filters.map === "alert" ? alert : filters.map === "rented" ? ["rented", "overdue"].includes(st.k) : st.k === filters.map);
            let m = markers[c.id];
            const cls = alert ? "alert" : st.k === "overdue" ? "alert" : st.k;
            const html = `<div class="mk ${cls}">${s.status === "delivering" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>' : c.name.split(" ")[0].slice(0, 2).toUpperCase()}</div>`;
            if (!m) { m = markers[c.id] = L.marker(t.ll, { icon: L.divIcon({ className: "", html, iconSize: [30, 30], iconAnchor: [15, 15] }), riseOnHover: true }).addTo(map); m._h = html; m.on("click", () => openCar(c.id)); m.bindTooltip("", { className: "tt", direction: "top", offset: [0, -14] }); }
            if (m._h !== html) { m.setIcon(L.divIcon({ className: "", html, iconSize: [30, 30], iconAnchor: [15, 15] })); m._h = html; }
            m.setLatLng(t.ll);
            m.setTooltipContent(`<b>${c.name}</b> · ${c.plate}<br>${st.label}${t.speed ? " · " + t.speed + " км/год" : ""}${s.status === "delivering" && del ? " · ETA " + del.eta + " хв" : ""}`);
            if (show && !map.hasLayer(m)) m.addTo(map); if (!show && map.hasLayer(m)) map.removeLayer(m);
          });
        };
        draw(); tickers.push(draw);
        $$("[data-mf]").forEach(b => b.onclick = () => { filters.map = b.dataset.mf; $$("[data-mf]").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
        $$("[data-fly]").forEach(b => b.onclick = () => { const k = b.dataset.fly; if (k === "ua") map.flyToBounds([[46.3, 23.8], [51.0, 35.3]], { duration: 1.2 }); if (k === "kyiv") map.flyTo([50.44, 30.56], 12, { duration: 1.2 }); if (k === "west") map.flyToBounds([[48.2, 23.8], [50.0, 25.0]], { duration: 1.2 }); });
        const drawAlerts = () => { const a = alerts(); $("[data-k=alertsN]").textContent = a.length + " активних"; $("#alerts").innerHTML = a.map(alertRow).join("") || `<p class="muted">Все спокійно 👌</p>`; icons(); };
        drawAlerts(); let n = 0; tickers.push(() => { if (++n % 3 === 0) drawAlerts(); });
        $("#alerts").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b) { e.stopPropagation(); return act(b.dataset.a, b.dataset.id, b.dataset.bid); } const r = e.target.closest("[data-open]"); if (r) openCar(r.dataset.open); });
        const drawFeed = () => { $("#feed").innerHTML = S.state.log.slice(0, 30).map(l => `<div class="fe ${l.kind}"><span class="t">${S.fmtTime(l.t)}</span><span>${esc(l.text)}</span></div>`).join("") || seedFeed(); };
        drawFeed(); tickers.push(() => { const top = S.state.log[0]; if (top && top.t !== drawFeed._last) { drawFeed._last = top.t; drawFeed(); } });
        tickers.push(() => {
          const set = (k, v) => { const x = $(`[data-k=${k}]`); if (x) x.textContent = v; };
          set("revDay", S.money(revenueToday())); set("revMonth", S.money(revenueMonth())); set("km", kmDay().toLocaleString("uk-UA"));
          const tb = $("#endingT"); if (tb) tb.innerHTML = S.FLEET.filter(c => S.state.cars[c.id].status === "rented").map(c => ({ c, t: S.telemetry(c.id) })).sort((a, b) => a.t.left - b.t.left).slice(0, 6).map(({ c, t }) => endingRow(c, t)).join("");
        });
        $("#endingT").closest("table").addEventListener("click", e => { const r = e.target.closest("[data-open]"); if (r) openCar(r.dataset.open); });
        $("#aiAsk").onsubmit = e => { e.preventDefault(); const inp = $("#aiAsk input"); const a = analyst(inp.value); if (!inp.value.trim()) return; $("#aiAns").innerHTML = `<div class="ai-ans">${a}</div>`; inp.value = ""; };
        let alive = true;
        setTimeout(() => { if (alive) map.invalidateSize(); }, 300);
        return () => { alive = false; map.stop(); map.remove(); };
      },
    };
  };
  function seedFeed() {
    const now = Date.now();
    return [[6, "Ірина Т. відчинила Renault Logan MCV через застосунок", "key"], [14, "Нове бронювання B-24119 через AI-асистента: Kia Ceed SW, 2 д", "booking"], [22, "Volkswagen ID.4 Crozz: заряд 100%, повернуто на лінію", "info"], [41, "Віктор Р. (ТОВ «Агросфера») продовжив Skoda Kamiq на 7 д", "booking"]]
      .map(([m, t, k]) => `<div class="fe ${k}"><span class="t">${S.fmtTime(now - m * 60000)}</span><span>${t}</span></div>`).join("");
  }
  function endingRow(c, t) {
    const s = S.state.cars[c.id], cl = S.client(s.client), cls = t.left < 0 ? "red" : t.left < 3 * S.H ? "amber" : "";
    return `<tr class="click" data-open="${c.id}"><td><div class="cn">${S.studio(c, { cls: "thumb", style: "width:48px;height:32px" })}<div><b>${c.name}</b><small>${cl.short}</small></div></div></td><td style="text-align:right"><span class="left ${cls}">${S.fmtLeft(t.left)}</span></td></tr>`;
  }
  function alertRow(a) {
    const btn = { chat: `<button class="sbtn" data-a="chat" data-id="${a.id}">${ic("message-circle")}Написати</button>`, call: `<button class="sbtn" data-a="call" data-id="${a.id}">${ic("phone")}Подзвонити</button>`, offer: `<button class="sbtn acc" data-a="offer" data-id="${a.id}">${ic("badge-percent")}Продовження −10%</button>`, confirm: `<button class="sbtn acc" data-a="confirm" data-id="${a.id}" data-bid="${a.bid}">${ic("check")}Підтвердити</button>`, unimmo: `<button class="sbtn" data-a="unimmo" data-id="${a.id}">${ic("shield-check")}Розблокувати</button>` };
    return `<div class="al" data-open="${a.id}"><div class="ic ${a.lvl}">${ic(a.icon)}</div><div><b>${esc(a.title)}</b><p>${esc(a.text)}</p><div class="acts">${a.acts.map(x => btn[x]).join("")}</div></div></div>`;
  }

  function insights() {
    const now = Date.now();
    const idle = S.FLEET.filter(c => S.state.cars[c.id].status === "available").map(c => ({ c, d: (now - S.state.cars[c.id].idleSince) / 864e5 })).sort((a, b) => b.d - a.d)[0];
    const suvBusy = S.FLEET.filter(c => c.cls === "suv" && S.state.cars[c.id].status !== "available").length;
    const ev = S.FLEET.filter(c => c.ev), evBusy = ev.filter(c => S.state.cars[c.id].status === "rented").length;
    const over = S.FLEET.filter(c => S.state.cars[c.id].status === "rented" && S.telemetry(c.id).left < 0);
    const out = [];
    out.push(`Попит на <b>позашляховики</b>: ${suvBusy} з 5 зайняті, у AI-підборі сьогодні 7 запитів «Карпати». Рекомендую <b>+8% до тарифу 1–3 дні</b> на вихідні.`);
    if (idle) out.push(`<b>${idle.c.name}</b> простоює ${idle.d.toFixed(1).replace(".", ",")} д. Запропонувати −10% на 3+ доби і поставити першим у видачі AI — очікуваний дохід +${S.money(idle.c.prices.d4 * 3 * 0.9)}.`);
    out.push(`Електромобілі завантажені на <b>${Math.round(evBusy / ev.length * 100)}%</b> — вище за середнє по парку. Варто додати ще 2 EV у бізнес-клас.`);
    if (over.length) out.push(`${over.length} прострочк${over.length === 1 ? "а" : "и"} повернення: автоматично нараховано погодинну доплату, клієнту надіслано нагадування.`);
    return out.slice(0, 4);
  }
  function analyst(qq) {
    const t = qq.toLowerCase(), now = Date.now();
    const find = () => S.FLEET.find(c => c.name.toLowerCase().split(/[ -]/).some(w => w.length > 2 && t.includes(w)) || t.replace(/\s/g, "").includes(c.plate.replace(/\s/g, "").toLowerCase()));
    if (/де |знайди|локац|місцезн|де зараз/.test(t) && find()) { const c = find(), tt = S.telemetry(c.id), st = stat(c.id, tt); return `<b>${c.name}</b> (${c.plate}) — ${st.label.toLowerCase()}.\n${tt.place}, ${tt.speed ? "рухається " + tt.speed + " км/год" : "стоїть"}. Координати ${tt.ll.map(x => x.toFixed(4)).join(", ")}.${tt.left != null ? "\nДо повернення: " + S.fmtLeft(tt.left) + "." : ""}`; }
    if (/поверт|закінч|сьогодні/.test(t)) { const l = S.FLEET.filter(c => S.state.cars[c.id].status === "rented").map(c => ({ c, tt: S.telemetry(c.id) })).filter(x => x.tt.left < 24 * S.H).sort((a, b) => a.tt.left - b.tt.left); return `Протягом 24 год повертаються ${l.length} авто:\n` + l.map(x => `• ${x.c.name} — ${S.client(S.state.cars[x.c.id].client).short}, ${x.tt.left < 0 ? "прострочено " + S.fmtLeft(x.tt.left).slice(1) : "через " + S.fmtLeft(x.tt.left)}`).join("\n"); }
    if (/віль|доступн/.test(t)) { const l = S.FLEET.filter(c => S.state.cars[c.id].status === "available"); return `Вільні зараз ${l.length} авто:\n` + l.map(c => `• ${c.name} — ${S.OFFICES.find(o => o.id === S.state.cars[c.id].office).city}, від ${S.money(c.prices.d1)}/доба`).join("\n"); }
    if (/виручк|дохід|заробі|грош/.test(t)) return `Сьогодні: ${S.money(revenueToday())}\nЗа місяць: ${S.money(revenueMonth())}\nНайприбутковіший клас — бізнес (${S.money(revenueMonth() * 0.27)}), найшвидше росте — позашляховики (+21%).`;
    if (/прост(ою|ій)|не працю/.test(t)) { const l = S.FLEET.filter(c => S.state.cars[c.id].status === "available").map(c => ({ c, d: (now - S.state.cars[c.id].idleSince) / 864e5 })).sort((a, b) => b.d - a.d).slice(0, 4); return "Найдовше простоюють:\n" + l.map(x => `• ${x.c.name} — ${x.d.toFixed(1).replace(".", ",")} д`).join("\n"); }
    if (/перевищ|швидк|порушн/.test(t)) { const l = S.FLEET.filter(c => S.state.cars[c.id].status === "rented" && overspeed(c.id, S.telemetry(c.id))); return l.length ? "Зараз перевищують:\n" + l.map(c => `• ${c.name} — ${S.telemetry(c.id).speed} км/год, ${S.client(S.state.cars[c.id].client).short}`).join("\n") : "Зараз ніхто не перевищує швидкість."; }
    if (find()) { const c = find(), tt = S.telemetry(c.id); return `<b>${c.name}</b> · ${stat(c.id, tt).label}. Пробіг ${tt.odo.toLocaleString("uk-UA")} км, ${c.ev ? "заряд" : "паливо"} ${tt.fuel}%. Тариф ${S.money(c.prices.d1)} → ${S.money(c.prices.month)}/доба.`; }
    return "Можу відповісти: хто повертає сьогодні, які авто вільні, де конкретне авто (назва або номер), хто перевищує швидкість, яка виручка, які авто простоюють.";
  }

  V.fleet = () => ({
    title: "Автопарк", sub: "30 авто · телеметрія оновлюється щосекунди",
    html: `<div class="panel"><div class="ph" style="padding-bottom:14px"><div class="chips">${[["all", "Усі"], ["rented", "В оренді"], ["overdue", "Прострочка"], ["available", "Вільні"], ["reserved", "Бронь / подача"], ["service", "ТО"]].map(([k, l]) => `<button class="chip" data-ff="${k}" aria-pressed="${filters.fleet === k}">${l}</button>`).join("")}</div>
      <div class="chips">${S.CLASSES.map(c => `<button class="chip" data-fc="${c.id}" aria-pressed="${filters.cls === c.id}">${c.name}</button>`).join("")}</div></div>
      <div style="overflow:auto"><table class="tbl"><thead><tr><th>Авто</th><th>Статус</th><th>Клієнт</th><th>Де зараз</th><th>Швидкість</th><th>Одометр</th><th>За оренду</th><th>Паливо / заряд</th><th>До повернення</th><th></th></tr></thead><tbody id="fleetT"></tbody></table></div></div>`,
    mount() {
      const draw = () => {
        const rows = S.FLEET.filter(c => {
          const t = S.telemetry(c.id), st = stat(c.id, t), s = S.state.cars[c.id];
          if (filters.cls && c.cls !== filters.cls) return false;
          if (filters.fleet !== "all") { if (filters.fleet === "reserved" ? !["reserved", "delivering"].includes(st.k) : filters.fleet === "rented" ? !["rented", "overdue"].includes(st.k) : st.k !== filters.fleet) return false; }
          if (q) { const cl = s.client && S.client(s.client); return (c.name + c.plate + (cl ? cl.name : "")).toLowerCase().includes(q.toLowerCase()); }
          return true;
        });
        $("#fleetT").innerHTML = rows.map(c => {
          const s = S.state.cars[c.id], t = S.telemetry(c.id), st = stat(c.id, t), cl = s.client && S.client(s.client);
          const fcls = t.fuel < 20 ? "low" : t.fuel < 40 ? "mid" : "";
          return `<tr class="click" data-open="${c.id}"><td><div class="cn">${S.studio(c, { cls: "thumb", style: "" })}<div><b>${c.name}</b><small>${c.plate} · ${clsName(c.cls)}</small></div></div></td>
            <td><span class="st ${st.k}"><i></i>${st.label}</span>${s.immobilized ? ` <span class="st overdue">${ic("shield-alert")}</span>` : ""}</td>
            <td>${cl ? `${cl.short}${cl.corp ? `<br><small class="muted">${cl.corp}</small>` : ""}` : `<span class="muted">${s.note || "—"}</span>`}</td>
            <td class="muted" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${t.place}</td>
            <td><span class="spd ${s.status === "rented" && overspeed(c.id, t) ? "over" : ""}">${t.speed ? t.speed + " км/год" : "—"}</span></td>
            <td class="num">${t.odo.toLocaleString("uk-UA")} км</td>
            <td class="num">${s.status === "rented" ? t.km + " км" : "—"}</td>
            <td><div class="fuel"><div class="b"><i class="${fcls}" style="width:${t.fuel}%"></i></div><span class="num">${t.fuel}%</span></div></td>
            <td>${t.left != null ? `<span class="left ${t.left < 0 ? "red" : t.left < 3 * S.H ? "amber" : ""}">${S.fmtLeft(t.left)}</span>` : s.status === "reserved" ? `<span class="muted">видача ${S.fmtDate(s.pickup)}</span>` : "—"}</td>
            <td>${ic("chevron-right")}</td></tr>`;
        }).join("") || `<tr><td colspan="10" class="muted" style="padding:30px;text-align:center">Нічого не знайдено</td></tr>`;
        icons();
      };
      draw(); tickers.push(draw);
      $("#fleetT").addEventListener("click", e => { const r = e.target.closest("[data-open]"); if (r) openCar(r.dataset.open); });
      $$("[data-ff]").forEach(b => b.onclick = () => { filters.fleet = b.dataset.ff; $$("[data-ff]").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
      $$("[data-fc]").forEach(b => b.onclick = () => { filters.cls = filters.cls === b.dataset.fc ? null : b.dataset.fc; $$("[data-fc]").forEach(x => x.setAttribute("aria-pressed", x.dataset.fc === filters.cls)); draw(); });
      V.fleet._draw = draw;
    },
  });

  V.bookings = () => {
    const day0 = new Date(); day0.setHours(0, 0, 0, 0); const t0 = day0.getTime(), span = 7 * 864e5;
    const items = [];
    S.FLEET.forEach(c => { const s = S.state.cars[c.id]; if (s.status === "rented") items.push({ car: c.id, from: s.start, to: s.end, client: s.client, kind: s.end < Date.now() ? "overdue" : "rented", label: S.client(s.client).short }); });
    S.state.bookings.forEach(b => items.push({ car: b.car, from: b.from, to: b.to, client: b.client, kind: b.status === "new" ? "new" : "reserved", label: `${b.id} · ${S.client(b.client).short}`, bid: b.id }));
    const cars = [...new Set(items.map(i => i.car))].map(S.car).sort((a, b) => S.CLASSES.findIndex(x => x.id === a.cls) - S.CLASSES.findIndex(x => x.id === b.cls));
    const pct = t => Math.max(0, Math.min(100, (t - t0) / span * 100));
    const news = S.state.bookings.filter(b => b.status === "new");
    return {
      title: "Бронювання", sub: `${S.state.bookings.length} майбутніх бронювань · ${news.length} чекають підтвердження`,
      html: `${news.length ? `<div class="panel" style="margin-bottom:16px"><div class="ph"><h2>${ic("inbox")}Нові заявки</h2></div><div class="pb"><table class="tbl"><tbody>${news.map(b => { const c = S.car(b.car), cl = S.client(b.client); return `<tr><td><div class="cn">${S.studio(c, { cls: "thumb", style: "" })}<div><b>${c.name}</b><small>${b.id}</small></div></div></td><td>${cl.name}<br><small class="muted">${cl.phone}</small></td><td>${S.fmtDate(b.from)} → ${S.fmtDate(b.to)}</td><td><span class="st reserved"><i></i>${b.src}</span></td><td class="num"><b>${S.money(b.total)}</b></td><td style="text-align:right"><button class="sbtn acc" data-a="confirm" data-id="${b.car}" data-bid="${b.id}">${ic("check")}Підтвердити</button> <button class="sbtn" data-a="chat" data-id="${b.car}">${ic("message-circle")}Написати</button></td></tr>`; }).join("")}</tbody></table></div></div>` : ""}
      <div class="panel"><div class="ph" style="padding-bottom:12px"><h2>${ic("calendar-range")}Шахматка на 7 днів</h2><div class="chips"><span class="st rented"><i></i>Оренда</span><span class="st reserved"><i></i>Бронь</span><span class="st overdue"><i></i>Прострочка</span></div></div>
        <div class="gantt"><div class="g-head"><div class="lbl" style="padding:12px">Авто</div><div class="g-days">${[...Array(7)].map((_, i) => { const d = new Date(t0 + i * 864e5); return `<div class="${i === 0 ? "today" : ""}"><b>${d.toLocaleDateString("uk-UA", { weekday: "short" })}</b>${d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" })}</div>`; }).join("")}</div></div>
        ${cars.map(c => `<div class="g-row"><div class="who">${S.studio(c, { cls: "thumb", style: "width:46px;height:30px" })}<div style="line-height:1.2"><b style="font-size:13px">${c.name}</b><br><small class="muted mono" style="font-size:10.5px">${c.plate}</small></div></div>
          <div class="lane">${items.filter(i => i.car === c.id && i.to > t0 && i.from < t0 + span).map(i => { const a = pct(i.from), b = pct(Math.max(i.to, Date.now() + (i.kind === "overdue" ? 3 * 36e5 : 0))); return `<div class="g-bar ${i.kind}" style="left:calc(${a}% + 2px);width:calc(${Math.max(2.5, b - a)}% - 4px)" data-open="${c.id}" title="${esc(i.label)}">${esc(i.label)}</div>`; }).join("")}
          <div class="g-now" style="left:${pct(Date.now())}%"></div></div></div>`).join("")}</div></div>`,
      mount() {
        content.addEventListener("click", ganttClick);
        return () => content.removeEventListener("click", ganttClick);
      },
    };
  };
  function ganttClick(e) { const a = e.target.closest("[data-a]"); if (a) return act(a.dataset.a, a.dataset.id, a.dataset.bid); const o = e.target.closest("[data-open]"); if (o) openCar(o.dataset.open); }

  V.chats = () => {
    const ids = Object.keys(S.state.chats).filter(id => (S.state.chats[id] || []).length).sort((a, b) => last(b).t - last(a).t);
    if (!chatCar || !ids.includes(chatCar)) chatCar = ids[0];
    return {
      title: "Чати з клієнтами", sub: "Кожен чат прив'язаний до конкретного авто й оренди",
      html: `<div class="panel chats"><div class="inbox" id="inbox"></div><div class="conv" id="conv"></div><div class="ctx" id="ctx"></div></div>`,
      mount() {
        const drawInbox = () => {
          const ids2 = Object.keys(S.state.chats).filter(id => (S.state.chats[id] || []).length).sort((a, b) => last(b).t - last(a).t);
          $("#inbox").innerHTML = ids2.map(id => { const c = S.car(id), s = S.state.cars[id], cl = s.client && S.client(s.client), m = last(id), u = unread(id); return `<button class="ib" data-c="${id}" aria-current="${id === chatCar}">${S.studio(c, { cls: "thumb", style: "" })}<div style="min-width:0"><b>${cl ? cl.short : "Клієнт"} · ${c.name}</b><p>${m.from === "manager" ? "Ви: " : ""}${esc(m.text)}</p></div><div class="r">${S.fmtTime(m.t)}<br>${u ? `<span class="un">${u}</span>` : ""}</div></button>`; }).join("");
        };
        const drawConv = () => {
          const id = chatCar; if (!id) { $("#conv").innerHTML = `<div class="muted" style="padding:30px">Немає чатів</div>`; return; }
          const c = S.car(id), s = S.state.cars[id], cl = s.client && S.client(s.client), t = S.telemetry(id), st = stat(id, t);
          $("#conv").innerHTML = `<div class="conv-h"><div class="client-card" style="flex:1"><div class="av" style="width:38px;height:38px;border-radius:50%;background:var(--surface-2);display:grid;place-items:center;font-weight:600;font-size:13px">${cl ? cl.name.split(" ").map(x => x[0]).join("") : "?"}</div><div><b style="font-size:14px">${cl ? cl.name : "Клієнт"}</b>${cl && cl.lang ? ` <span class="st reserved">EN · автопереклад</span>` : ""}<div class="muted" style="font-size:12px">${c.name} · ${c.plate} · <span class="st ${st.k}" style="padding:1px 8px"><i></i>${st.label}</span></div></div></div>
              <button class="sbtn" data-a="call" data-id="${id}">${ic("phone")}Подзвонити</button><button class="sbtn" data-open="${id}">${ic("car-front")}Картка авто</button></div>
            <div class="conv-msgs" id="cm">${(S.state.chats[id] || []).map(m => `<div class="msg ${m.from}">${esc(m.text)}${m.from !== "system" ? `<span class="tm">${S.fmtTime(m.t)}</span>` : ""}</div>`).join("")}</div>
            <div class="quick">${(cl && cl.lang ? ["Yes, sure!", "Leave the key card in the glovebox", "We'll call you in 5 min"] : ["Так, звісно!", "Перевіряю по телеметрії — хвилинку", "Можемо підмінити авто за 40 хв", "Продовжимо зі знижкою 10%?"]).map(x => `<button>${x}</button>`).join("")}</div>
            <form class="comp" id="cf"><input placeholder="Відповідь клієнту…" aria-label="Відповідь"><button>${ic("send")}Надіслати</button></form>`;
          icons(); const cm = $("#cm"); cm.scrollTop = cm.scrollHeight; markRead(id);
          $("#cf").onsubmit = e => { e.preventDefault(); const i = $("#cf input"); if (i.value.trim()) { S.addMsg(id, "manager", i.value.trim()); i.value = ""; } };
          $$(".quick button").forEach(b => b.onclick = () => S.addMsg(id, "manager", b.textContent));
          $("#ctx").innerHTML = `${S.studio(c, { cls: "img" })}<h3 style="margin:14px 0 4px;font-size:16px">${c.name}</h3><div class="muted mono" style="font-size:11.5px">${c.plate}</div>
            <div class="tele" style="grid-template-columns:1fr 1fr;margin-top:14px"><div><div class="lbl">Швидкість</div><b>${t.speed}<small> км/год</small></b></div><div><div class="lbl">${c.ev ? "Заряд" : "Паливо"}</div><b>${t.fuel}<small>%</small></b></div><div><div class="lbl">За оренду</div><b>${t.km}<small> км</small></b></div><div><div class="lbl">До кінця</div><b style="font-size:16px">${t.left != null ? S.fmtLeft(t.left) : "—"}</b></div></div>
            <p class="muted" style="font-size:12.5px;margin:12px 0">${ic("map-pin")} ${t.place}</p>
            <div class="actions" style="grid-template-columns:1fr">${s.status === "rented" ? `<button class="abtn" data-a="offer" data-id="${id}">${ic("badge-percent")}Запропонувати продовження</button><button class="abtn" data-a="horn" data-id="${id}">${ic("volume-2")}Посигналити</button>` : ""}</div>`;
          icons();
        };
        drawInbox(); drawConv();
        $("#inbox").onclick = e => { const b = e.target.closest("[data-c]"); if (b) { chatCar = b.dataset.c; drawInbox(); drawConv(); } };
        const onC = e => { const a = e.target.closest("[data-a]"); if (a) act(a.dataset.a, a.dataset.id); const o = e.target.closest("[data-open]"); if (o) openCar(o.dataset.open); };
        content.addEventListener("click", onC);
        const off = S.bus.on(m => { if (m.type === "chat" || m.type === "state") { drawInbox(); if (!m.carId || m.carId === chatCar) drawConv(); } });
        return () => { off(); content.removeEventListener("click", onC); };
      },
    };
  };
  const last = id => (S.state.chats[id] || []).slice(-1)[0] || { t: 0, text: "" };

  V.analytics = () => {
    const rev = S.CLASSES.map((c, i) => ({ c, v: S.FLEET.filter(f => f.cls === c.id).reduce((s, f) => s + f.prices.d4 * 0.64 * (new Date().getDate() - 1), 0), prev: [0.88, 0.95, 0.9, 0.97, 0.79, 1.04][i] }));
    const max = Math.max(...rev.map(r => r.v));
    const util = S.CLASSES.map(c => { const l = S.FLEET.filter(f => f.cls === c.id); return { c, u: l.filter(f => ["rented", "delivering", "reserved"].includes(S.state.cars[f.id].status)).length / l.length }; });
    const perCar = S.FLEET.map((f, i) => ({ f, v: f.prices.d4 * (18 + (i * 7) % 11) })).sort((a, b) => b.v - a.v);
    const avg = perCar.reduce((s, x) => s + x.v, 0) / perCar.length, top = perCar[0].v;
    const ch = [["Застосунок", 38], ["Сайт", 27], ["Telegram-бот", 15], ["Телефон", 12], ["AI-асистент", 8]];
    const wd = [52, 48, 55, 61, 84, 97, 78];
    return {
      title: "Аналітика", sub: "Місяць до сьогодні · порівняння з минулим місяцем",
      html: `<div class="grid row2"><div class="panel"><div class="ph"><h2>${ic("chart-bar")}Виручка за класами</h2><span class="act"><i style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:2px"></i>&nbsp;листопад&nbsp;&nbsp;<i style="display:inline-block;width:10px;height:10px;background:var(--line-2);border-radius:2px"></i>&nbsp;жовтень</span></div><div class="pb"><div class="bars">${rev.map(r => `<div class="bar-row"><span>${r.c.name}</span><div class="tr" style="position:relative"><i style="width:${r.v / max * 100}%"></i></div><span class="v">${S.money(r.v)}</span></div><div class="bar-row" style="margin-top:-6px"><span></span><div class="tr" style="height:4px"><i class="b2" style="width:${r.v * r.prev / max * 100}%;opacity:1;background:var(--line-2)"></i></div><span class="v muted" style="font-size:11px">${r.prev < 1 ? "+" + Math.round((1 / r.prev - 1) * 100) : "−" + Math.round((r.prev - 1) * 100)}%</span></div>`).join("")}</div></div></div>
        <div class="panel"><div class="ph"><h2>${ic("gauge")}Завантаження за класами</h2></div><div class="pb"><div class="bars">${util.map(u => `<div class="bar-row"><span>${u.c.name}</span><div class="tr"><i style="width:${u.u * 100}%;${u.u >= .8 ? "" : "background:var(--ink);opacity:.75"}"></i></div><span class="v">${Math.round(u.u * 100)}%</span></div>`).join("")}</div>
          <p class="muted" style="font-size:12.5px;margin:16px 0 0;line-height:1.5">${ic("sparkles")} AI: класи із завантаженням понад 80% — кандидати на підвищення тарифу або докупівлю авто.</p></div></div></div>
      <div class="grid row3" style="margin-top:16px">
        <div class="panel" style="grid-column:span 2"><div class="ph"><h2>${ic("trophy")}Дохід кожного авто vs середнє по парку</h2><span class="act">середнє ${S.money(avg)}</span></div><div class="pb"><table class="tbl"><tbody>${perCar.slice(0, 10).map(x => `<tr class="click" data-open="${x.f.id}"><td><div class="cn">${S.studio(x.f, { cls: "thumb", style: "width:48px;height:32px" })}<div><b>${x.f.name}</b><small>${clsName(x.f.cls)}</small></div></div></td><td style="width:45%"><div class="bar-row" style="grid-template-columns:1fr 60px"><div class="tr" style="position:relative"><i style="width:${x.v / top * 100}%"></i><span style="position:absolute;left:${avg / top * 100}%;top:-3px;bottom:-3px;width:2px;background:var(--ink)"></span></div><span class="v ${x.v > avg ? "" : "muted"}">${x.v > avg ? "+" : ""}${Math.round((x.v / avg - 1) * 100)}%</span></div></td><td class="num" style="text-align:right"><b>${S.money(x.v)}</b></td></tr>`).join("")}</tbody></table></div></div>
        <div class="stack" style="display:flex;flex-direction:column;gap:16px">
          <div class="panel"><div class="ph"><h2>${ic("split")}Канали бронювань</h2></div><div class="pb"><div class="bars">${ch.map(([n, v]) => `<div class="bar-row" style="grid-template-columns:100px 1fr 40px"><span>${n}</span><div class="tr"><i style="width:${v / 38 * 100}%"></i></div><span class="v">${v}%</span></div>`).join("")}</div></div></div>
          <div class="panel"><div class="ph"><h2>${ic("calendar-days")}Попит за днями тижня</h2></div><div class="pb"><div class="vchart">${wd.map((v, i) => `<div><i class="${i >= 4 && i <= 5 ? "on" : ""}" style="height:${v}%"></i><span>${["пн", "вт", "ср", "чт", "пт", "сб", "нд"][i]}</span></div>`).join("")}</div></div></div>
        </div></div>`,
      mount() { const f = e => { const o = e.target.closest("[data-open]"); if (o) openCar(o.dataset.open); }; content.addEventListener("click", f); return () => content.removeEventListener("click", f); },
    };
  };

  V.soon = (p) => ({
    title: p, sub: "Інтеграція в плані розробки",
    html: `<div class="panel" style="padding:40px;max-width:720px"><div class="lbl">Наступний етап</div><h2 style="font-size:32px;letter-spacing:-.03em;margin:12px 0">${p === "Дія" ? "Документи клієнта з Дії в один тап" : "Автоматичні рахунки для бізнес-клієнтів"}</h2>
      <p class="muted" style="line-height:1.6;font-size:15px">${p === "Дія" ? "Клієнт ділиться паспортом, ІПН і посвідченням водія через Дію — менеджер бачить перевірені дані тут, без фото й ручного введення. Видача авто скорочується з 30 до ~10 хвилин." : "Рахунки з ПДВ, акти й звіти для корпоративних клієнтів формуються автоматично після кожної оренди."}</p></div>`,
  });

  /* ---------- drawer ---------- */
  function openCar(id) {
    closeDrawer(true);
    const c = S.car(id);
    const bd = document.createElement("div"); bd.className = "dr-bd";
    const el = document.createElement("aside"); el.className = "drawer"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", c.name);
    document.body.append(bd, el);
    let map, mk, cleanupChat;
    const render = () => {
      const s = S.state.cars[id], t = S.telemetry(id), st = stat(id, t), cl = s.client && S.client(s.client);
      const total = s.end ? s.end - s.start : 1;
      el.innerHTML = `<div class="dr-scroll">
        <div class="dr-hero">${S.studio(c, { dark: true, cls: "dr-stage" })}<button class="dr-close" data-close aria-label="Закрити">${ic("x")}</button>
          <div class="t"><div><span class="st ${st.k}" style="background:rgba(255,255,255,.9)"><i></i>${st.label}</span><h2 style="margin-top:8px">${c.name}</h2><div class="plate">${c.plate} · ${clsName(c.cls)} · ${c.year}</div></div><a class="sbtn" href="${c.url}" target="_blank" rel="noopener" style="background:rgba(255,255,255,.9);color:#17171A">7cars.com.ua ↗</a></div></div>
        ${s.status === "rented" ? `<div class="dr-sec"><div class="cd"><div><div class="lbl">До повернення</div><div class="big num" data-d="left" style="color:${t.left < 0 ? "var(--danger)" : t.left < 3 * S.H ? "var(--warn)" : "var(--ink)"}">${S.fmtLeft(t.left)}</div></div>
          <div class="prog"><div class="between" style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px"><span>${S.fmtDate(s.start)} ${S.fmtTime(s.start)}</span><span>${S.fmtDate(s.end)} ${S.fmtTime(s.end)}</span></div><div class="tr"><i data-d="bar" style="width:${Math.min(100, (Date.now() - s.start) / total * 100)}%;${t.left < 0 ? "background:var(--danger)" : ""}"></i></div></div></div></div>` : ""}
        ${cl ? `<div class="dr-sec"><h3>${ic("user-round")}Клієнт</h3><div class="client-card"><div class="av">${cl.name.split(" ").map(x => x[0]).join("")}</div><div style="flex:1"><b>${cl.name}</b> <span class="tier ${cl.tier}">${cl.tier}</span>${cl.corp ? ` <span class="st service">${cl.corp}</span>` : ""}<div class="muted" style="font-size:12.5px;margin-top:3px">${cl.phone} · ${cl.trips} оренд · документи перевірено</div></div><button class="sbtn" data-a="call">${ic("phone")}</button></div></div>` : ""}
        <div class="dr-sec"><h3>${ic("radio")}Телеметрія наживо</h3><div class="tele">
          <div><div class="lbl">Швидкість</div><b data-d="speed" style="${s.status === "rented" && overspeed(id, t) ? "color:var(--danger)" : ""}">${t.speed}<small> км/год</small></b></div>
          <div><div class="lbl">${c.ev ? "Заряд" : "Паливо"}</div><b data-d="fuel">${t.fuel}<small>%</small></b></div>
          <div><div class="lbl">Двері</div><b style="font-size:16px">${s.locked ? "Зачинено" : "Відчинено"}</b></div>
          <div><div class="lbl">Одометр</div><b data-d="odo">${t.odo.toLocaleString("uk-UA")}<small> км</small></b></div>
          <div><div class="lbl">За оренду</div><b data-d="km">${s.status === "rented" ? t.km : 0}<small> км</small></b></div>
          <div><div class="lbl">Двигун</div><b style="font-size:16px;${s.immobilized ? "color:var(--danger)" : ""}">${s.immobilized ? "Заблоковано" : t.moving ? "Працює" : "Вимкнено"}</b></div>
        </div><div class="muted" style="font-size:12.5px;margin-top:10px" data-d="place">${ic("map-pin")} ${t.place}</div>
        <div class="mini-map" id="drMap" style="margin-top:12px"></div></div>
        <div class="dr-sec"><h3>${ic("zap")}Дистанційні дії</h3><div class="actions">
          ${s.status === "rented" ? `<button class="abtn" data-a="lock">${ic("lock")}Зачинити авто</button><button class="abtn" data-a="horn">${ic("volume-2")}Сигнал і фари</button><button class="abtn" data-a="offer">${ic("badge-percent")}Продовження −10%</button>${s.immobilized ? `<button class="abtn" data-a="unimmo">${ic("shield-check")}Розблокувати двигун</button>` : `<button class="abtn danger" data-a="immo">${ic("shield-alert")}Заблокувати двигун</button>`}` : `<button class="abtn" data-a="wash">${ic("droplets")}Відправити на мийку</button><button class="abtn" data-a="chat">${ic("message-circle")}Відкрити чат</button>`}
        </div></div>
        <div class="dr-sec"><h3>${ic("camera")}Акт огляду при видачі · AI</h3><div class="photos">${c.gallery.map((g, i) => `<div style="background-image:url('${g}')"><span>${["Спереду", "Ззаду", "Ліворуч", "Праворуч"][i]}</span></div>`).join("")}</div>
          <p class="muted" style="font-size:12.5px;margin:10px 0 0">${ic("sparkles")} Нових пошкоджень не виявлено · фото з геоміткою й часом ${s.start ? S.fmtDate(s.start) + " " + S.fmtTime(s.start) : "—"}</p></div>
        <div class="dr-sec dr-chat"><h3>${ic("message-circle")}Чат по цьому авто</h3><div class="conv-msgs" id="drMsgs"></div>
          <form class="comp" id="drForm" style="padding:12px 0 0;border:0"><input placeholder="Написати клієнту…" aria-label="Повідомлення клієнту"><button>${ic("send")}</button></form></div>
      </div>`;
      icons();
      $("[data-close]", el).onclick = () => closeDrawer();
      $$("[data-a]", el).forEach(b => b.onclick = () => { act(b.dataset.a, id); if (["lock", "unimmo", "wash"].includes(b.dataset.a)) setTimeout(render, 50); });
      const msgs = $("#drMsgs", el);
      const drawMsgs = () => { msgs.innerHTML = (S.state.chats[id] || []).map(m => `<div class="msg ${m.from}">${esc(m.text)}${m.from !== "system" ? `<span class="tm">${S.fmtTime(m.t)}</span>` : ""}</div>`).join("") || `<p class="muted" style="font-size:13px">Повідомлень ще немає</p>`; msgs.scrollTop = msgs.scrollHeight; markRead(id); };
      drawMsgs();
      if (cleanupChat) cleanupChat(); cleanupChat = S.bus.on(m => { if (m.type === "chat" && m.carId === id) drawMsgs(); });
      $("#drForm", el).onsubmit = e => { e.preventDefault(); const i = $("#drForm input", el); if (i.value.trim()) { S.addMsg(id, "manager", i.value.trim()); i.value = ""; } };
      // mini map
      if (map) map.remove();
      map = L.map($("#drMap", el), { zoomControl: false, attributionControl: false }); tiles(map);
      if (s.status === "rented" && s.route) { const p = S.getPath(s.route); L.polyline(p.pts, { color: "#FF5100", weight: 3, opacity: .45, dashArray: "4 6" }).addTo(map); map.fitBounds(L.polyline(p.pts).getBounds(), { padding: [20, 20] }); }
      else map.setView(t.ll, 14);
      mk = L.marker(t.ll, { icon: L.divIcon({ className: "", html: `<div class="mk ${st.k === "overdue" ? "alert" : st.k}">${c.name.slice(0, 2).toUpperCase()}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(map);
      const mm = map; setTimeout(() => { if (map === mm && drawer && drawer.el === el) mm.invalidateSize(); }, 350);
    };
    render();
    const tick = () => {
      const s = S.state.cars[id], t = S.telemetry(id); if (!t) return;
      const set = (k, h) => { const x = $(`[data-d=${k}]`, el); if (x) x.innerHTML = h; };
      set("speed", `${t.speed}<small> км/год</small>`); set("fuel", `${t.fuel}<small>%</small>`); set("odo", `${t.odo.toLocaleString("uk-UA")}<small> км</small>`); if (s.status === "rented") set("km", `${t.km}<small> км</small>`);
      if (t.left != null) set("left", S.fmtLeft(t.left));
      if (mk) mk.setLatLng(t.ll);
    };
    tickers.push(tick);
    drawer = { el, bd, tick, cleanup: () => { cleanupChat && cleanupChat(); map && map.remove(); } };
    bd.onclick = () => closeDrawer();
  }
  function closeDrawer(instant) {
    if (!drawer) return; const d = drawer; drawer = null;
    tickers = tickers.filter(t => t !== d.tick); d.cleanup();
    if (instant) { d.el.remove(); d.bd.remove(); return; }
    d.el.classList.add("out"); d.bd.style.opacity = 0; setTimeout(() => { d.el.remove(); d.bd.remove(); }, 300);
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });

  /* ---------- router ---------- */
  let unmount = null;
  function tiles(map) {
    let layer;
    map._setTiles = () => { if (layer) map.removeLayer(layer); layer = L.tileLayer(S.tileUrl(document.documentElement.dataset.theme === "dark"), { maxZoom: 16 }).addTo(map); };
    map._setTiles(); maps.push(map);
  }
  function show(v, param) {
    if (unmount) { try { unmount(); } catch (e) {} }
    tickers = drawer ? [drawer.tick] : []; maps = [];
    view = v;
    const r = V[v](param);
    $("#title").textContent = r.title; $("#subtitle").textContent = r.sub || "";
    content.innerHTML = `<div class="view-enter">${r.html}</div>`; icons();
    $$("#nav [data-view]").forEach(b => b.setAttribute("aria-current", b.dataset.view === v && (v !== "soon" || b.dataset.soon === param) ? "page" : "false"));
    unmount = r.mount ? r.mount() : null;
  }
  function rerender() { const sc = content.scrollTop; show(view, view === "soon" ? $("#title").textContent : undefined); content.scrollTop = sc; }
  function openChat(id) { chatCar = id; closeDrawer(true); show("chats"); }
  function badges() {
    const u = Object.keys(S.state.chats).reduce((s, id) => s + unread(id), 0);
    const b = $("#chBadge"); b.hidden = !u; b.textContent = u;
    const nb = S.state.bookings.filter(x => x.status === "new").length; const bb = $("#bkBadge"); bb.hidden = !nb; bb.textContent = nb;
  }

  $("#nav").addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (b) show(b.dataset.view, b.dataset.soon); });
  $("#q").addEventListener("input", e => { q = e.target.value; if (view !== "fleet") show("fleet"); else V.fleet._draw && V.fleet._draw(); });
  $("#bell").onclick = () => { $("#bellDot").hidden = true; show("overview"); };
  document.addEventListener("click", e => {
    const th = e.target.closest("[data-theme-set]"); if (th) { document.documentElement.dataset.theme = th.dataset.themeSet; try { localStorage.setItem("7cars-theme", th.dataset.themeSet); } catch (er) {} syncSegs(); rerender(); }
    const cu = e.target.closest("[data-cur]"); if (cu) { S.setCurrency(cu.dataset.cur); syncSegs(); rerender(); }
  });
  function syncSegs() {
    $$("[data-theme-set]").forEach(b => b.setAttribute("aria-pressed", b.dataset.themeSet === document.documentElement.dataset.theme));
    $$("[data-cur]").forEach(b => b.setAttribute("aria-pressed", b.dataset.cur === S.currency));
  }

  // live events from the client app
  S.bus.on(m => {
    if (m.type === "booking") { const b = S.state.bookings.find(x => x.id === m.id); if (b) toast("Нове бронювання " + b.id, `${S.car(b.car).name} · ${S.client(b.client).short} · ${S.money(b.total)} · ${b.mode === "delivery" ? "подача" : "офіс"}`, "calendar-plus", () => openCar(b.car)); if (view !== "chats") rerender(); }
    if (m.type === "chat" && m.from === "client") { const c = S.car(m.carId), cl = S.client(S.state.cars[m.carId].client); toast(`${cl ? cl.short : "Клієнт"} · ${c.name}`, last(m.carId).text, "message-circle", () => openChat(m.carId)); }
    if (m.type === "key") { const c = S.car(m.carId); toast(m.locked ? "Авто зачинено клієнтом" : "Авто відчинено клієнтом", c.name + " · " + c.plate, m.locked ? "lock" : "lock-open", () => openCar(m.carId)); }
    if (m.type === "state") { badges(); if (["fleet", "bookings"].includes(view)) rerender(); }
    if (m.type === "chat") badges();
    if (m.type === "currency") { syncSegs(); rerender(); }
  });
  // state from other tab may switch theme
  window.addEventListener("storage", e => { if (e.key === "7cars-theme" && e.newValue) { document.documentElement.dataset.theme = e.newValue; syncSegs(); rerender(); } });

  setInterval(() => {
    tickers.forEach(t => { try { t(); } catch (e) { console.warn(e); } });
    $("#clock").textContent = new Date().toLocaleTimeString("uk-UA");
    try { localStorage.setItem("7cars-admin-alive", Date.now()); } catch (e) {}
  }, 1000);

  $("#sbLogo").innerHTML = S.LOGO(34);
  syncSegs(); badges();
  const [hv, hid] = location.hash.slice(1).split(":");
  show(V[hv] ? hv : "overview");
  if (hid && S.car(hid)) setTimeout(() => openCar(hid), 300);
  S.loadRoads();
})();
