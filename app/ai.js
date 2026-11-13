/* 7cars AI — local assistant that reasons over the 7cars fleet and rental rules.
   No external model: intent parsing + scoring over SC.FLEET, so it works offline and never invents cars. */
(function () {
  const S = window.SC;
  const seatsOf = c => c.seats.split("+").reduce((a, b) => a + parseInt(b), 0);
  const ctx = { people: null, days: null, budget: null, want: new Set(), dest: null };

  const FAQ = [
    { re: /застав|депоз/, a: c => `Застава залежить від авто: від $300 (економ) до $3000 (Mercedes V-class). Ми не списуємо її, а лише холдуємо на картці — після повернення холд знімається, 93% клієнтів отримують заставу назад менш ніж за 20 хвилин.` },
    { re: /документ|паспорт|посвідч|права\b|ідентиф/, a: () => `Потрібні паспорт, ідентифікаційний код (для громадян України) та посвідчення водія. У застосунку документи можна буде підтягнути з Дії в один тап — інтеграція вже в плані.` },
    { re: /вік|років|стаж/, a: () => `Економ, середній і бізнес-клас — від 21 року і стаж від 2 років. Преміум — від 25 років і стаж від 5 років.` },
    { re: /доставк|подач|привез|адрес/, a: () => `Подаємо авто за вашою адресою — безкоштовно при оренді від 3 діб. Після бронювання ви бачите на карті, як машина їде до вас, і час прибуття.` },
    { re: /мит|мийк|бак|палив|заправ/, a: () => `Авто видаємо чистим і з повним баком. Мити перед поверненням не потрібно, а бак достатньо повернути на тому ж рівні.` },
    { re: /страх|каско|осаго|аварі|дтп/, a: () => `Усі авто застраховані КАСКО та ОСЦПВ. Додаткова страховка зменшує заставу до $80–300 і доступна при оренді від 3 діб. Асистанс на дорозі — 24/7, а в разі поломки підмінимо авто.` },
    { re: /кордон|закордон|польщ|молдов|європ/, a: () => `Виїзд за кордон можливий за попереднім погодженням з менеджером — напишіть у чат, підготуємо документи.` },
    { re: /оплат|карт[кою]|готів|apple|google pay/, a: () => `Оплата карткою, Apple Pay, Google Pay або готівкою в офісі. Без прихованих комісій — лише сума з договору.` },
    { re: /продовж/, a: () => `Продовжити оренду можна прямо в застосунку на екрані «Ключ» — ціна перерахується за довшим тарифом автоматично.` },
  ];

  const DEST = [
    { re: /карпат|буковел|гор[иа]|яремч|драгобрат|славськ/, name: "Карпати", want: ["suv"], why: "Повний привід і кліренс для гірських доріг" },
    { re: /одес|мор[ея]|затоку|затока/, name: "Одеса", want: ["comfort"], why: "Комфорт на трасі Київ — Одеса" },
    { re: /льв[іо]в/, name: "Львів", want: ["comfort"], why: "Економна витрата на трасі до Львова" },
    { re: /аеропорт|бориспіл|жуляни/, name: "аеропорт", want: ["trunk"], why: "Місткий багажник під валізи" },
  ];

  function parse(q) {
    const t = q.toLowerCase().replace(/’|'/g, "'");
    let m;
    if ((m = t.match(/(\d+)\s*(люд|чол|ос[іо]б|пасаж|дорос)/))) ctx.people = +m[1];
    else if (/вчотирьох|четверо|4-х|чотир/.test(t)) ctx.people = 4;
    else if (/втрьох|троє/.test(t)) ctx.people = 3;
    else if (/вдвох|удвох|двоє|з дружиною|з чоловіком|з дівчиною|з хлопцем/.test(t)) ctx.people = 2;
    else if (/сім'?я|родин/.test(t) && !ctx.people) ctx.people = 5;
    else if (/сам\b|одн[ао]му|один\b/.test(t)) ctx.people = 1;
    if (/команд|груп|колектив/.test(t) && !(m && m[1])) ctx.people = Math.max(ctx.people || 0, 8);

    if ((m = t.match(/(\d+)\s*(дн|доб|день|днів)/))) ctx.days = +m[1];
    else if ((m = t.match(/(\d+)\s*(тиж)/))) ctx.days = +m[1] * 7;
    else if (/місяць|міс\b/.test(t)) ctx.days = 30;
    else if (/тиждень/.test(t)) ctx.days = 7;
    else if (/вихідн/.test(t)) ctx.days = 3;
    else if (/доб[ау]\b|на день/.test(t)) ctx.days = 1;

    if ((m = t.match(/(?:до|бюджет|не більше|макс\w*)\s*\$?\s*(\d+)\s*(\$|дол|usd|грн|₴|гривень)?/))) {
      let v = +m[1]; const uah = /грн|₴|гривень/.test(m[2] || "") || v > 600; if (uah) v = v / S.USD_UAH;
      ctx.budget = v;
    }
    const W = ctx.want;
    if (/позашлях|кросовер|повний привід|4x4|4х4|джип/.test(t)) W.add("suv");
    if (/преміум|статус|весіл|бізнес[ -]зустр|партнер|представ|розкіш|mercedes|мерс|bmw/.test(t)) W.add("premium");
    if (/бізнес/.test(t) && !W.has("premium")) W.add("business");
    if (/мінівен|бус|переїзд|багато речей|8 місць|9 місць|мікроавтобус/.test(t)) W.add("minivan");
    if (/деше|економ|бюджет|недорог|найдешев|студент/.test(t)) W.add("cheap");
    if (/електр|tesla|тесл|зарядк|екологіч/.test(t)) W.add("ev");
    if (/автомат|акпп|без механіки/.test(t)) W.add("auto");
    if (/багаж|валіз|універсал/.test(t)) W.add("trunk");
    if (/місто|по києву|по місту|парку/.test(t)) W.add("city");
    for (const d of DEST) if (d.re.test(t)) { ctx.dest = d; d.want.forEach(w => W.add(w)); }
  }

  function score(car) {
    const W = ctx.want, seats = seatsOf(car), st = S.state.cars[car.id];
    let s = 0; const why = [];
    const days = ctx.days || 3, per = S.dayPrice(car, days);
    if (ctx.people) { if (seats < ctx.people) return null; s += seats - ctx.people <= 2 ? 2 : 0.5; }
    if (W.has("suv")) { if (car.cls === "suv") { s += 4; why.push(ctx.dest ? ctx.dest.why : "Висока посадка і кліренс"); } else if (car.name.match(/Discovery|QX50|Q3|Kamiq|Juke/)) { s += 2.2; why.push("Кросовер з високою посадкою"); } else s -= 2; }
    if (W.has("premium")) { if (car.cls === "premium") { s += 4; why.push("Статусне авто преміум-класу"); } else if (car.cls === "business") s += 1.5; else s -= 2; }
    if (W.has("business")) { if (car.cls === "business") { s += 3; why.push("Бізнес-клас: тиша й комфорт"); } else if (car.cls === "premium") s += 1; }
    if (W.has("minivan")) { if (car.cls === "minivan") { s += 4; why.push(`${car.seats} місць і великий багажник`); } else s -= 3; }
    if (W.has("ev")) { if (car.ev) { s += 4; why.push(`Електро: запас ходу до ${car.range} км, без витрат на пальне`); } else s -= 1.5; }
    if (W.has("cheap")) { s += (100 - per) / 22; if (car.cls === "econom") why.push("Одне з найвигідніших авто парку"); }
    if (W.has("auto")) { if (car.gear === "Автомат") s += 1; else s -= 3; }
    if (W.has("trunk") && /SW|MCV|Octavia|Staria|Vito|Tiguan|Discovery|Sportage/.test(car.name)) { s += 2; why.push("Місткий багажник"); }
    if (W.has("comfort") && ["business", "middle", "premium"].includes(car.cls)) { s += 1.5; if (car.cons && parseFloat(car.cons) < 6.5) why.push(`Витрата лише ${car.cons} л/100 км`); else if (ctx.dest) why.push(ctx.dest.why); }
    if (W.has("city") && ["econom", "middle"].includes(car.cls)) { s += 1.5; why.push("Компактне — легко паркуватись у місті"); }
    if (ctx.budget) { if (per > ctx.budget * 1.08) s -= 5; else s += 1; }
    if (!W.size && !ctx.budget) s += 1 - per / 120;
    if (st.status === "available") s += 1.2; else if (st.status === "rented") s -= 0.6; else if (st.status === "service") s -= 1;
    if (ctx.people && seats >= ctx.people && ctx.people >= 5 && !why.some(w => w.includes("місць"))) why.push(`${car.seats} місць — вистачить на всіх`);
    const full = car.prices.d1;
    if (days >= 4 && per < full) why.push(`Тариф від ${days >= 30 ? "місяця" : days >= 10 ? "10 днів" : "4 днів"}: ${S.money(per)} замість ${S.money(full)}/доба`);
    return { car, s, why: why.slice(0, 2), per, total: per * days, st };
  }

  function recommend() {
    const res = S.FLEET.map(score).filter(Boolean).sort((a, b) => b.s - a.s || a.per - b.per);
    return res.slice(0, 3);
  }

  function summary(n) {
    const parts = [];
    if (ctx.people) parts.push(ctx.people === 1 ? "для вас" : `на ${ctx.people} ${ctx.people < 5 ? "людини" : "людей"}`);
    if (ctx.days) parts.push(`на ${ctx.days} ${ctx.days === 1 ? "добу" : ctx.days < 5 ? "доби" : "діб"}`);
    if (ctx.dest) parts.push(`у ${ctx.dest.name === "Карпати" ? "Карпати" : ctx.dest.name}`);
    if (ctx.budget) parts.push(`до ${S.money(ctx.budget)}/доба`);
    return parts.join(", ");
  }

  function reply(q) {
    const t = q.toLowerCase();
    if (/^(привіт|добр|вітаю|hello|hi)\b/.test(t) && t.length < 25) return { text: "Вітаю! Я AI-помічник 7cars. Опишіть поїздку — куди, скільки вас і на скільки днів — і я підберу авто з нашого парку з точною ціною." };
    if (/скинь|спочатку|заново|інш(е|ий) запит/.test(t)) { ctx.people = ctx.days = ctx.budget = ctx.dest = null; ctx.want.clear(); return { text: "Добре, почнімо спочатку. Куди їдемо?" }; }
    const faq = FAQ.find(f => f.re.test(t));
    const before = JSON.stringify([ctx.people, ctx.days, ctx.budget, [...ctx.want]]);
    parse(q);
    const changed = before !== JSON.stringify([ctx.people, ctx.days, ctx.budget, [...ctx.want]]);
    if (faq && !changed) return { text: faq.a() };
    if (!ctx.people && !ctx.days && !ctx.want.size && !ctx.budget) {
      return { text: "Підкажіть трохи деталей: куди плануєте їхати, скільки буде людей і на скільки днів? Наприклад: «вчотирьох у Карпати на 3 дні до $70 на добу».", suggest: ["Вчотирьох у Карпати на 3 дні", "Статусне авто на весілля", "Найдешевше на тиждень", "Електромобіль по Києву"] };
    }
    const recs = recommend();
    if (!recs.length) return { text: "У парку немає авто, що підходять під усі умови. Спробуйте збільшити бюджет або змінити кількість місць — або напишіть менеджеру, підберемо вручну." };
    const days = ctx.days || 3;
    const top = recs[0];
    let text = `Підібрав ${recs.length} варіанти ${summary()}`.trim() + ".";
    text += ` Найкраще підходить ${top.car.name} — ${S.money(top.total)} за ${days} ${days === 1 ? "добу" : days < 5 ? "доби" : "діб"}${top.st.status === "available" ? ", вільне вже сьогодні" : ""}.`;
    if (!ctx.days) text += " Ціни розраховано на 3 доби — напишіть, якщо термін інший.";
    if (faq) text += "\n\n" + faq.a();
    return { text, cars: recs, days, suggest: ["Дешевше", "А з автоматом?", "Що з заставою?", "Яка доставка?"] };
  }

  // follow-ups like "дешевше" tweak context
  function tweak(q) {
    const t = q.toLowerCase();
    if (/^дешевш/.test(t)) { ctx.want.add("cheap"); ctx.want.delete("premium"); if (ctx.budget) ctx.budget *= 0.8; }
    if (/дорожч|краще|комфортніш/.test(t)) { ctx.want.delete("cheap"); ctx.want.add("comfort"); ctx.budget = null; }
  }

  window.SevenAI = {
    ask(q) { tweak(q); return reply(q); },
    reset() { ctx.people = ctx.days = ctx.budget = ctx.dest = null; ctx.want.clear(); },
    seatsOf,
  };
})();
