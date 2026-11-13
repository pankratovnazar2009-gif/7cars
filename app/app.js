/* 7cars client app demo */
(function () {
  const S = window.SC, AI = window.SevenAI;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ic = n => `<i data-lucide="${n}"></i>`;
  const icons = () => { try { lucide.createIcons({ attrs: { "stroke-width": 1.75 } }); } catch (e) {} };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const view = $("#view"), wrap = $("#wrap"), nav = $("#nav");
  const ME = () => S.client(S.state.me.clientId);
  const HOME_LL = [50.4473, 30.5224], HOME_ADDR = "вул. Хрещатик, 22";
  const CLS_IMG = { econom: "econom", middle: "middle", business: "business", premium: "premium", suv: "offroad", minivan: "minivan" };
  const clsImg = id => `../assets/classes/${CLS_IMG[id]}.jpg`;
  const clsName = id => (S.CLASSES.find(c => c.id === id) || {}).name;
  const ui = { city: "Київ", days: 3, fav: new Set(["c22"]) };
  let maps = [];

  /* ---------- theme & currency ---------- */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("7cars-theme", t); } catch (e) {}
    $$("[data-theme-set]").forEach(b => b.setAttribute("aria-pressed", b.dataset.themeSet === t));
    maps.forEach(m => m._setTiles && m._setTiles());
    refreshTop();
  }
  function syncSegs() {
    $$("[data-theme-set]").forEach(b => b.setAttribute("aria-pressed", b.dataset.themeSet === document.documentElement.dataset.theme));
    $$("[data-cur]").forEach(b => b.setAttribute("aria-pressed", b.dataset.cur === S.currency));
  }
  function tiles(map) {
    let layer;
    map._setTiles = () => {
      if (layer) map.removeLayer(layer);
      const dark = document.documentElement.dataset.theme === "dark";
      layer = L.tileLayer(S.tileUrl(dark), { attribution: "Esri, HERE, OpenStreetMap", maxZoom: 16 }).addTo(map);
    };
    map._setTiles(); maps.push(map);
  }

  /* ---------- router ---------- */
  const TABS = ["home", "catalog", "ai", "key", "profile"];
  let stack = [];
  const top = () => stack[stack.length - 1];
  function build(name, params) {
    const r = R[name](params || {});
    const el = document.createElement("section");
    el.className = "screen " + (r.cls || "") + (r.noNav ? " no-nav" : "");
    el.innerHTML = r.html;
    el.setAttribute("aria-label", r.title || name);
    return { el, r };
  }
  function go(name, params = {}, opts = {}) {
    const prev = top();
    const { el, r } = build(name, params);
    view.appendChild(el); icons();
    const isTab = TABS.includes(name) && !opts.push;
    if (isTab) {
      stack.forEach(s => { s.cleanup && s.cleanup(); s.el.remove(); });
      stack = []; el.classList.add("fade");
    } else {
      el.classList.add("enter");
      if (prev) { prev.el.classList.add("leave"); setTimeout(() => { if (top() !== prev) prev.el.style.visibility = "hidden"; }, 380); }
    }
    const entry = { name, params, el, ...r };
    stack.push(entry);
    r.mount && r.mount(el, entry);
    setTimeout(() => el.classList.remove("enter", "fade"), 700);
    updateNav();
  }
  function back() {
    if (stack.length < 2) return go("home");
    const cur = stack.pop(); cur.cleanup && cur.cleanup();
    const prev = top();
    prev.el.style.visibility = ""; prev.el.classList.remove("leave"); prev.el.classList.add("back-enter");
    cur.el.classList.add("back-leave");
    setTimeout(() => { cur.el.remove(); prev.el.classList.remove("back-enter"); }, 340);
    prev.onShow && prev.onShow(prev.el);
    updateNav();
  }
  function refreshTop() {
    const t = top(); if (!t) return;
    const sc = t.el.scrollTop;
    t.cleanup && t.cleanup();
    const r = R[t.name](t.params);
    t.el.innerHTML = r.html; Object.assign(t, r); icons(); r.mount && r.mount(t.el, t); t.el.scrollTop = sc;
  }
  function updateNav() {
    const t = top();
    nav.classList.toggle("hidden", !!(t && t.noNav));
    const tab = stack.length ? stack[0].name : "home";
    $$("[data-tab]", nav).forEach(b => { if (b.dataset.tab !== tab) b.removeAttribute("aria-current"); else b.setAttribute("aria-current", "page"); });
    $("#statusbar").classList.toggle("on-dark", !!(t && t.darkTop));
  }

  /* ---------- toast & modal ---------- */
  function toast(title, text, icon = "bell", onClick) {
    $$(".toast", wrap).forEach(t => t.remove());
    const el = document.createElement("div");
    el.className = "toast"; el.setAttribute("role", "status");
    el.innerHTML = `<div class="ic">${ic(icon)}</div><div class="t"><b>${esc(title)}</b>${esc(text || "")}</div>`;
    wrap.appendChild(el); icons();
    const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 300); };
    el.onclick = () => { close(); onClick && onClick(); };
    setTimeout(close, 4200);
    try { navigator.vibrate && navigator.vibrate(20); } catch (e) {}
  }
  function modal(html, mount) {
    const bd = document.createElement("div"); bd.className = "backdrop";
    const m = document.createElement("div"); m.className = "modal"; m.setAttribute("role", "dialog");
    m.innerHTML = `<div class="grab" style="width:40px;height:5px;border-radius:3px;background:var(--line-2);margin:0 auto 16px"></div>` + html;
    wrap.append(bd, m); icons();
    const close = () => { bd.remove(); m.style.animation = "sheetUp .3s var(--ease-in) reverse forwards"; setTimeout(() => m.remove(), 280); };
    bd.onclick = close; mount && mount(m, close);
    return close;
  }

  /* ---------- shared fragments ---------- */
  const specLine = c => `<span>${ic(c.ev ? "zap" : "fuel")}${c.fuel}</span><span>${ic("settings-2")}${c.gear}</span><span>${ic("users")}${c.seats}</span>`;
  function availTag(id) {
    const s = S.state.cars[id];
    if (s.status === "available") return `<span class="tag ok">${ic("circle-check")}Вільне</span>`;
    if (s.status === "rented") return `<span class="tag">${ic("clock")}Вільне з ${S.fmtDate(s.end)}</span>`;
    if (s.status === "reserved" || s.status === "delivering") return `<span class="tag warn">${ic("calendar")}Заброньоване</span>`;
    return `<span class="tag">${ic("wrench")}На ТО</span>`;
  }
  const carTile = c => `<button class="car-tile card" data-go="car" data-id="${c.id}">
      ${S.studio(c, { cls: "ph" })}
      <div class="ct-b"><div class="nm">${c.name}</div><div class="sp">${specLine(c)}</div>
      <div class="pr">від <b class="num">${S.money(c.prices.month)}</b> / доба</div></div></button>`;

  /* ---------- screens ---------- */
  const R = {};

  R.home = () => {
    const h = new Date().getHours();
    const hi = h < 5 ? "Доброї ночі" : h < 12 ? "Доброго ранку" : h < 18 ? "Доброго дня" : "Доброго вечора";
    const me = S.state.me, first = ME().name.split(" ")[0];
    const rc = me.carId && S.state.cars[me.carId] && S.state.cars[me.carId].status === "rented" ? S.car(me.carId) : null;
    const del = me.delivery && !me.delivery.done ? S.car(me.delivery.carId) : null;
    const tm = rc && S.telemetry(rc.id);
    const now = new Date(), d1 = new Date(now.getTime() + 864e5), d2 = new Date(now.getTime() + (1 + ui.days) * 864e5);
    const pop = ["c22", "c12", "c18", "c20", "c27", "c4"].map(S.car);
    return {
      title: "Головна",
      html: `
      <div class="topbar">
        <button class="city-pick" data-act="city">${ic("map-pin")}${ui.city}${ic("chevron-down")}</button>
        <div class="row"><button class="icon-btn" aria-label="Сповіщення" data-go="chat">${ic("bell")}<span class="dot"></span></button></div>
      </div>
      <div class="greet"><p class="lbl" style="margin:0 0 8px">${hi}</p><h1 class="h-xl">${first},<br><span>куди їдемо?</span></h1></div>
      ${del ? `
      <div class="rental-card" data-go="track" role="button" aria-label="Відстежити подачу">
        <div class="rc-top"><div><span class="tag acc" style="background:rgba(255,81,0,.2)">${ic("truck")}Авто в дорозі</span><div class="rc-name" style="margin-top:10px">${del.name}</div><div class="rc-plate">${del.plate}</div></div></div>
        ${S.studio(del, { dark: true, cls: "rc-img" })}
        <div class="rc-bottom"><div><div class="lbl">Прибуде</div><div class="v num" data-live="eta">—</div></div><div><div class="lbl">Адреса</div><div class="v" style="font-size:13px">${HOME_ADDR}</div></div><div><div class="lbl">Водій</div><div class="v" style="font-size:13px">Сергій ★4.9</div></div></div>
      </div>` : rc ? `
      <div class="rental-card" data-go="key" role="button" aria-label="Відкрити цифровий ключ">
        <div class="rc-top"><div><span class="lbl">Ваша оренда</span><div class="rc-name" style="margin-top:8px">${rc.name}</div><div class="rc-plate">${rc.plate}</div></div>
          <span class="tag" style="background:#26262b;color:#F1F0EC;height:max-content">${ic(S.state.cars[rc.id].locked ? "lock" : "lock-open")}${S.state.cars[rc.id].locked ? "Зачинено" : "Відчинено"}</span></div>
        ${S.studio(rc, { dark: true, cls: "rc-img" })}
        <div class="rc-overlay" style="top:auto;bottom:74px"><span class="mini-btn acc">${ic("key-round")}Ключ</span></div>
        <div class="rc-bottom">
          <div><div class="lbl">Залишилось</div><div class="v num" data-live="left">${S.fmtLeft(tm.left)}</div></div>
          <div><div class="lbl">${rc.ev ? "Заряд" : "Паливо"}</div><div class="v num" data-live="fuel">${tm.fuel}%</div></div>
          <div><div class="lbl">Проїхали</div><div class="v num" data-live="km">${tm.km} км</div></div>
        </div>
      </div>` : ""}
      <div class="search-card card">
        <button class="sc-field" style="width:100%;text-align:left" data-act="city">${ic("map-pin")}<div><div class="lbl">Місто видачі</div><div class="v">${ui.city}, ${ui.city === "Київ" ? "вул. Ізюмська 5а" : "офіс 7cars"}</div></div></button>
        <div class="sc-dates">
          <div><div class="lbl">Видача</div><div class="v" style="font-weight:600;font-size:15px;margin-top:2px">${S.fmtDate(d1)}, 10:00</div></div>
          <div><div class="lbl">Повернення</div><div class="v" style="font-weight:600;font-size:15px;margin-top:2px">${S.fmtDate(d2)}, 10:00</div></div>
        </div>
        <button class="btn btn-primary btn-block" data-go="catalog">Підібрати авто ${ic("arrow-right")}</button>
      </div>
      <button class="ai-bar" data-tab-go="ai"><span class="t">Опишіть поїздку — AI підбере авто<small>«Вчотирьох у Карпати на 3 дні»</small></span><span class="spark">${ic("sparkles")}</span></button>

      <div class="sec"><div class="sec-h"><h2 class="h-md">Класи авто</h2><button data-go="catalog">Усі 30 ${ic("chevron-right")}</button></div>
        <div class="hscroll">${S.CLASSES.map(c => `<button class="cls-tile card" data-go="catalog" data-cls="${c.id}"><div class="ci" style="background-image:url('${clsImg(c.id)}')"></div><b>${c.name}</b><small>${c.range.replace("від ", "від ").replace(" до ", "–")}</small></button>`).join("")}</div></div>

      <div class="sec promo">
        <div class="p1"><span class="lbl" style="color:rgba(255,255,255,.8)">Раннє бронювання</span><div><div class="big">−15%</div><small>Бронюйте заздалегідь — знижка до 15%</small></div></div>
        <div class="p2 card">${ic("truck")}<div><b>Подача до дверей</b><small><br>Безкоштовно від 3 діб</small></div></div>
      </div>

      <div class="sec"><div class="sec-h"><h2 class="h-md">Популярне цього тижня</h2></div>
        <div class="hscroll">${pop.map(carTile).join("")}</div></div>

      <div class="sec"><div class="sec-h"><h2 class="h-md">За що нас цінують</h2><span class="lbl">опитування 198 клієнтів</span></div>
        <div class="trust"><div><b>4.5</b><small>рейтинг у Google відгуках</small></div><div><b>94%</b><small>отримали авто за 30 хв</small></div><div><b>100%</b><small>видаємо з повним баком</small></div></div>
      </div>
      <div style="height:20px"></div>`,
      tick(el) {
        const t = rc && S.telemetry(rc.id);
        if (t) { const l = $("[data-live=left]", el); if (l) l.textContent = S.fmtLeft(t.left); const k = $("[data-live=km]", el); if (k) k.textContent = t.km + " км"; const f = $("[data-live=fuel]", el); if (f) f.textContent = t.fuel + "%"; }
        const e = $("[data-live=eta]", el); if (e && del) e.textContent = deliveryEta() + " хв";
      },
    };
  };

  R.catalog = (p) => {
    const cls = p.cls || "all", f = p.f || {};
    let list = S.FLEET.filter(c => cls === "all" || c.cls === cls);
    if (f.auto) list = list.filter(c => c.gear === "Автомат");
    if (f.ev) list = list.filter(c => c.ev);
    if (f.big) list = list.filter(c => AI.seatsOf(c) >= 7);
    if (f.free) list = list.filter(c => S.state.cars[c.id].status === "available");
    const chip = (k, label, icon) => `<button class="chip" data-filter="${k}" aria-pressed="${!!f[k]}">${ic(icon)}${label}</button>`;
    return {
      title: "Автопарк",
      html: `
      <div class="topbar"><h1 class="h-lg">Автопарк</h1><span class="lbl">${list.length} авто</span></div>
      <div class="tabs" role="tablist" style="margin-top:10px">
        <button class="chip" role="tab" data-cls="all" aria-pressed="${cls === "all"}">Усі</button>
        ${S.CLASSES.map(c => `<button class="chip" role="tab" data-cls="${c.id}" aria-pressed="${cls === c.id}">${c.name}</button>`).join("")}
      </div>
      <div class="tabs" style="margin:8px 0 18px">${chip("free", "Вільні зараз", "circle-check")}${chip("auto", "Автомат", "settings-2")}${chip("ev", "Електро", "zap")}${chip("big", "7+ місць", "users")}</div>
      <div class="list">${list.length ? list.map(c => `
        <button class="lcar card" data-go="car" data-id="${c.id}">
          ${S.studio(c, { cls: "ph" })}
          <div class="b"><div class="nm">${c.name}</div><div class="sp">${specLine(c)}</div><div>${availTag(c.id)}</div>
            <div class="pr"><div><small>від </small><b class="num">${S.money(c.prices.month)}</b><small> / доба</small></div><small class="num">1–3 дні: ${S.money(c.prices.d1)}</small></div></div>
        </button>`).join("") : `<div class="empty">Немає авто за цими фільтрами</div>`}</div>`,
      mount(el, entry) {
        $$("[data-cls]", el).forEach(b => b.onclick = () => { entry.params = { ...entry.params, cls: b.dataset.cls }; refreshTop(); });
        $$("[data-filter]", el).forEach(b => b.onclick = () => { const nf = { ...(entry.params.f || {}) }; nf[b.dataset.filter] = !nf[b.dataset.filter]; entry.params = { ...entry.params, f: nf }; refreshTop(); });
      },
    };
  };

  R.car = (p) => {
    const c = S.car(p.id), days = p.days || ui.days, ins = !!p.ins;
    const q = S.quote(c, days, { insurance: ins });
    const T = ins && c.insured ? c.insured : c.prices;
    const tier = S.tierFor(days);
    const premium = c.cls === "premium";
    return {
      title: c.name, noNav: true,
      html: `
      <div class="gal">
        <div class="gbar"><button class="icon-btn glass" data-back aria-label="Назад">${ic("arrow-left")}</button>
          <button class="icon-btn glass" data-act="fav" aria-label="В обране">${ic("heart")}</button></div>
        <div class="track">${(S.cuts(c).length ? S.cuts(c).map((_, i) => S.studio(c, { idx: i, cls: "slide" })) : c.gallery.map(g => `<div style="background-image:url('${g}')" role="img" aria-label="${esc(c.name)}"></div>`)).join("")}</div>
        <div class="dots">${(S.cuts(c).length ? S.cuts(c) : c.gallery).map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>
      </div>
      <div class="detail-head">
        <div class="between"><span class="lbl">${clsName(c.cls)} · ${c.year}</span>${availTag(c.id)}</div>
        <h1 class="h-lg" style="margin-top:10px">${c.name}</h1>
        <div class="row muted" style="font-size:13px;margin-top:8px;gap:14px"><span class="row" style="gap:4px">${ic("star")}${c.rating}</span><span class="mono" style="font-size:12px">${c.plate}</span><a href="${c.url}" target="_blank" rel="noopener" class="muted" style="font-size:12px">на сайті 7cars ↗</a></div>
      </div>
      <div class="specs">
        <div>${ic(c.ev ? "battery-charging" : "fuel")}<b>${c.ev ? c.range + " км" : c.engine + " л"}</b><small>${c.ev ? "запас ходу" : c.fuel.toLowerCase()}</small></div>
        <div>${ic("settings-2")}<b>${c.gear}</b><small>коробка</small></div>
        <div>${ic("users")}<b>${c.seats}</b><small>місць</small></div>
        <div>${ic("gauge")}<b>${c.ev ? "0 л" : c.cons + " л"}</b><small>на 100 км</small></div>
        <div>${ic("snowflake")}<b>Клімат</b><small>кондиціонер</small></div>
        <div>${ic("shield-check")}<b>КАСКО</b><small>+ ОСЦПВ</small></div>
      </div>
      <div class="sec"><div class="sec-h"><h2 class="h-md">Ціна за добу</h2><span class="lbl">чим довше — тим дешевше</span></div>
        <div class="tiers">${[["d1", "1–3 дні"], ["d4", "4–9 днів"], ["d10", "10–29 днів"], ["month", "від місяця"]].map(([k, l]) => `<div class="${k === tier ? "on" : ""}"><small>${l}</small><b class="num">${S.money(T[k])}</b></div>`).join("")}</div>
      </div>
      ${c.insured ? `<div class="card" style="margin:12px 20px 0"><div class="toggle-row"><div style="flex:1"><b style="font-size:14.5px">Додаткова страховка</b><div class="muted" style="font-size:12.5px;margin-top:2px">Застава ${S.money(c.deposit)} → ${S.money(c.insured.deposit)} · від 3 діб</div></div>
        <button class="switch" role="switch" aria-checked="${ins}" aria-label="Додаткова страховка" data-act="ins"></button></div></div>` : ""}
      <div class="sec"><div class="sec-h"><h2 class="h-md">Вже включено</h2></div>
        <div class="incl"><div>${ic("check")}Повний бак при видачі</div><div>${ic("check")}Асистанс 24/7</div><div>${ic("check")}Мити перед поверненням не треба</div><div>${ic("check")}Підміна авто при поломці</div><div>${ic("check")}Без прихованих платежів</div><div>${ic("check")}Цифровий ключ у застосунку</div></div></div>
      <div class="sec"><div class="sec-h"><h2 class="h-md">Умови</h2></div>
        <div class="card" style="margin:0 20px;padding:4px 16px">
          <div class="sum-row" style="padding:12px 0"><span class="muted">Вік водія</span><b>від ${premium ? 25 : 21} років</b></div>
          <div class="sum-row" style="padding:12px 0;border-top:1px solid var(--line)"><span class="muted">Водійський стаж</span><b>від ${premium ? 5 : 2} років</b></div>
          <div class="sum-row" style="padding:12px 0;border-top:1px solid var(--line)"><span class="muted">Застава (холд на картці)</span><b class="num">${S.money(q.deposit)}</b></div>
        </div></div>
      <div style="height:110px"></div>
      <div class="sticky-cta"><div class="price"><b class="num">${S.money(q.per)}</b> <span class="muted" style="font-size:13px">/ доба</span><small class="num">${days} ${days < 5 ? "доби" : "діб"} · ${S.money(q.base)}</small></div>
        <button class="btn btn-primary" style="flex:1" data-go="book" data-id="${c.id}">Забронювати</button></div>`,
      cls: "",
      mount(el, entry) {
        const tr = $(".track", el), dots = $$(".dots i", el);
        tr.addEventListener("scroll", () => { const i = Math.round(tr.scrollLeft / tr.clientWidth); dots.forEach((d, j) => d.classList.toggle("on", i === j)); }, { passive: true });
        const insEl = $("[data-act=ins]", el); if (insEl) insEl.onclick = () => { entry.params = { ...entry.params, ins: !entry.params.ins }; refreshTop(); };
        const fav = $("[data-act=fav]", el); fav.onclick = () => { fav.style.color = "var(--accent)"; toast("Додано в обране", c.name, "heart"); };
        $("[data-go=book]", el).onclick = (e) => { e.stopPropagation(); go("book", { id: c.id, days, ins }); };
      },
    };
  };

  const EXTRAS = [
    { id: "child", name: "Дитяче крісло", price: 5, perDay: true, icon: "baby" },
    { id: "gps", name: "GPS-навігатор", price: 3, perDay: true, icon: "navigation" },
    { id: "driver2", name: "Другий водій", price: 5, perDay: true, icon: "user-plus" },
    { id: "chauffeur", name: "Авто з водієм", price: 40, perDay: true, icon: "id-card" },
  ];
  R.book = (p) => {
    const c = S.car(p.id);
    const b = p.b || (p.b = { days: p.days || 3, mode: "delivery", addr: HOME_ADDR, extras: [], ins: !!p.ins, pay: "apple", early: false, diia: false });
    const start = new Date(Date.now() + 864e5); start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + b.days * 864e5);
    b.early = (start - Date.now()) > 0 && b.days >= 1 && p.early;
    const q = S.quote(c, b.days, { insurance: b.ins, extras: EXTRAS.filter(e => b.extras.includes(e.id)), delivery: b.mode === "delivery" });
    const nextTier = b.days < 4 ? 4 : b.days < 10 ? 10 : b.days < 30 ? 30 : null;
    const nextPer = nextTier && S.dayPrice(c, nextTier, b.ins);
    return {
      title: "Бронювання", noNav: true,
      html: `
      <div class="topbar"><button class="icon-btn" data-back aria-label="Назад">${ic("arrow-left")}</button><b>Бронювання</b><span style="width:44px"></span></div>
      <div class="card row" style="margin:14px 20px 16px;padding:10px;border-radius:var(--r-lg)">
        ${S.studio(c, { cls: "thumb-s", style: "width:96px;height:62px;border-radius:12px;flex:none" })}
        <div style="flex:1"><b style="font-size:15px">${c.name}</b><div class="muted" style="font-size:12.5px;margin-top:3px">${clsName(c.cls)} · ${c.gear} · ${c.seats} місць</div></div>
      </div>

      <div class="step card"><div class="step-h"><span class="n">1</span><b>Термін оренди</b></div>
        <div class="between"><div class="stepper"><button data-act="d-" aria-label="Менше днів">${ic("minus")}</button><span class="v num">${b.days}</span><button data-act="d+" aria-label="Більше днів">${ic("plus")}</button></div>
          <div style="text-align:right;font-size:13px"><div>${S.fmtDate(start)}, 10:00</div><div class="muted">→ ${S.fmtDate(end)}, 10:00</div></div></div>
        ${nextTier && nextPer < q.per ? `<p class="hint">Ще ${nextTier - b.days} ${nextTier - b.days === 1 ? "день" : "дні"} — і ціна <b>${S.money(nextPer)}/доба</b> замість ${S.money(q.per)}</p>` : q.saved ? `<p class="hint">Економія за довгий тариф: <b>${S.money(q.saved)}</b></p>` : ""}
      </div>

      <div class="step card" style="margin-top:12px"><div class="step-h"><span class="n">2</span><b>Як отримати авто</b></div>
        <button class="radio-card" role="radio" aria-checked="${b.mode === "delivery"}" data-mode="delivery">${ic("truck")}<span class="t">Доставка за адресою<small>${b.days >= 3 ? "Безкоштовно від 3 діб · відстеження на карті" : "$15 · безкоштовно від 3 діб"}</small></span></button>
        ${b.mode === "delivery" ? `<input class="field" value="${esc(b.addr)}" aria-label="Адреса доставки" data-act="addr">` : ""}
        <button class="radio-card" role="radio" aria-checked="${b.mode === "office"}" data-mode="office">${ic("building-2")}<span class="t">Забрати в офісі<small>Київ, вул. Ізюмська 5а · 8:00–20:00</small></span></button>
      </div>

      <div class="step card" style="margin-top:12px"><div class="step-h"><span class="n">3</span><b>Додатково</b></div>
        ${EXTRAS.map(e => `<div class="opt"><span class="ic">${ic(e.icon)}</span><span class="t">${e.name}<small class="num">${S.money(e.price)} / доба</small></span><button class="check" role="checkbox" aria-label="${e.name}" aria-checked="${b.extras.includes(e.id)}" data-extra="${e.id}">${ic("check")}</button></div>`).join("")}
        ${c.insured ? `<div class="opt"><span class="ic">${ic("shield-plus")}</span><span class="t">Додаткова страховка<small>Застава лише ${S.money(c.insured.deposit)}</small></span><button class="check" role="checkbox" aria-label="Додаткова страховка" aria-checked="${b.ins}" data-act="ins">${ic("check")}</button></div>` : ""}
      </div>

      <div class="step card" style="margin-top:12px"><div class="step-h"><span class="n">4</span><b>Документи</b></div>
        <button class="diia" data-act="diia"><span class="dl">Дія</span><span class="t" style="flex:1;font-size:14px;line-height:1.3">Поділитися з Дії в один тап<small class="muted" style="display:block;font-size:12px">Паспорт, ІПН і посвідчення водія — без фото й копій</small></span><span class="tag acc">Інтеграція</span></button>
        <p class="hint" style="margin-top:10px">Поки що — фото документів або в офісі при видачі.</p>
      </div>

      <div class="step card" style="margin-top:12px"><div class="step-h"><span class="n">5</span><b>Оплата</b></div>
        <div class="pay-methods">
          <button role="radio" aria-checked="${b.pay === "apple"}" data-pay="apple">${ic("apple")}Pay</button>
          <button role="radio" aria-checked="${b.pay === "google"}" data-pay="google"><span style="font-weight:700">G</span>Pay</button>
          <button role="radio" aria-checked="${b.pay === "card"}" data-pay="card">${ic("credit-card")}•• 2468</button>
        </div>
        <div style="margin-top:14px">
          <div class="sum-row"><span class="muted num">${S.money(q.per)} × ${b.days} ${b.days < 5 ? "доби" : "діб"}</span><span class="num">${S.money(q.base)}</span></div>
          ${q.saved ? `<div class="sum-row"><span class="muted">Знижка за тривалість</span><span class="neg num">вже враховано −${S.money(q.saved)}</span></div>` : ""}
          ${q.extras ? `<div class="sum-row"><span class="muted">Додаткові опції</span><span class="num">${S.money(q.extras)}</span></div>` : ""}
          <div class="sum-row"><span class="muted">Доставка</span><span class="num">${b.mode === "delivery" ? (q.delivery ? S.money(q.delivery) : "безкоштовно") : "—"}</span></div>
          <div class="sum-row total"><span>До сплати</span><span class="num">${S.money(q.total)}</span></div>
          <div class="sum-row" style="font-size:12.5px"><span class="muted">Застава — холд на картці, не списується</span><span class="muted num">${S.money(q.deposit)}</span></div>
        </div>
      </div>
      <div style="height:110px"></div>
      <div class="sticky-cta"><button class="btn btn-primary btn-block" data-act="pay">${b.pay === "apple" ? ic("apple") : ic("lock")}Оплатити ${S.money(q.total)}</button></div>`,
      mount(el, entry) {
        const B = entry.params.b;
        const re = () => refreshTop();
        $("[data-act='d-']", el).onclick = () => { B.days = Math.max(1, B.days - 1); re(); };
        $("[data-act='d+']", el).onclick = () => { B.days = Math.min(45, B.days + 1); re(); };
        $$("[data-mode]", el).forEach(x => x.onclick = () => { B.mode = x.dataset.mode; re(); });
        $$("[data-extra]", el).forEach(x => x.onclick = () => { const id = x.dataset.extra; B.extras = B.extras.includes(id) ? B.extras.filter(i => i !== id) : B.extras.concat(id); re(); });
        $$("[data-pay]", el).forEach(x => x.onclick = () => { B.pay = x.dataset.pay; re(); });
        const ins = $("[data-act=ins]", el); if (ins) ins.onclick = () => { B.ins = !B.ins; re(); };
        const addr = $("[data-act=addr]", el); if (addr) addr.oninput = () => { B.addr = addr.value; };
        $("[data-act=diia]", el).onclick = () => toast("Дія — у планах інтеграції", "Документи підтягуватимуться в один тап", "file-check");
        $("[data-act=pay]", el).onclick = () => pay(c, B, q);
      },
    };
  };

  function pay(c, B, q) {
    const ov = document.createElement("div"); ov.className = "processing";
    const steps = [B.pay === "apple" ? "Підтвердження Apple Pay…" : B.pay === "google" ? "Підтвердження Google Pay…" : "Оплата карткою…", "Холдуємо заставу " + S.money(q.deposit) + "…", "Формуємо електронний договір…"];
    ov.innerHTML = `<div><div class="spinner"></div><b data-s style="font-size:16px">${steps[0]}</b><p class="muted" style="font-size:13px;margin-top:6px">Безпечний платіж · 3-D Secure</p></div>`;
    wrap.appendChild(ov);
    let i = 0; const iv = setInterval(() => { i++; if (i < steps.length) $("[data-s]", ov).textContent = steps[i]; }, 650);
    setTimeout(() => {
      clearInterval(iv);
      const now = Date.now();
      const from = new Date(now + 864e5); from.setHours(10, 0, 0, 0);
      const bid = "B-" + (24122 + S.state.bookings.length);
      S.state.bookings.unshift({ id: bid, car: c.id, client: S.state.me.clientId, from: B.mode === "delivery" ? now : from.getTime(), to: (B.mode === "delivery" ? now : from.getTime()) + B.days * 864e5, total: q.total, status: "confirmed", src: "Застосунок", days: B.days, mode: B.mode, addr: B.addr });
      if (B.mode === "delivery") {
        S.state.cars[c.id].status = "delivering"; S.state.cars[c.id].client = S.state.me.clientId;
        S.state.me.delivery = { carId: c.id, start: now, dur: 75000, days: B.days, path: null, done: false, addr: B.addr, bid };
      } else { S.state.cars[c.id].status = "reserved"; S.state.cars[c.id].client = S.state.me.clientId; S.state.cars[c.id].pickup = from.getTime(); }
      S.logEvent(`Нове бронювання ${bid}: ${c.name}, ${B.days} д, ${S.money(q.total)} — ${ME().short}`, "booking", c.id);
      S.addMsg(c.id, "system", `Бронювання ${bid} підтверджено. Оплачено ${S.money(q.total)}, застава ${S.money(q.deposit)} — холд.`);
      S.bus.post({ type: "booking", id: bid, carId: c.id });
      ov.remove();
      go("success", { bid, id: c.id });
      if (B.mode === "delivery") preloadDeliveryPath();
    }, 2100);
  }

  R.success = (p) => {
    const c = S.car(p.id), bk = S.state.bookings.find(b => b.id === p.bid);
    const dl = bk.mode === "delivery";
    return {
      title: "Підтверджено", noNav: true,
      html: `<div class="success">
        <div class="ring"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
        <h1 class="h-lg" style="margin-top:26px">Авто ваше!</h1>
        <p class="muted" style="margin:10px 0 0;font-size:14.5px;line-height:1.5">${dl ? "Готуємо " + c.name + " до подачі. Ви побачите на карті, як воно їде до вас." : "Чекаємо вас в офісі 7cars на Ізюмській, 5а."}</p>
        <div class="ticket card">
          <div class="between"><span class="lbl">Бронювання</span><b class="mono">${bk.id}</b></div>
          <div class="between"><span class="muted">${c.name}</span><span class="mono" style="font-size:12px">${c.plate}</span></div>
          <div class="between"><span class="muted">Термін</span><span>${bk.days} ${bk.days < 5 ? "доби" : "діб"}</span></div>
          <div class="between"><span class="muted">${dl ? "Адреса" : "Видача"}</span><span>${dl ? esc(bk.addr) : S.fmtDate(bk.from) + ", 10:00"}</span></div>
          <div class="between" style="border-top:1px solid var(--line);padding-top:10px;margin-top:12px"><b>Сплачено</b><b class="num">${S.money(bk.total)}</b></div>
        </div>
        <div class="stack" style="gap:10px;width:100%;margin-top:22px">
          ${dl ? `<button class="btn btn-primary btn-block" data-go="track">${ic("navigation")}Відстежувати подачу</button>` : ""}
          <button class="btn btn-ghost btn-block" data-tab-go="home">На головну</button>
        </div></div>`,
    };
  };

  /* ---------- delivery tracking ---------- */
  const OFFICE_LL = S.OFFICES[0].ll;
  async function preloadDeliveryPath() {
    const d = S.state.me.delivery; if (!d || d.path) return;
    const got = await S.osrm([OFFICE_LL, HOME_LL]);
    const pts = got ? got.pts : [OFFICE_LL, [50.4300, 30.5400], [50.4390, 30.5300], HOME_LL];
    d.path = pts; d.routeMin = got ? Math.round(got.min) : 14; d.routeKm = got ? got.km.toFixed(1) : "4.6";
    S.save(); S.bus.post({ type: "delivery" });
  }
  function deliveryProgress() {
    const d = S.state.me.delivery; if (!d) return 1;
    return Math.min(1, (Date.now() - d.start) / d.dur);
  }
  function deliveryEta() {
    const d = S.state.me.delivery; if (!d) return 0;
    const p = deliveryProgress(), drive = Math.max(0, (p - 0.2) / 0.8);
    return Math.max(0, Math.ceil((d.routeMin || 14) * (p < 0.2 ? 1 : 1 - drive) + (p < 0.2 ? 6 * (1 - p / 0.2) : 0)));
  }
  R.track = () => {
    const d = S.state.me.delivery;
    if (!d) return { title: "Подача", noNav: true, html: `<div class="topbar"><button class="icon-btn" data-back>${ic("arrow-left")}</button></div><div class="empty">Немає активної подачі.<br><br><button class="btn btn-primary" data-go="catalog">Забронювати авто</button></div>` };
    const c = S.car(d.carId);
    return {
      title: "Подача авто", noNav: true, cls: "map-screen",
      html: `<div class="map" id="trackMap"></div>
      <div class="map-top"><button class="icon-btn" data-back aria-label="Назад">${ic("arrow-left")}</button><span class="mode-pill"><i></i>Наживо</span></div>
      <div class="sheet" id="trackSheet">
        <div class="grab"></div>
        <div class="eta"><div><div class="lbl" data-ph>Готуємо авто</div><div class="big num"><span data-eta>—</span><small>хв</small></div></div>
          ${S.studio(c, { cls: "thumb-s", style: "width:128px;height:76px;border-radius:14px;flex:none" })}</div>
        <div class="progress-steps">${[0, 1, 2, 3].map(() => `<div><i></i></div>`).join("")}</div>
        <div class="progress-labels"><span>Підготовка</span><span>Перевірка</span><span>В дорозі</span><span>На місці</span></div>
        <div class="driver"><div class="avatar">СП</div><div style="flex:1;line-height:1.3"><b style="font-size:14.5px">Сергій П.</b><div class="muted" style="font-size:12.5px">Водій-доставник · ★ 4.9 · ${c.name}</div></div>
          <button class="icon-btn" aria-label="Чат" data-go="chat" data-car="${c.id}">${ic("message-circle")}</button><button class="icon-btn" aria-label="Подзвонити" data-act="call">${ic("phone")}</button></div>
        <div data-done style="display:none;margin-top:16px"><button class="btn btn-primary btn-block" data-go="checkin">${ic("scan-line")}Авто на місці — почати огляд</button></div>
      </div>`,
      mount(el, entry) {
        const map = L.map($("#trackMap", el), { zoomControl: false, attributionControl: false }).setView([50.435, 30.535], 14);
        tiles(map);
        const meM = L.marker(HOME_LL, { icon: L.divIcon({ className: "", html: `<div class="pin-me"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);
        const carM = L.marker(OFFICE_LL, { icon: L.divIcon({ className: "", html: `<div style="position:relative"><span class="pulse"></span><div class="car-marker">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>'}</div></div>`, iconSize: [38, 38], iconAnchor: [19, 19] }) }).addTo(map);
        let line, done, path;
        const ensure = () => {
          const dd = S.state.me.delivery; if (!dd || !dd.path || path) return;
          const one = dd.path;
          path = (() => { const cum = [0]; for (let i = 1; i < one.length; i++) cum.push(cum[i - 1] + S.hav(one[i - 1], one[i])); return { pts: one, cum, len: cum[cum.length - 1] }; })();
          line = L.polyline(one, { color: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#FF5100", weight: 5, opacity: .9 }).addTo(map);
          map.fitBounds(line.getBounds(), { paddingTopLeft: [30, 90], paddingBottomRight: [30, 300] });
        };
        preloadDeliveryPath().then(() => { if (maps.includes(map)) ensure(); }); ensure();
        entry.tick = () => {
          ensure();
          const p = deliveryProgress(), dd = S.state.me.delivery; if (!dd) return;
          const phase = p < 0.12 ? 0 : p < 0.2 ? 1 : p < 1 ? 2 : 3;
          $$(".progress-steps i", el).forEach((x, i) => x.style.transform = `scaleX(${i < phase ? 1 : i === phase ? (phase === 0 ? p / 0.12 : phase === 1 ? (p - .12) / .08 : phase === 2 ? (p - .2) / .8 : 1) : 0})`);
          $$(".progress-labels span", el).forEach((x, i) => x.classList.toggle("on", i === phase));
          $("[data-ph]", el).textContent = ["Готуємо авто: повний бак, мийка", "Перевірка й фото-фіксація", "Прибуде через", "Авто на місці"][phase];
          $("[data-eta]", el).textContent = deliveryEta();
          if (path && phase >= 2) {
            const f = Math.min(1, (p - 0.2) / 0.8); const pt = S.pointAt(path, f * path.len * 0.999);
            carM.setLatLng(pt.ll);
          }
          if (phase === 3 && !done) { done = true; $("[data-done]", el).style.display = ""; carM.setLatLng(HOME_LL); if (!dd.arrivedNotified) { dd.arrivedNotified = true; S.save(); toast("Авто на місці", `${c.name} чекає біля ${dd.addr}`, "map-pin"); } }
        };
        entry.tick();
        entry.cleanup = () => { maps = maps.filter(m => m !== map); map.stop(); map.remove(); };
        $("[data-act=call]", el).onclick = () => toast("Дзвінок водію", "У демо дзвінок не здійснюється", "phone");
        setTimeout(() => { if (maps.includes(map)) map.invalidateSize(); }, 400);
      },
    };
  };

  /* ---------- check-in (AI photo inspection) ---------- */
  R.checkin = () => {
    const d = S.state.me.delivery; const c = S.car(d ? d.carId : S.state.me.carId);
    const sides = ["Спереду", "Ззаду", "Ліворуч", "Праворуч"];
    return {
      title: "Огляд авто", noNav: true,
      html: `<div class="topbar"><button class="icon-btn" data-back aria-label="Назад">${ic("arrow-left")}</button><b>Огляд при видачі</b><span style="width:44px"></span></div>
      <div class="pad" style="margin-top:12px"><h1 class="h-lg">Сфотографуйте авто з 4 сторін</h1><p class="muted" style="font-size:14px;line-height:1.5;margin:10px 0 0">AI порівняє фото з останнім оглядом і зафіксує стан. Це захищає і вас, і нас від суперечок при поверненні.</p></div>
      <div class="cam-grid">${sides.map((s, i) => `<button class="cam" data-cam="${i}" aria-label="Фото: ${s}">${ic("camera")}<span class="cl" style="color:var(--muted)">${s}</span></button>`).join("")}</div>
      <div data-verdict></div>
      <div style="height:110px"></div>
      <div class="sticky-cta"><button class="btn btn-primary btn-block" data-act="sign" disabled>${ic("file-signature")}Підписати акт і отримати ключ</button></div>`,
      mount(el) {
        let n = 0;
        $$("[data-cam]", el).forEach(b => b.onclick = () => {
          if (b.classList.contains("done")) return;
          const i = +b.dataset.cam;
          b.classList.add("done"); b.style.backgroundImage = `url('${c.gallery[i % c.gallery.length]}')`;
          b.innerHTML = `<span class="scanline"></span><span class="cl">${sides[i]}</span><span class="ck">${ic("check")}</span>`; icons();
          try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
          if (++n === 4) setTimeout(() => {
            $("[data-verdict]", el).innerHTML = `<div class="ai-verdict card">${ic("sparkles")}<div style="font-size:13.5px;line-height:1.5"><b>Нових пошкоджень не виявлено</b><br><span class="muted">Подряпина на задньому бампері вже є в журналі авто з 12.10.2026 — до вас претензій не буде. Пробіг ${S.telemetry(c.id).odo.toLocaleString("uk-UA")} км, ${c.ev ? "заряд" : "бак"} 100%.</span></div></div>`;
            icons(); $("[data-act=sign]", el).disabled = false;
          }, 900);
        });
        $("[data-act=sign]", el).onclick = () => {
          const st = S.state.cars[c.id]; const days = (d && d.days) || 3;
          Object.assign(st, { status: "rented", client: S.state.me.clientId, start: Date.now(), end: Date.now() + days * 864e5, route: "kyiv_center", off: 3, fuel0: 100, locked: true });
          S.state.me.carId = c.id; if (S.state.me.delivery) S.state.me.delivery.done = true; S.state.me.delivery = null;
          S.logEvent(`${ME().short} отримав(ла) ${c.name}. Акт огляду підписано, 4 фото`, "ok", c.id);
          S.addMsg(c.id, "system", "Акт огляду підписано. 4 фото збережено. Гарної дороги!");
          go("key");
          setTimeout(() => toast("Цифровий ключ активовано", "Утримуйте кнопку, щоб відчинити авто", "key-round"), 500);
        };
      },
    };
  };

  /* ---------- digital key ---------- */
  R.key = () => {
    const id = S.state.me.carId, st = id && S.state.cars[id];
    if (!st || st.status !== "rented") return {
      title: "Ключ", html: `<div class="topbar"><h1 class="h-lg">Ключ</h1></div><div class="empty">${ic("key-round")}<p>Цифровий ключ з'явиться тут після видачі авто.</p><button class="btn btn-primary" data-go="catalog">Обрати авто</button></div>`,
    };
    const c = S.car(id), t = S.telemetry(id), total = st.end - st.start;
    const rng = c.ev ? Math.round(c.range * t.fuel / 100) : Math.round(t.fuel / 100 * 50 / (parseFloat(c.cons) || 7) * 100);
    const ble = S.state.me.keyMode === "ble";
    const temp = st.temp || 21;
    return {
      title: "Цифровий ключ",
      html: `<div class="topbar"><div><div class="lbl">Цифровий ключ</div><b style="font-size:17px">${c.name}</b></div>
        <button class="mode-pill ${ble ? "ble" : ""}" data-act="mode" aria-label="Режим зв'язку з авто"><i></i>${ble ? ic("bluetooth") + "Bluetooth · без інтернету" : ic("wifi") + "Онлайн"}</button></div>
      <div class="key-hero"><div class="floor"></div>${S.studio(c, { bare: true, cls: "kh" })}</div>
      <div class="kstats">
        <div><b class="num" data-k="fuel">${t.fuel}%</b><small>${c.ev ? "заряд" : "паливо"}</small></div>
        <div><b class="num" data-k="range">${rng}</b><small>км запас ходу</small></div>
        <div><b class="num" data-k="km">${t.km}</b><small>км за оренду</small></div>
      </div>
      <div class="unlock-wrap">
        <button class="unlock ${st.locked ? "" : "open"}" data-act="unlock" aria-label="${st.locked ? "Утримуйте, щоб відчинити" : "Утримуйте, щоб зачинити"}">
          <svg class="ring" viewBox="0 0 146 146"><circle class="bg" cx="73" cy="73" r="70"/><circle class="fg" cx="73" cy="73" r="70"/></svg>
          <i data-lucide="${st.locked ? "lock" : "lock-open"}" class="ic"></i>
        </button>
        <div class="unlock-label">${st.locked ? "Утримуйте, щоб відчинити" : "Відчинено · утримуйте, щоб зачинити"}<small class="mono">${c.plate}</small></div>
      </div>
      <div class="timer card" data-go="extend" role="button">
        <svg class="tr" viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" stroke="var(--line)"/><circle cx="28" cy="28" r="24" stroke="var(--accent)" stroke-linecap="round" stroke-dasharray="150.8" stroke-dashoffset="${150.8 * (1 - Math.max(0, t.left) / total)}" data-k="ring"/></svg>
        <div style="flex:1"><div class="lbl">До кінця оренди</div><b class="num" style="font-size:22px;letter-spacing:-.03em" data-k="left">${S.fmtLeft(t.left)}</b><div class="muted" style="font-size:12px">повернення ${S.fmtDate(st.end, { day: "numeric", month: "long" })}, ${S.fmtTime(st.end)}</div></div>
        <span class="btn btn-ink" style="height:40px;padding:0 16px;font-size:13px">Продовжити</span>
      </div>
      <div class="ktiles">
        <button class="ktile card" data-act="find"><span class="ic">${ic("lightbulb")}</span><b>Знайти авто<small>Фари і сигнал</small></b></button>
        <button class="ktile card ${st.trunk ? "on" : ""}" data-act="trunk"><span class="ic">${ic("package-open")}</span><b>Багажник<small>${st.trunk ? "Відчинено" : "Зачинено"}</small></b></button>
        <div class="ktile card climate"><span class="ic" style="background:var(--accent-soft);color:var(--accent)">${ic("thermometer")}</span><div style="flex:1"><div class="lbl">Клімат</div><span class="t num">${temp}°</span></div>
          <button class="icon-btn" data-act="t-" aria-label="Холодніше">${ic("minus")}</button><button class="icon-btn" data-act="t+" aria-label="Тепліше">${ic("plus")}</button></div>
        <button class="ktile card" data-go="chat"><span class="ic">${ic("message-circle")}</span><b>Чат з менеджером<small>Відповідь ~2 хв</small></b></button>
        <button class="ktile card" data-act="sos"><span class="ic">${ic("life-buoy")}</span><b>Допомога на дорозі<small>Асистанс 24/7</small></b></button>
      </div>
      <div style="height:20px"></div>`,
      tick(el) {
        const t = S.telemetry(id); if (!t) return; const st2 = S.state.cars[id]; if (!st2 || st2.status !== "rented") return;
        const set = (k, v) => { const x = $(`[data-k=${k}]`, el); if (x) x.textContent = v; };
        set("fuel", t.fuel + "%"); set("km", t.km); set("left", S.fmtLeft(t.left));
        const r = $("[data-k=ring]", el); if (r) r.setAttribute("stroke-dashoffset", 150.8 * (1 - Math.max(0, t.left) / (st2.end - st2.start)));
      },
      mount(el) {
        const btn = $("[data-act=unlock]", el), fg = $(".fg", btn);
        let raf, t0;
        const HOLD = 650;
        const reset = () => { cancelAnimationFrame(raf); btn.classList.remove("pressing"); fg.style.transition = "stroke-dashoffset .3s"; fg.style.strokeDashoffset = 440; };
        const step = (ts) => {
          if (!t0) t0 = ts; const f = Math.min(1, (ts - t0) / HOLD);
          fg.style.transition = "none"; fg.style.strokeDashoffset = 440 * (1 - f);
          if (f < 1) raf = requestAnimationFrame(step); else done();
        };
        const done = () => {
          btn.classList.remove("pressing");
          const s = S.state.cars[id]; s.locked = !s.locked;
          try { navigator.vibrate && navigator.vibrate([30, 40, 30]); } catch (e) {}
          S.logEvent(`${ME().short} ${s.locked ? "зачинив" : "відчинив"} ${c.name} через ${S.state.me.keyMode === "ble" ? "Bluetooth" : "застосунок"}`, s.locked ? "info" : "key", id);
          S.save(); S.bus.post({ type: "key", carId: id, locked: s.locked });
          refreshTop();
        };
        btn.addEventListener("pointerdown", e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); t0 = 0; btn.classList.add("pressing"); raf = requestAnimationFrame(step); });
        ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, reset));
        btn.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); done(); } });
        $("[data-act=mode]", el).onclick = () => {
          S.state.me.keyMode = S.state.me.keyMode === "ble" ? "online" : "ble"; S.save();
          toast(S.state.me.keyMode === "ble" ? "Bluetooth-ключ" : "Онлайн-ключ", S.state.me.keyMode === "ble" ? "Ключ працює навіть без мобільного зв'язку та під час відключень" : "Команди йдуть через сервер 7cars", S.state.me.keyMode === "ble" ? "bluetooth" : "wifi");
          refreshTop();
        };
        $("[data-act=find]", el).onclick = () => { toast("Авто посигналило", "Фари блимнули 3 рази", "lightbulb"); S.logEvent(`${ME().short}: «Знайти авто» (${c.name})`, "info", id); S.save(); };
        $("[data-act=trunk]", el).onclick = () => { const s = S.state.cars[id]; s.trunk = !s.trunk; S.save(); refreshTop(); };
        $("[data-act='t-']", el).onclick = () => { const s = S.state.cars[id]; s.temp = (s.temp || 21) - 0.5; S.save(); refreshTop(); };
        $("[data-act='t+']", el).onclick = () => { const s = S.state.cars[id]; s.temp = (s.temp || 21) + 0.5; S.save(); refreshTop(); };
        $("[data-act=sos]", el).onclick = () => modal(`<h2 class="h-md">Допомога на дорозі</h2><p class="muted" style="font-size:14px;line-height:1.5">Асистанс 7cars працює цілодобово. Якщо авто зламалося — підмінимо його.</p>
          <div class="stack" style="gap:10px;margin-top:14px"><a class="btn btn-primary btn-block" href="tel:+380675217877">${ic("phone")}+38 (067) 521 78 77</a><button class="btn btn-ghost btn-block" data-x>${ic("map-pin")}Надіслати геопозицію менеджеру</button></div>`,
          (m, close) => { $("[data-x]", m).onclick = () => { close(); S.addMsg(id, "client", "📍 Надсилаю геопозицію: " + S.telemetry(id).ll.map(x => x.toFixed(5)).join(", ")); toast("Геопозицію надіслано", "Менеджер уже бачить вас на карті", "map-pin"); }; });
      },
    };
  };
  function extendSheet() {
    const id = S.state.me.carId, c = S.car(id), st = S.state.cars[id];
    const curDays = Math.max(1, Math.round((st.end - st.start) / 864e5));
    const opts = [1, 2, 3, 7].map(n => { const tot = S.quote(c, curDays + n).total - S.quote(c, curDays).total; return { n, tot: Math.max(tot, S.dayPrice(c, curDays + n) * n * .8) }; });
    modal(`<h2 class="h-md">Продовжити оренду</h2><p class="muted" style="font-size:13.5px;margin:6px 0 14px">Ціна перерахована за довшим тарифом — що довше, то дешевша доба.</p>
      <div class="stack" style="gap:8px">${opts.map(o => `<button class="radio-card" data-n="${o.n}">${ic("calendar-plus")}<span class="t">+${o.n} ${o.n === 1 ? "доба" : o.n < 5 ? "доби" : "діб"}<small>до ${S.fmtDate(st.end + o.n * 864e5, { day: "numeric", month: "long" })}</small></span><b class="num">${S.money(o.tot)}</b></button>`).join("")}</div>`,
      (m, close) => $$("[data-n]", m).forEach(b => b.onclick = () => {
        const n = +b.dataset.n; st.end += n * 864e5;
        S.logEvent(`${ME().short} продовжив(ла) ${c.name} на ${n} д`, "booking", id);
        S.addMsg(id, "system", `Оренду продовжено на ${n} ${n === 1 ? "добу" : "доби"}. Нове повернення: ${S.fmtDate(st.end, { day: "numeric", month: "long" })}, ${S.fmtTime(st.end)}.`);
        close(); toast("Оренду продовжено", `+${n} ${n === 1 ? "доба" : "доби"} · ${S.money(opts.find(o => o.n === n).tot)}`, "calendar-check"); refreshTop();
      }));
  }

  /* ---------- AI assistant ---------- */
  const aiLog = [];
  R.ai = (p) => ({
    title: "AI-помічник", cls: "chat-screen",
    html: `<div class="chat-head"><div class="avatar" style="background:var(--accent);color:#fff">${ic("sparkles")}</div><div class="t"><b>AI-помічник 7cars</b><small>Знає всі 30 авто парку, ціни й умови оренди</small></div>
        <button class="icon-btn" data-act="clear" aria-label="Почати спочатку">${ic("rotate-ccw")}</button></div>
      <div class="msgs" id="aiMsgs">
        <div class="ai-hero"><div class="orb">${ic("sparkles")}</div><h1 class="h-lg">Опишіть поїздку —<br>я підберу авто</h1><p class="muted" style="font-size:14px;line-height:1.5;margin:10px 0 0">Куди їдете, скільки вас, на скільки днів і бюджет. Порахую точну ціну з урахуванням знижки за тривалість.</p></div>
      </div>
      <div class="suggest" id="aiSug">${["Вчотирьох у Карпати на 3 дні до $70", "Статусне авто на весілля на 2 дні", "Найдешевше на тиждень з автоматом", "Електромобіль по Києву на вихідні", "Переїзд, нас 8 людей", "Яка застава?"].map(s => `<button>${s}</button>`).join("")}</div>
      <form class="composer" id="aiForm"><input id="aiIn" placeholder="Напишіть або продиктуйте запит…" autocomplete="off" aria-label="Запит до AI"><button class="send" aria-label="Надіслати">${ic("arrow-up")}</button></form>`,
    noNav: false,
    mount(el) {
      const box = $("#aiMsgs", el), inp = $("#aiIn", el);
      aiLog.forEach(m => box.insertAdjacentHTML("beforeend", m)); icons(); box.scrollTop = box.scrollHeight;
      const push = (html) => { aiLog.push(html); box.insertAdjacentHTML("beforeend", html); icons(); box.scrollTop = box.scrollHeight; bindCars(); };
      const bindCars = () => $$("[data-aicar]", box).forEach(b => b.onclick = () => go("car", { id: b.dataset.aicar, days: +b.dataset.days }));
      bindCars();
      const send = (q) => {
        if (!q.trim()) return; inp.value = "";
        push(`<div class="msg me">${esc(q)}</div>`);
        const think = document.createElement("div"); think.className = "msg them wide"; think.style.padding = "8px 14px";
        think.innerHTML = `<div class="ai-steps"></div><div class="typing"><i></i><i></i><i></i></div>`; box.appendChild(think); box.scrollTop = box.scrollHeight;
        const res = AI.ask(q);
        const steps = res.cars ? ["Розбираю запит", `Перевіряю ${S.FLEET.length} авто в парку`, "Звіряю доступність на дати", "Рахую ціну за тарифом тривалості"] : ["Шукаю в умовах оренди 7cars"];
        steps.forEach((s, i) => setTimeout(() => { $(".ai-steps", think).insertAdjacentHTML("beforeend", `<div>${ic("check")}${s}</div>`); icons(); box.scrollTop = box.scrollHeight; }, 260 * (i + 1)));
        setTimeout(() => {
          think.remove();
          let html = `<div class="msg them wide">${esc(res.text)}`;
          if (res.cars) html += `<div class="ai-cars">${res.cars.map(r => `<button class="ai-car" data-aicar="${r.car.id}" data-days="${res.days}">
              ${S.studio(r.car, { cls: "ph" })}
              <div><b>${r.car.name}</b><small>${r.car.seats} місць · ${r.car.gear} · ${r.car.fuel}</small><div style="margin-top:4px">${availTag(r.car.id)}</div></div>
              <div class="p"><b class="num">${S.money(r.total)}</b><br>${S.money(r.per)}/доба</div>
              ${r.why.length ? `<div class="why">${ic("sparkles")}<span>${r.why.join(" · ")}</span></div>` : ""}</button>`).join("")}</div>`;
          html += `</div>`;
          push(html);
          if (res.suggest) $("#aiSug", el).innerHTML = res.suggest.map(s => `<button>${s}</button>`).join("");
          bindSug();
        }, 260 * (steps.length + 1) + 300);
      };
      const bindSug = () => $$("#aiSug button", el).forEach(b => b.onclick = () => send(b.textContent));
      bindSug();
      $("#aiForm", el).onsubmit = e => { e.preventDefault(); send(inp.value); };
      $("[data-act=clear]", el).onclick = () => { aiLog.length = 0; AI.reset(); refreshTop(); };
      R.ai._send = send;
    },
  });

  /* ---------- chat with manager ---------- */
  R.chat = (p) => {
    const carId = p.car || (S.state.me.delivery && S.state.me.delivery.carId) || S.state.me.carId;
    const c = S.car(carId);
    return {
      title: "Чат", noNav: true, cls: "chat-screen",
      html: `<div class="chat-head"><button class="icon-btn" data-back aria-label="Назад">${ic("arrow-left")}</button><div class="avatar">АН</div><div class="t"><b>Анна · менеджер 7cars</b><small><span style="color:var(--ok)">●</span> онлайн · чат по ${c.name}, ${c.plate}</small></div><a class="icon-btn" href="tel:+380675217877" aria-label="Подзвонити">${ic("phone")}</a></div>
      <div class="msgs" id="cMsgs"></div>
      <div class="suggest" id="cSug">${["Де найближча зарядка/АЗС?", "Можна повернути в аеропорту?", "Хочу продовжити оренду", "Загорілась лампочка"].map(s => `<button>${s}</button>`).join("")}</div>
      <form class="composer" id="cForm"><input id="cIn" placeholder="Повідомлення" autocomplete="off" aria-label="Повідомлення менеджеру"><button class="send" aria-label="Надіслати">${ic("send")}</button></form>`,
      mount(el, entry) {
        const box = $("#cMsgs", el), inp = $("#cIn", el);
        const draw = () => {
          const list = S.state.chats[carId] || [];
          box.innerHTML = list.map(m => m.from === "system" ? `<div class="msg sys">${esc(m.text)}</div>` : `<div class="msg ${m.from === "client" ? "me" : "them"}">${esc(m.text)}<span class="tm">${S.fmtTime(m.t)}</span></div>`).join("") || `<div class="msg sys">Напишіть нам — відповідаємо в середньому за 2 хвилини</div>`;
          box.scrollTop = box.scrollHeight;
        };
        draw();
        const off = S.bus.on(m => { if ((m.type === "chat" && m.carId === carId) || m.type === "state") draw(); });
        entry.cleanup = off;
        const send = (t) => {
          if (!t.trim()) return; inp.value = "";
          S.addMsg(carId, "client", t);
          let alive = 0; try { alive = +localStorage.getItem("7cars-admin-alive") || 0; } catch (e) {}
          if (Date.now() - alive > 6000) autoReply(carId, t);
        };
        $("#cForm", el).onsubmit = e => { e.preventDefault(); send(inp.value); };
        $$("#cSug button", el).forEach(b => b.onclick = () => send(b.textContent));
      },
    };
  };
  function autoReply(carId, t) {
    const c = S.car(carId); t = t.toLowerCase();
    const a = /заряд|азс|запр/.test(t) ? (c.ev ? "Найближча швидка зарядка — ТРЦ Ocean Plaza, 2,1 км, 4 вільні порти. Скинула точку в навігатор." : "Найближча АЗС WOG — 1,4 км по вашому маршруту.")
      : /аеропорт|бориспіл/.test(t) ? "Так, повернення в Борисполі безкоштовне. Відмітила в договорі ✅"
      : /продов/.test(t) ? "Звісно! Натисніть «Продовжити» на екрані ключа — ціна перерахується за довшим тарифом автоматично."
      : /лампоч|помилк|горить|зламал/.test(t) ? "Бачу по телеметрії — тиск у задньому лівому колесі 1,9 бар. Безпечно доїхати до найближчого шиномонтажу, оплатимо ми. Якщо зручніше — підмінимо авто за 40 хв."
      : "Прийнято! Уже перевіряю й відповім за хвилину.";
    setTimeout(() => S.addMsg(carId, "manager", a), 1800);
  }

  /* ---------- profile ---------- */
  R.profile = () => {
    const u = ME();
    return {
      title: "Профіль",
      html: `<div class="topbar"><h1 class="h-lg">Профіль</h1><button class="icon-btn" aria-label="Налаштування">${ic("settings")}</button></div>
      <div class="row" style="padding:16px 20px 0;gap:14px"><div class="avatar" style="width:58px;height:58px;font-size:19px;background:var(--accent);color:#fff">ОК</div><div><b style="font-size:18px">${u.name}</b><div class="muted mono" style="font-size:12px;margin-top:4px">${u.phone}</div></div></div>
      <div class="club"><div class="between" style="position:relative;z-index:2"><div><div class="lbl">7Cars Club</div><div class="lvl">${u.tier}</div></div>${S.LOGO(30, false)}</div>
        <div style="position:relative;z-index:2"><div class="between" style="font-size:13px"><span>${u.trips} поїздок · <b class="num">2 450</b> бонусів</span><span style="color:#8d8d94">до Platinum — 6</span></div><div class="bar"><i></i></div>
        <div style="font-size:12px;color:#8d8d94;margin-top:10px">−7% на кожну оренду · безкоштовний другий водій · пріоритетна подача</div></div></div>
      <div class="menu card">
        <button>${ic("history")}Мої поїздки<span class="r">${u.trips} ${ic("chevron-right")}</span></button>
        <button data-act="diia">${ic("file-check")}Документи<span class="r"><span class="tag acc">Дія · скоро</span></span></button>
        <button>${ic("credit-card")}Оплата<span class="r">Apple Pay, •• 2468 ${ic("chevron-right")}</span></button>
        <button>${ic("building-2")}Для бізнесу<span class="r">рахунки з ПДВ ${ic("chevron-right")}</span></button>
      </div>
      <div class="menu card">
        <div>${ic("moon")}Тема<span class="r"><span class="seg"><button data-theme-set="light">Фірмова</button><button data-theme-set="dark">Темна</button></span></span></div>
        <div>${ic("banknote")}Валюта<span class="r"><span class="seg"><button data-cur="USD">$</button><button data-cur="UAH">₴</button></span></span></div>
        <button>${ic("globe")}Мова<span class="r">Українська ${ic("chevron-right")}</span></button>
        <a href="tel:+380675217877" style="color:inherit;text-decoration:none">${ic("headset")}Підтримка 24/7<span class="r">+38 (067) 521 78 77</span></a>
      </div>
      <p class="muted" style="text-align:center;font-size:12px;margin:22px 0 0">7cars · демо-версія застосунку · 2026</p>`,
      mount(el) { syncSegs(); $("[data-act=diia]", el).onclick = () => toast("Дія — у планах інтеграції", "Документи підтягуватимуться в один тап", "file-check"); },
    };
  };

  /* ---------- global events ---------- */
  wrap.addEventListener("click", (e) => {
    const t = e.target.closest("[data-back],[data-go],[data-tab-go],[data-act=city]");
    if (!t || !wrap.contains(t)) return;
    if (t.hasAttribute("data-back")) return back();
    if (t.dataset.tabGo) return go(t.dataset.tabGo);
    if (t.dataset.act === "city") return modal(`<h2 class="h-md">Місто видачі</h2><div class="stack" style="margin-top:10px">${S.CITIES.map(c => `<button class="opt" style="width:100%;text-align:left" data-c="${c}"><span class="ic">${ic("map-pin")}</span><span class="t">${c}</span>${c === ui.city ? ic("check") : ""}</button>`).join("")}</div>`, (m, close) => $$("[data-c]", m).forEach(b => b.onclick = () => { ui.city = b.dataset.c; close(); refreshTop(); }));
    if (t.dataset.go) {
      const params = {}; if (t.dataset.id) params.id = t.dataset.id; if (t.dataset.cls) params.cls = t.dataset.cls; if (t.dataset.car) params.car = t.dataset.car;
      if (t.dataset.go === "extend") return extendSheet();
      return go(t.dataset.go, params);
    }
  });
  nav.addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) go(b.dataset.tab); });
  document.addEventListener("click", e => {
    const th = e.target.closest("[data-theme-set]"); if (th) { setTheme(th.dataset.themeSet); syncSegs(); }
    const cu = e.target.closest("[data-cur]"); if (cu) { S.setCurrency(cu.dataset.cur); syncSegs(); refreshTop(); }
  });

  // events from admin / other tabs
  S.bus.on(m => {
    const me = S.state.me;
    if (m.type === "chat" && m.from === "manager") {
      const t = top(); if (!(t && t.name === "chat")) { const last = (S.state.chats[m.carId] || []).slice(-1)[0]; if (last) toast("Анна · 7cars", last.text, "message-circle", () => go("chat", { car: m.carId })); }
    }
    if (m.type === "remote" && (m.carId === me.carId || (me.delivery && m.carId === me.delivery.carId))) {
      const map = { lock: ["Авто зачинено дистанційно", "Менеджер 7cars зачинив авто", "lock"], horn: ["Сигнал з офісу", "Менеджер подав сигнал, щоб ви знайшли авто", "volume-2"], offer: ["Продовжити зі знижкою 10%?", "Спеціальна пропозиція саме для вас", "badge-percent"], immobilize: ["Двигун заблоковано", "Зверніться до менеджера 7cars", "shield-alert"] }[m.action];
      if (map) toast(map[0], map[1], map[2], m.action === "offer" ? extendSheet : null);
      if (top() && ["key", "home"].includes(top().name)) refreshTop();
    }
    if (m.type === "state" || m.type === "currency") { syncSegs(); const t = top(); if (t && ["home", "key", "catalog"].includes(t.name)) refreshTop(); }
  });

  setInterval(() => {
    const t = top(); if (t && t.tick) t.tick(t.el);
    const d = new Date(); $("#sbTime").textContent = d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
  }, 1000);

  /* ---------- side scenario ---------- */
  function ensureDemoDelivery() {
    const me = S.state.me;
    if (!me.delivery) {
      const id = "c13"; const st = S.state.cars[id];
      if (st.status !== "available") { const free = S.FLEET.find(c => S.state.cars[c.id].status === "available" && c.cls === "suv") || S.FLEET.find(c => S.state.cars[c.id].status === "available"); return ensureWith(free.id); }
      return ensureWith(id);
    }
    function ensureWith(id) {
      S.state.cars[id].status = "delivering"; S.state.cars[id].client = me.clientId;
      me.delivery = { carId: id, start: Date.now(), dur: 75000, days: 3, path: null, done: false, addr: HOME_ADDR, bid: "B-DEMO" };
      S.logEvent(`Подача ${S.car(id).name} → ${HOME_ADDR}`, "booking", id); S.save(); preloadDeliveryPath();
    }
  }
  $("#scenario").addEventListener("click", e => {
    const b = e.target.closest("[data-scn]"); if (!b) return;
    const s = b.dataset.scn;
    if (s === "ai") { go("ai"); setTimeout(() => R.ai._send && R.ai._send("Вчотирьох у Карпати на 3 дні до $70 на добу"), 500); }
    if (s === "book") { go("catalog", { cls: "business" }); setTimeout(() => go("car", { id: "c13", days: 3 }), 450); }
    if (s === "track") { ensureDemoDelivery(); go("home"); setTimeout(() => go("track"), 350); }
    if (s === "checkin") { ensureDemoDelivery(); S.state.me.delivery.start = Date.now() - 80000; S.save(); go("home"); setTimeout(() => go("checkin"), 350); }
    if (s === "key") go("key");
    if (s === "chat") { go("home"); setTimeout(() => go("chat", { car: S.state.me.carId }), 350); }
  });
  $("#resetDemo").onclick = () => { S.reset(); aiLog.length = 0; AI.reset(); go("home"); toast("Демо скинуто", "Усі дані повернуто до початкових", "rotate-ccw"); };

  window.addEventListener("storage", e => { if (e.key === "7cars-theme" && e.newValue && e.newValue !== document.documentElement.dataset.theme) { document.documentElement.dataset.theme = e.newValue; syncSegs(); maps.forEach(m => m._setTiles && m._setTiles()); } });

  /* ---------- boot ---------- */
  $("#sideLogo").innerHTML = S.LOGO(40);
  $("#splashLogo").innerHTML = S.LOGO(64);
  syncSegs();
  go("home");
  icons();
  setTimeout(() => { $("#splash").classList.add("out"); setTimeout(() => $("#splash").remove(), 600); }, 1300);
  S.loadRoads();
  if (S.state.me.delivery && !S.state.me.delivery.path) preloadDeliveryPath();
  // deep link: app/index.html#key
  const [hash, hid] = location.hash.slice(1).split(":");
  if (hash && R[hash]) setTimeout(() => go(hash, hid ? { id: hid } : {}), 50);
})();
