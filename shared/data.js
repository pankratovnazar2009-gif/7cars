/* 7cars demo — shared fleet data, live store and telemetry simulation.
   Car names, photos and prices are taken from 7cars.com.ua (Nov 2026).
   Everything else (plates, clients, telemetry) is generated demo data. */
(function () {
  const IMG = "https://7cars.com.ua/wp-content/uploads/";
  const USD_UAH = 46.3;

  const CLASSES = [
    { id: "econom",   name: "Економ",        range: "від 15$ до 45$" },
    { id: "middle",   name: "Середній",      range: "від 30$ до 70$" },
    { id: "business", name: "Бізнес",        range: "від 43$ до 90$" },
    { id: "premium",  name: "Преміум",       range: "від 85$ до 600$" },
    { id: "suv",      name: "Позашляховики", range: "від 36$ до 500$" },
    { id: "minivan",  name: "Мінівени",      range: "від 33$ до 280$" },
  ];

  // [cls, name, slug, img, gallery[], engine, fuel, gear, seats, cons, prices[1м,10-29,4-9,1-3,deposit], insured[...]]
  const RAW = [
    ["econom","Chevrolet Spark","ravon-r2-chevrolet-spark-auto-2","2016/11/2ss-825x510.jpg",["2016/11/2ss.jpg","2016/11/3s.jpg","2016/11/4s.jpg","2016/11/6.jpg"],"1.2","Бензин","Автомат","4","8.2",[21,24,28,32,300],[27,32,40,44,80]],
    ["econom","Renault Sandero Stepway","renault-sandero-stepway-2","2019/03/IMG_1612-825x510.jpg",["2019/03/IMG_1612.jpg","2019/03/IMG_1618.jpg","2019/03/IMG_1614.jpg","2019/03/IMG_1623.jpg"],"0.9","Бензин","Механіка","5","6.0",[22,26,30,35,400],[28,34,42,47,80]],
    ["econom","Renault Logan MCV","renaut-logan-mcv-2","2019/03/DSC_0845-825x510.jpg",["2019/03/DSC_0845.jpg","2019/03/DSC_0837.jpg","2019/03/DSC_0833.jpg","2019/03/DSC_0854.jpg"],"1.5","Дизель","Механіка","5","3.9",[22,26,30,35,300],[28,34,42,47,80]],
    ["econom","Skoda Fabia","skoda-fabia-2","2019/03/IMG_8467-1-1-825x510.jpg",["2019/03/IMG_8467-1.jpg","2025/05/IMG_8508-1.jpg","2025/05/IMG_8550.jpg","2025/05/IMG_8537-1.jpg"],"1.0","Бензин","Автомат","5","5.0",[25,32,38,42,400],[31,40,50,54,100]],
    ["econom","VW Polo 1.0 TSI","vw-polo-auto-1-0-tsi-2","2019/03/DSC_0538-825x510.jpg",["2019/03/DSC_0538.jpg","2019/03/DSC_0549-1.jpg","2019/03/DSC_0553.jpg","2019/03/DSC_0565.jpg"],"1.0","Бензин","Автомат","5","4.7",[25,32,38,42,400],[31,40,50,54,100]],

    ["middle","Volkswagen Jetta","volkswagen-jetta-new-2020-2","2019/03/DSC_0089-1-825x510.jpg",["2019/03/DSC_0089-1.jpg","2019/03/DSC_0086.jpg","2019/03/DSC_0079.jpg","2019/03/IMG_20210519_132205.jpg"],"1.4","Бензин","Автомат","5","7.8",[34,38,47,57,500],[42,48,62,72,100]],
    ["middle","Kia Ceed SW","kia-ceed-5","2019/03/IMG_4632_1-825x510.jpg",["2024/08/IMG_4632.jpg","2024/08/IMG_4655.jpg","2024/08/IMG_4647.jpg","2024/08/IMG_4681.jpg"],"1.6","Бензин","Автомат","5","7.6",[37,40,50,60,500],[45,50,65,75,100]],
    ["middle","Nissan Juke","nissan-juke-1-6-auto-2018-2","2018/09/DSC_0515-825x510.jpg",["2018/09/DSC_0515.jpg","2018/09/DSC_0525.jpg","2018/09/DSC_0528.jpg","2018/09/DSC_0534.jpg"],"1.6","Бензин","Автомат","5","7.0",[37,40,50,60,500],[45,50,65,75,100]],
    ["middle","Skoda Octavia A8","skoda-octavia-a8-2","2019/03/IMG_2900-1-825x510.jpg",["2019/03/IMG_2900.jpg","2019/03/IMG_2908.jpg","2019/03/IMG_2923.jpg","2019/03/IMG_2944.jpg"],"1.6","Бензин","Автомат","5","6.9",[37,40,50,60,500],[45,50,65,75,100]],
    ["middle","Skoda Kamiq","skoda-kamiq-2","2019/03/IMG_9864-825x510.jpg",["2019/03/IMG_9864.jpg","2019/03/IMG_9867.jpg","2019/03/IMG_9903.jpg","2019/03/IMG_9872.jpg"],"1.0","Бензин","Автомат","5","5.0",[38,45,55,65,500],[46,55,70,80,100]],

    ["business","Volkswagen Golf GTI","volkswagen-golf-gti-2","2019/03/IMG_1773-825x510.jpg",["2019/03/IMG_1773.jpg","2019/03/IMG_1779.jpg","2019/03/IMG_1774.jpg","2019/03/IMG_1816.jpg"],"2.0","Бензин","Автомат","5","7.0",[40,47,55,65,600],[54,67,85,95,200]],
    ["business","Tesla Model 3 Long Range","tesla-model-3-2","2019/03/IMG_2821-825x510.jpg",["2019/03/IMG_2821.jpg","2019/03/IMG_2691.jpg","2019/03/IMG_2319.jpg","2019/03/IMG_2703.jpg"],"","Електро","Автомат","5","",[43,48,55,65,700],[57,66,82,92,200]],
    ["business","Honda Accord Hybrid","honda-accord-hybrid-2","2019/03/IMG_9371-1-825x510.jpg",["2019/03/IMG_9371-1.jpg","2019/03/IMG_9545.jpg","2019/03/IMG_9392.jpg","2019/03/IMG_9406.jpg"],"2.0","Гібрид","Автомат","5","5.6",[50,57,65,75,1000],[64,75,82,92,300]],
    ["business","Audi A3","audi-a3-5","2019/03/IMG_4377-825x510.jpg",["2019/03/IMG_4377.jpg","2019/03/IMG_4401.jpg","2019/03/IMG_4391.jpg","2019/03/IMG_4426.jpg"],"2.0","Бензин","Автомат","5","7.0",[53,63,70,80,700],[63,78,90,100,200]],
    ["business","Toyota Camry XV80","toyota-camry-xv80-comfort","2019/03/IMG_1674-825x510.jpg",["2019/03/IMG_1674.jpg","2019/03/IMG_1685.jpg","2019/03/IMG_1679.jpg","2019/03/IMG_1692.jpg"],"2.5","Бензин","Автомат","5","7.0",[53,58,65,75,1000],[67,78,95,105,300]],

    ["premium","Infiniti QX50","infiniti-qx50-2-0-auto-2019","2019/03/DSC_0549-825x510.jpg",["2019/03/DSC_0549.jpg","2019/03/DSC_0549_.jpg","2019/03/DSC_0558.jpg","2019/03/DSC_0551.jpg"],"2.0","Бензин","Автомат","5","8.6",[55,60,68,75,1000],[71,80,98,105,300]],
    ["premium","Audi Q3","audi-q3-2","2019/03/IMG_0476-825x510.jpg",["2019/03/IMG_0476.jpg","2019/03/IMG_0503.jpg","2019/03/IMG_0495.jpg","2019/03/IMG_0489.jpg"],"2.0","Дизель","Автомат","5","5.4",[55,65,75,85,1000],[69,85,105,115,300]],
    ["premium","Land Rover Discovery Sport","land-rover-discovery-sport-2","2019/03/IMG_3993-825x510.jpg",["2019/03/IMG_3993.jpg","2019/03/IMG_3985.jpg","2019/03/IMG_3999.jpg","2026/06/IMG_4007.jpg"],"2.0","Бензин","Автомат","7","10",[60,70,80,90,1000],[76,90,110,120,300]],
    ["premium","BMW 330i G20","bmw-330i-g20-2","2019/03/IMG_6632-825x510.jpg",["2019/03/IMG_6632.jpg","2019/03/IMG_0663.jpg","2019/03/IMG_0694.jpg","2019/03/IMG_6652-1.jpg"],"2.0","Бензин","Автомат","5","6.1",[60,70,80,90,1000],[76,90,110,120,300]],
    ["premium","Mercedes-Benz EQE 350","mercedes-benz-eqe-350-2","2019/03/front-825x510.jpg",["2019/03/front.jpg","2019/03/Bek.jpg","2019/03/2026-10-07-14.46.59.jpg","2019/03/2026-10-07-14.47.04.jpg"],"","Електро","Автомат","5","",[65,75,85,100,1500],[99,105,130,145,300]],

    ["suv","Renault Duster 4x4","renault-duster-1-5-manual-diesel-4x4","2019/05/DSC_0631-825x510.jpg",["2019/05/DSC_0631.jpg","2019/05/DSC_0635.jpg","2019/05/DSC_0649.jpg","2019/05/DSC_0655.jpg"],"1.5","Дизель","Механіка","5","5.4",[28,35,45,55,500],[38,50,65,75,100]],
    ["suv","Volkswagen ID.4 Crozz","volkswagen-id-4-crozz-prime-2","2019/03/IMG_1706-825x510.jpg",["2019/03/IMG_1706.jpg","2019/03/IMG_1728.jpg","2019/03/IMG_1731.jpg","2019/03/IMG_1741.jpg"],"","Електро","Автомат","5","",[40,50,60,70,1000],[56,70,90,100,300]],
    ["suv","Kia Sportage AWD","kia-sportage-1-6-auto-2-awd-2019-2","2019/03/DSC_0643-825x510.jpg",["2019/03/DSC_0643.jpg","2019/03/DSC_0649.jpg","2019/03/DSC_0651.jpg","2019/03/DSC_0660.jpg"],"1.6","Бензин","Автомат","5","7.8",[40,45,50,60,500],[50,60,70,80,100]],
    ["suv","Volkswagen Tiguan","volkswagen-tiguan-2","2019/03/DSC_0818-825x510.jpg",["2019/03/DSC_0818.jpg","2019/03/DSC_0832.jpg","2019/03/DSC_0839.jpg","2019/03/DSC_0852.jpg"],"2.0","Бензин","Автомат","5","7.1",[50,55,60,70,800],[64,73,87,97,200]],
    ["suv","Mercedes-Benz EQB 300","mercedes-benz-eqb-300-2","2019/03/IMG_5279-825x510.jpg",["2019/03/IMG_5279.jpg","2019/03/IMG_5292.jpg","2019/03/IMG_5303.jpg","2019/03/IMG_5307.jpg"],"","Електро","Автомат","5","",[50,65,75,90,1000],[64,85,105,120,300]],

    ["minivan","Mercedes-Benz Vito Tourer","mercedes-benz-vito-2","2019/03/IMG_9343_2-825x510.jpg",["2019/03/IMG_9343.jpg","2019/03/IMG_9239.jpg","2019/03/IMG_9242.jpg","2019/03/IMG_9359.jpg"],"2.2","Дизель","Автомат","8+1","8.0",[75,85,100,120,1000],[91,105,130,150,300]],
    ["minivan","Hyundai Staria","hyundai-staria-2","2019/03/IMG_6536-825x510.jpg",["2019/03/IMG_6536.jpg","2019/03/IMG_6540.jpg","2019/03/IMG_6552.jpg","2019/03/IMG_6587.jpg"],"2.2","Дизель","Автомат","9","8.5",[75,90,105,120,1000],[91,110,135,150,300]],
    ["minivan","Mercedes-Benz V-class","mercedes-benz-v-class-2016-2","2017/06/1s-2-825x510.jpg",["2017/06/1s-2.jpg","2017/06/2sr-2.jpg","2017/06/3s-2.jpg","2017/06/sal1-1.jpg"],"2.2","Дизель","Автомат","6+1","10.0",[110,135,170,190,3000],null],
    ["minivan","Mercedes-Benz Sprinter 9","mercedes-benz-sprinter-9-seats-3","2019/03/DSC_0965-825x510.jpg",["2019/03/DSC_0965.jpg","2019/03/DSC_0971.jpg","2019/03/DSC_0975-2.jpg","2019/03/IMG_20210330_141130.jpg"],"2.2","Дизель","Автомат","8","11",[145,170,200,250,2000],null],
    ["minivan","Mercedes-Benz Sprinter","mercedes-benz-sprinter-2","2019/03/DSC_0291-825x510.jpg",["2019/03/DSC_0291.jpg","2019/03/DSC_0263-1.jpg","2019/03/DSC_0270.jpg","2019/03/DSC_0273.jpg"],"2.1","Дизель","Автомат","10","13",[190,240,280,330,3000],null],
  ];

  const EV_RANGE = { "Tesla Model 3 Long Range": 560, "Mercedes-Benz EQE 350": 590, "Volkswagen ID.4 Crozz": 480, "Mercedes-Benz EQB 300": 420 };
  const PLATES = ["AA 4417 KX","KA 0712 PE","AA 3390 OB","AI 7105 MH","AA 8821 XT","KA 5507 CO","AA 1962 IP","AA 6634 TM","KA 2208 HB","AI 4410 KE",
                  "AA 7777 SC","AA 0007 SC","KA 3156 AK","AA 9020 MP","KA 4842 BT","AA 1515 EK","AA 6060 OK","KA 8080 IO","AA 0330 BM","AA 0350 EQ",
                  "BC 2241 HA","AA 3104 ID","AI 9917 OT","KA 7714 TG","AA 0300 EB","AA 8008 VT","KA 1909 ST","AA 0001 VC","AA 5309 SP","KA 6110 SR"];
  const YEARS = [2021,2020,2021,2024,2022, 2022,2024,2021,2023,2023, 2022,2023,2023,2022,2025, 2021,2022,2023,2022,2025, 2020,2024,2022,2023,2025, 2023,2024,2021,2022,2021];

  const FLEET = RAW.map((r, i) => {
    const [cls, name, slug, img, gal, engine, fuel, gear, seats, cons, p, pi] = r;
    return {
      id: "c" + (i + 1), cls, name, url: "https://7cars.com.ua/ua/avto/" + slug + "/",
      // local copies (resized) of the 7cars photos, so the demo works on any host
      img: "../assets/photos/c" + (i + 1) + "_0.jpg", gallery: gal.map((g, j) => "../assets/photos/c" + (i + 1) + "_" + j + ".jpg"), srcImg: IMG + img,
      engine, fuel, gear, seats, cons, ev: fuel === "Електро", range: EV_RANGE[name] || 0,
      prices: { month: p[0], d10: p[1], d4: p[2], d1: p[3] }, deposit: p[4],
      insured: pi ? { month: pi[0], d10: pi[1], d4: pi[2], d1: pi[3], deposit: pi[4] } : null,
      plate: PLATES[i], year: YEARS[i],
      odoBase: 18000 + ((i * 7919) % 61000),
      rating: (4.6 + ((i * 37) % 5) / 10).toFixed(1),
    };
  });

  const OFFICES = [
    { id: "kyiv",  city: "Київ",     addr: "вул. Ізюмська, 5а",          ll: [50.4183, 30.5512] },
    { id: "kbp",   city: "Бориспіль", addr: "Аеропорт «Бориспіль», термінал D", ll: [50.3412, 30.8952] },
    { id: "lviv",  city: "Львів",    addr: "вул. Городоцька, 120",        ll: [49.8346, 23.9986] },
    { id: "odesa", city: "Одеса",    addr: "вул. Генуезька, 24",          ll: [46.4422, 30.7563] },
    { id: "dnipro",city: "Дніпро",   addr: "просп. Яворницького, 52",     ll: [48.4656, 35.0457] },
    { id: "if",    city: "Івано-Франківськ", addr: "вул. Незалежності, 40", ll: [48.9226, 24.7111] },
  ];
  const CITIES = ["Київ","Бориспіль","Львів","Одеса","Дніпро","Вінниця","Чернівці","Луцьк","Житомир","Івано-Франківськ","Тернопіль","Харків"];

  // Loop routes for rented cars (waypoints; real road geometry is fetched from OSRM when online).
  const ROUTES = {
    kyiv_center: { name: "Київ, центр", pts: [[50.4501,30.5234],[50.4410,30.5420],[50.4268,30.5402],[50.4365,30.5060],[50.4575,30.5135]], v: 26 },
    kyiv_left:   { name: "Київ, Лівий берег", pts: [[50.4523,30.5965],[50.4402,30.6195],[50.4104,30.6352],[50.4228,30.5803]], v: 30 },
    boryspil:    { name: "Траса Київ — Бориспіль", pts: [[50.4290,30.5650],[50.3890,30.7010],[50.3450,30.8930]], v: 74, hwy: true },
    obolon:      { name: "Київ, Оболонь", pts: [[50.5101,30.4982],[50.5012,30.5205],[50.4873,30.4953],[50.4952,30.4702]], v: 24 },
    zhytomyr:    { name: "Траса М-06 на Житомир", pts: [[50.4545,30.3610],[50.4280,30.0500],[50.3410,29.2700],[50.2620,28.6690]], v: 82, hwy: true },
    lviv:        { name: "Львів", pts: [[49.8397,24.0297],[49.8302,24.0102],[49.8181,24.0352],[49.8421,24.0522]], v: 22 },
    odesa:       { name: "Одеса, узбережжя", pts: [[46.4825,30.7233],[46.4452,30.7502],[46.4302,30.7603],[46.4602,30.7302]], v: 28 },
    carpathians: { name: "Франківськ — Буковель", pts: [[48.9222,24.7112],[48.5652,24.5702],[48.3571,24.4001]], v: 48, hwy: true },
    dnipro:      { name: "Дніпро", pts: [[48.4647,35.0462],[48.4502,35.0702],[48.4302,35.0302],[48.4552,35.0102]], v: 27 },
  };

  const CLIENTS = [
    { id: "u0", name: "Олександр Коваль", short: "Олександр К.", phone: "+380 67 214 55 08", tier: "Gold", trips: 14, me: true },
    { id: "u1", name: "Марина Шевчук", short: "Марина Ш.", phone: "+380 50 331 20 47", tier: "Silver", trips: 6 },
    { id: "u2", name: "Андрій Бондар", short: "Андрій Б.", phone: "+380 63 908 11 72", tier: "Gold", trips: 21 },
    { id: "u3", name: "Ірина Ткаченко", short: "Ірина Т.", phone: "+380 97 455 63 10", tier: "Base", trips: 2 },
    { id: "u4", name: "Дмитро Мельник", short: "Дмитро М.", phone: "+380 66 120 98 31", tier: "Silver", trips: 9 },
    { id: "u5", name: "Олена Кравець", short: "Олена К.", phone: "+380 93 781 44 25", tier: "Gold", trips: 17 },
    { id: "u6", name: "Тарас Гнатюк", short: "Тарас Г.", phone: "+380 68 640 72 90", tier: "Base", trips: 1 },
    { id: "u7", name: "James Miller", short: "James M.", phone: "+44 7700 900 412", tier: "Base", trips: 3, lang: "EN" },
    { id: "u8", name: "Наталія Лисенко", short: "Наталія Л.", phone: "+380 50 902 18 64", tier: "Silver", trips: 5 },
    { id: "u9", name: "Віктор Романенко", short: "Віктор Р.", phone: "+380 67 503 27 19", tier: "Gold", trips: 28, corp: "ТОВ «Агросфера»" },
    { id: "u10", name: "Софія Павленко", short: "Софія П.", phone: "+380 99 344 70 52", tier: "Base", trips: 2 },
    { id: "u11", name: "Максим Литвин", short: "Максим Л.", phone: "+380 73 218 66 04", tier: "Silver", trips: 7 },
    { id: "u12", name: "Юлія Савчук", short: "Юлія С.", phone: "+380 95 677 31 88", tier: "Gold", trips: 12 },
  ];

  // Initial fleet assignment. h = hours left until return (negative = overdue), age = hours since pickup.
  const ASSIGN = {
    c12: { status: "rented", client: "u0", route: "kyiv_center", h: 30, age: 42, fuel0: 92 },  // Tesla — demo user
    c11: { status: "rented", client: "u4", route: "boryspil", h: 5.5, age: 66, fuel0: 81, speedy: true },
    c3:  { status: "rented", client: "u3", route: "obolon", h: 52, age: 20, fuel0: 100 },
    c5:  { status: "rented", client: "u10", route: "kyiv_left", h: 1.4, age: 70, fuel0: 64 },
    c7:  { status: "rented", client: "u8", route: "lviv", h: 96, age: 48, fuel0: 88 },
    c9:  { status: "rented", client: "u11", route: "zhytomyr", h: 20, age: 28, fuel0: 95 },
    c15: { status: "rented", client: "u9", route: "kyiv_center", h: 410, age: 310, fuel0: 77 },
    c17: { status: "rented", client: "u5", route: "odesa", h: 44, age: 30, fuel0: 90 },
    c18: { status: "rented", client: "u2", route: "carpathians", h: 70, age: 26, fuel0: 86 },
    c19: { status: "rented", client: "u12", route: "kyiv_left", h: -0.6, age: 74, fuel0: 58 },
    c20: { status: "rented", client: "u7", route: "boryspil", h: 9, age: 15, fuel0: 97 },
    c22: { status: "rented", client: "u1", route: "carpathians", h: 60, age: 34, fuel0: 93 },
    c23: { status: "rented", client: "u6", route: "dnipro", h: 26, age: 44, fuel0: 70 },
    c26: { status: "rented", client: "u9", route: "obolon", h: 140, age: 160, fuel0: 84 },
    c27: { status: "rented", client: "u2", route: "zhytomyr", h: 3.2, age: 22, fuel0: 79 },
    c1:  { status: "service", office: "kyiv", note: "Планове ТО, 60 000 км" },
    c24: { status: "service", office: "kyiv", note: "Заміна шин" },
    c29: { status: "service", office: "kbp", note: "Мийка й хімчистка" },
    c14: { status: "reserved", office: "kyiv", client: "u5", inH: 5 },
    c25: { status: "reserved", office: "kbp", client: "u7", inH: 18 },
  };
  const PARKED = { c2: "kyiv", c4: "kyiv", c6: "kbp", c8: "lviv", c10: "kyiv", c13: "kyiv", c16: "odesa", c21: "kyiv", c28: "kyiv", c30: "dnipro" };

  const SEED_CHATS = {
    c12: [
      { from: "manager", text: "Олександре, вітаємо! Tesla передано, заряд 92%. Найближчий швидкий заряд — ТРЦ Ocean Plaza.", ago: 41.5 },
      { from: "client", text: "Дякую! Чи можна повернути авто в Борисполі замість офісу?", ago: 3.1 },
      { from: "manager", text: "Так, повернення в аеропорту безкоштовне. Відмітимо в договорі.", ago: 3.0 },
    ],
    c11: [
      { from: "system", text: "Перевищення швидкості: 128 км/год на трасі Київ — Бориспіль", ago: 0.4 },
      { from: "client", text: "Підкажіть, де найближча АЗС WOG по дорозі в аеропорт?", ago: 1.2 },
    ],
    c19: [
      { from: "system", text: "Оренда завершилась 36 хв тому. Авто ще не повернуто.", ago: 0.6 },
      { from: "client", text: "Застрягла в заторі на мосту Патона, буду хвилин за 20 😔", ago: 0.3 },
    ],
    c20: [
      { from: "client", text: "Hi! Is it ok to leave the car at terminal D parking?", ago: 2.4 },
      { from: "manager", text: "Hi James! Yes, P1 parking, level 2. Leave the key card in the glovebox.", ago: 2.2 },
    ],
    c18: [
      { from: "client", text: "Їдемо в Буковель, чи є ланцюги на колеса в комплекті?", ago: 26 },
      { from: "manager", text: "Так, ланцюги в багажнику. Гарної дороги! 🏔", ago: 25.8 },
    ],
    c5: [ { from: "system", text: "До кінця оренди 1 год 24 хв. Клієнту надіслано пропозицію продовження.", ago: 0.1 } ],
  };

  // ---------- pricing ----------
  function tierFor(days) { return days >= 30 ? "month" : days >= 10 ? "d10" : days >= 4 ? "d4" : "d1"; }
  function dayPrice(car, days, ins) { const t = tierFor(days); return (ins && car.insured ? car.insured : car.prices)[t]; }
  function quote(car, days, opts = {}) {
    const per = dayPrice(car, days, opts.insurance);
    const base = per * days;
    const fullPer = (opts.insurance && car.insured ? car.insured : car.prices).d1;
    const saved = Math.max(0, fullPer * days - base);
    const early = opts.early ? Math.round(base * 0.15) : 0;
    const extras = (opts.extras || []).reduce((s, e) => s + e.price * (e.perDay ? days : 1), 0);
    const delivery = opts.delivery && days < 3 ? 15 : 0;
    const total = base - early + extras + delivery;
    return { per, days, base, saved, early, extras, delivery, total, deposit: (opts.insurance && car.insured ? car.insured.deposit : car.deposit) };
  }

  // ---------- currency ----------
  let currency = (() => { try { return localStorage.getItem("7cars-cur") || "USD"; } catch (e) { return "USD"; } })();
  function money(usd, opts = {}) {
    if (currency === "UAH") {
      const v = Math.round(usd * USD_UAH);
      return v.toLocaleString("uk-UA").replace(/ /g, " ") + (opts.short ? "₴" : " ₴");
    }
    return "$" + Math.round(usd).toLocaleString("en-US");
  }
  function setCurrency(c) { currency = c; try { localStorage.setItem("7cars-cur", c); } catch (e) {} bus.emit({ type: "currency", c }); }

  // ---------- geo helpers ----------
  const R = 6371;
  function hav(a, b) {
    const dLat = (b[0] - a[0]) * Math.PI / 180, dLng = (b[1] - a[1]) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function buildPath(pts, closed) {
    const p = closed ? pts.concat([pts[0]]) : pts.concat(pts.slice(0, -1).reverse()); // out-and-back for highways
    const cum = [0];
    for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + hav(p[i - 1], p[i]));
    return { pts: p, cum, len: cum[cum.length - 1] };
  }
  function pointAt(path, d) {
    d = ((d % path.len) + path.len) % path.len;
    let i = 1; while (i < path.cum.length - 1 && path.cum[i] < d) i++;
    const seg = path.cum[i] - path.cum[i - 1] || 1, f = (d - path.cum[i - 1]) / seg;
    const a = path.pts[i - 1], b = path.pts[i];
    const ll = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    const hdg = Math.atan2((b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180), b[0] - a[0]) * 180 / Math.PI;
    return { ll, hdg };
  }

  // Road geometry cache (OSRM), falls back to straight waypoints.
  const paths = {};
  function getPath(key) {
    if (paths[key]) return paths[key];
    const r = ROUTES[key];
    let pts = r.pts;
    try { const c = JSON.parse(localStorage.getItem("7cars-route-" + key) || "null"); if (c && c.length > 3) pts = c; } catch (e) {}
    paths[key] = buildPath(pts, !r.hwy);
    return paths[key];
  }
  async function osrm(points) {
    const q = points.map(p => p[1].toFixed(5) + "," + p[0].toFixed(5)).join(";");
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch("https://router.project-osrm.org/route/v1/driving/" + q + "?overview=full&geometries=geojson", { signal: ctrl.signal });
      const j = await res.json();
      if (!j.routes || !j.routes[0]) return null;
      return { pts: j.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), km: j.routes[0].distance / 1000, min: j.routes[0].duration / 60 };
    } catch (e) { return null; } finally { clearTimeout(to); }
  }
  async function loadRoads() {
    const keys = Object.keys(ROUTES);
    for (const k of keys) {
      try { if (localStorage.getItem("7cars-route-" + k)) continue; } catch (e) {}
      const r = ROUTES[k];
      const pts = r.hwy ? r.pts : r.pts.concat([r.pts[0]]);
      const got = await osrm(pts);
      if (got) {
        // simplify: keep every n-th point
        const step = Math.max(1, Math.floor(got.pts.length / 400));
        const simp = got.pts.filter((_, i) => i % step === 0);
        try { localStorage.setItem("7cars-route-" + k, JSON.stringify(simp)); } catch (e) {}
        delete paths[k];
      }
    }
    bus.emit({ type: "roads" });
  }

  // ---------- store ----------
  const KEY = "7cars-demo-v3";
  const H = 3600e3;
  function freshState() {
    const now = Date.now();
    const cars = {};
    FLEET.forEach((c, i) => {
      const a = ASSIGN[c.id];
      const s = { status: "available", office: PARKED[c.id] || "kyiv", locked: true, immobilized: false };
      if (a) Object.assign(s, a);
      if (s.status === "rented") {
        s.start = now - a.age * H; s.end = now + a.h * H; s.off = (i * 13.7) % 50;
      }
      if (s.status === "reserved") s.pickup = now + a.inH * H;
      // idle cars: when they last returned
      if (s.status === "available") s.idleSince = now - ((i * 29) % 90 + 4) * H;
      cars[c.id] = s;
    });
    const chats = {};
    Object.entries(SEED_CHATS).forEach(([id, list]) => { chats[id] = list.map(m => ({ from: m.from, text: m.text, t: now - m.ago * H })); });
    const bookings = [
      { id: "B-24117", car: "c14", client: "u5", from: now + 5 * H, to: now + 77 * H, total: 255, status: "confirmed", src: "Застосунок" },
      { id: "B-24118", car: "c25", client: "u7", from: now + 18 * H, to: now + 114 * H, total: 300, status: "confirmed", src: "Telegram" },
      { id: "B-24119", car: "c8", client: "u3", from: now + 50 * H, to: now + 98 * H, total: 120, status: "new", src: "AI-асистент" },
      { id: "B-24120", car: "c16", client: "u12", from: now + 28 * H, to: now + 196 * H, total: 476, status: "new", src: "Сайт" },
      { id: "B-24121", car: "c28", client: "u9", from: now + 74 * H, to: now + 122 * H, total: 380, status: "confirmed", src: "Корпоративний" },
    ];
    return { v: 3, epoch: now, cars, chats, bookings, me: { clientId: "u0", carId: "c12", delivery: null, checkin: null, keyMode: "online" }, log: [] };
  }
  let state;
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.v === 3) { state = s; return; } } catch (e) {}
    state = freshState(); save(false);
  }
  function save(notify = true) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    if (notify) bus.post({ type: "state" });
  }
  function reset() { state = freshState(); save(); bus.emit({ type: "state" }); }

  // ---------- cross-tab bus ----------
  const listeners = new Set();
  let chan = null; try { chan = new BroadcastChannel("7cars-demo"); } catch (e) {}
  const bus = {
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(msg) { listeners.forEach(fn => fn(msg)); },
    post(msg) { // local + other tabs/iframes
      this.emit(msg);
      if (chan) chan.postMessage(msg);
    },
  };
  function fromOutside(msg) { if (msg && msg.type === "state") { load(); } bus.emit(msg); }
  if (chan) chan.onmessage = e => fromOutside(e.data);
  window.addEventListener("storage", e => { if (e.key === KEY) fromOutside({ type: "state" }); if (e.key === "7cars-cur") { currency = e.newValue || "USD"; bus.emit({ type: "currency" }); } });

  // ---------- actions ----------
  function addMsg(carId, from, text) {
    (state.chats[carId] = state.chats[carId] || []).push({ from, text, t: Date.now() });
    save(); bus.post({ type: "chat", carId, from });
  }
  function logEvent(text, kind = "info", carId) { state.log.unshift({ t: Date.now(), text, kind, carId }); state.log = state.log.slice(0, 60); }

  // ---------- telemetry ----------
  function telemetry(id, now = Date.now()) {
    const car = FLEET.find(c => c.id === id); const s = state.cars[id];
    if (!car || !s) return null;
    if (s.status === "delivering") {
      const d = delivery(now);
      if (d && d.carId === id) return { ll: d.ll, hdg: d.hdg, speed: d.phase === 2 ? 34 + Math.round(8 * Math.sin(now / 5000)) : 0, km: 0, odo: car.odoBase, fuel: 100, moving: d.phase === 2, place: d.phase === 3 ? "На місці: " + d.addr : "Подача → " + d.addr, left: null, delivery: d };
    }
    if (s.status !== "rented") {
      const off = OFFICES.find(o => o.id === s.office) || OFFICES[0];
      const k = parseInt(id.slice(1));
      const ll = [off.ll[0] + Math.sin(k * 1.7) * 0.0012, off.ll[1] + Math.cos(k * 2.3) * 0.0018];
      return { ll, hdg: 0, speed: 0, km: 0, odo: car.odoBase, fuel: s.status === "service" ? 40 + (k * 7) % 40 : 100, moving: false, place: off.city + ", " + off.addr, left: null };
    }
    const r = ROUTES[s.route]; const path = getPath(s.route);
    const n = parseInt(id.slice(1));
    const rnd = (j, k) => { const x = Math.sin(n * 12.9898 + j * 78.233 + k * 3.7) * 43758.5453; return x - Math.floor(x); };
    const v = r.v * (s.speedy ? 1.3 : 1), duty = r.hwy ? 0.3 : 0.42;
    const h = Math.max(0, (now - s.start) / H), J = Math.floor(h);
    let km = 0, moving = false;
    for (let j = 0; j <= J; j++) {
      if (rnd(j, 1) > duty) continue;
      const frac = 0.35 + rnd(j, 2) * 0.45;
      const part = j < J ? frac : Math.min(frac, h - J);
      km += part * v; if (j === J && h - J < frac) moving = true;
    }
    if (s.immobilized) { if (s.immoKm == null) s.immoKm = km; km = s.immoKm; moving = false; }
    const speed = moving ? Math.round(v * (1.05 + 0.35 * Math.sin(now / 9000 + n)) + (s.speedy ? 8 : 0)) : 0;
    const pt = pointAt(path, s.off + km);
    const usePct = car.ev ? km / car.range * 100 : km * (parseFloat(car.cons) || 7) / 50;
    const fuel = Math.round(96 - ((usePct + (96 - s.fuel0)) % 82));
    return { ll: pt.ll, hdg: pt.hdg, speed, km: Math.round(km), odo: car.odoBase + Math.round(km), fuel, moving, place: r.name, left: s.end - now, route: s.route };
  }

  function fmtLeft(ms) {
    const neg = ms < 0; ms = Math.abs(ms);
    const d = Math.floor(ms / (24 * H)), h = Math.floor(ms % (24 * H) / H), m = Math.floor(ms % H / 60000);
    const s = d > 0 ? `${d} д ${h} год` : h > 0 ? `${h} год ${m} хв` : `${m} хв`;
    return neg ? "−" + s : s;
  }
  function fmtTime(t) { return new Date(t).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }); }
  function fmtDate(t, opts) { return new Date(t).toLocaleDateString("uk-UA", opts || { day: "numeric", month: "short" }); }
  function ago(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "щойно"; if (m < 60) return m + " хв тому"; const h = Math.round(m / 60);
    if (h < 24) return h + " год тому"; return Math.round(h / 24) + " д тому";
  }

  const LOGO = (size = 28, words = true) => `<span class="logo" aria-label="7cars">
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="M0 0h100v19H0z" fill="var(--accent)"/><path d="M100 27v63a10 10 0 0 1-10 10H27z" fill="var(--accent)"/><path d="M0 27h62L0 89z" fill="var(--ink)" opacity=".92"/></svg>
    ${words ? `<span class="wm" style="font-size:${size * 0.52}px"><b>Seven</b><span>Cars</span></span>` : ""}</span>`;

  // Studio cut-outs (background removed locally from 7cars photos). id -> [[galleryIndex, flipX], ...]; first = hero angle
  const CUTS = window.__CUTS || {};
  function cuts(car) { return (CUTS[car.id] || []).map(([i, f]) => ({ src: "../assets/cars/" + car.id + "_" + i + ".webp", flip: !!f })); }
  function studio(car, o = {}) {
    const list = cuts(car), c = list[o.idx || 0] || list[0];
    const cls = ["studio", o.dark ? "dark" : "", o.bare ? "bare" : "", o.cls || ""].join(" ");
    if (!c) return `<div class="${cls}" style="background:url('${car.img}') center/cover;${o.style || ""}" role="img" aria-label="${car.name}"></div>`;
    return `<div class="${cls}" style="${o.style || ""}"><span class="shadow"></span><div class="carbox ${c.flip ? "flip" : ""}"><img src="${c.src}" alt="${car.name}" loading="lazy" decoding="async"><img class="refl" src="${c.src}" alt="" aria-hidden="true" loading="lazy"></div></div>`;
  }

  const tileUrl = dark => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${dark ? "Dark" : "Light"}_Gray_Base/MapServer/tile/{z}/{y}/{x}`;

  // Live delivery of the demo client's car (shared by app and admin)
  let dCache = null;
  function delivery(now = Date.now()) {
    const d = state.me.delivery; if (!d) return null;
    const p = Math.min(1, (now - d.start) / d.dur);
    const phase = p < 0.12 ? 0 : p < 0.2 ? 1 : p < 1 ? 2 : 3;
    let ll = OFFICES[0].ll, hdg = 0;
    if (d.path && d.path.length > 1 && phase >= 2) {
      if (!dCache || dCache.key !== d.start + ":" + d.path.length) { const cum = [0]; for (let i = 1; i < d.path.length; i++) cum.push(cum[i - 1] + hav(d.path[i - 1], d.path[i])); dCache = { pts: d.path, cum, len: cum[cum.length - 1], key: d.start + ":" + d.path.length }; }
      const pt = pointAt(dCache, Math.min(1, (p - 0.2) / 0.8) * dCache.len * 0.999); ll = pt.ll; hdg = pt.hdg;
    }
    return { p, phase, ll, hdg, carId: d.carId, addr: d.addr, eta: Math.max(0, Math.ceil((d.routeMin || 14) * (phase < 2 ? 1 : 1 - (p - 0.2) / 0.8) + (phase === 0 ? 6 : 0))) };
  }

  load();
  window.SC = { tileUrl, delivery, studio, cuts, USD_UAH, CLASSES, FLEET, OFFICES, CITIES, ROUTES, CLIENTS, get state() { return state; }, save, reset, bus, addMsg, logEvent,
    telemetry, getPath, loadRoads, osrm, quote, dayPrice, tierFor, money, setCurrency, get currency() { return currency; },
    fmtLeft, fmtTime, fmtDate, ago, hav, pointAt, buildPath, LOGO, car: id => FLEET.find(c => c.id === id), client: id => CLIENTS.find(c => c.id === id), H };
})();
