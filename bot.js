const { Telegraf, Markup, session } = require('telegraf');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const token = process.env.BOT_TOKEN || Buffer.from('ODY1Mzc0NDQ5MjpBQUZGNFhNLXFzcGNBbUFJbUhHcVZrcFlwRjY2ZHJNZG1TWQ==', 'base64').toString('utf-8');
const bot = new Telegraf(token);
const ADMIN_PASSWORD = "havo_admin_2026";

// Gemini API Key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const DB_FILE = path.join(__dirname, 'database.json');
let db = {};
if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
const saveDb = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

bot.use((ctx, next) => {
    const from = ctx.from;
    if (from) {
        const id = from.id;
        if (!db[id]) db[id] = { lang: 'uz', subscribed: false, isAdmin: false };
        
        db[id].first_name = from.first_name || '';
        db[id].username = from.username ? `@${from.username}` : '';
        db[id].last_active = Date.now();
        saveDb();
    }
    return next();
});

const getUser = (ctx) => {
    const id = ctx.chat?.id || ctx.from?.id;
    if (!db[id]) db[id] = { lang: 'uz', subscribed: false, isAdmin: false };
    return db[id];
};

const I18N = {
    uz: {
        welcome: "Assalomu alaykum! 🌤️\n\nQaysi viloyat ob-havosi sizni qiziqtiradi?",
        send_loc: "📍 Joylashuvni yuborish",
        settings: "⚙️ Sozlamalar",
        currency: "💵 Valyuta",
        choose_lang: "Tilni tanlang:",
        lang_saved: "Til o'zgartirildi! 🇺🇿",
        today: "Bugun",
        tomorrow: "Ertaga",
        weekly: "7 kunlik",
        graph: "📈 Grafik",
        subscribe: "🔔 07:00 da olish",
        unsubscribe: "🔕 Bekor qilish",
        sub_success: "Siz har kuni 07:00 da ob-havo qabul qilasiz! ✅",
        unsub_success: "Obuna bekor qilindi. ❌",
        error: "Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.",
        prayer: "🕌 Namoz",
        agro: "🌱 Agro",
        indices: "🚙 Indekslar",
        condition: {
            0: "Ochiq havo ☀️", 1: "Qisman bulutli ⛅", 2: "Bulutli ☁️", 3: "Bulutli ☁️",
            45: "Tuman 🌫️", 48: "Tuman 🌫️",
            51: "Yomg'ir shivalashi 🌧️", 53: "Yomg'ir shivalashi 🌧️", 55: "Yomg'ir shivalashi 🌧️",
            61: "Yomg'ir 🌧️", 63: "Yomg'ir 🌧️", 65: "Yomg'ir 🌧️",
            71: "Qor ❄️", 73: "Qor ❄️", 75: "Qor ❄️", 77: "Qor ❄️",
            80: "Kuchli yomg'ir 🌧️", 81: "Kuchli yomg'ir 🌧️", 82: "Kuchli yomg'ir 🌧️",
            85: "Kuchli qor ❄️", 86: "Kuchli qor ❄️",
            95: "Momaqaldiroq ⛈️", 96: "Momaqaldiroq ⛈️", 99: "Momaqaldiroq ⛈️"
        }
    }
};

const REGIONS = {
    "Toshkent": { lat: 41.2995, lon: 69.2401 },
    "Andijon": { lat: 40.7821, lon: 72.3442 },
    "Buxoro": { lat: 39.7747, lon: 64.4286 },
    "Farg'ona": { lat: 40.3842, lon: 71.7843 },
    "Jizzax": { lat: 40.1158, lon: 67.8422 },
    "Namangan": { lat: 40.9983, lon: 71.6726 },
    "Navoiy": { lat: 40.0844, lon: 65.3792 },
    "Qashqadaryo": { lat: 38.8606, lon: 65.7891 },
    "Samarqand": { lat: 39.6542, lon: 66.9597 },
    "Sirdaryo": { lat: 40.4897, lon: 68.7842 },
    "Surxondaryo": { lat: 37.2242, lon: 67.2783 },
    "Xorazm": { lat: 41.55, lon: 60.6333 },
    "Qoraqalpog'iston": { lat: 42.4619, lon: 59.6166 }
};

// Fallback to UZ for now to simplify memory, we already know the structure.
const getT = (ctx) => I18N['uz'];

const getMainMenu = (t) => {
    return Markup.keyboard([
        [Markup.button.locationRequest(t.send_loc)],
        [t.currency, Markup.button.webApp("🛰 Jonli Radar", "https://yandex.uz/pogoda/maps/radar")],
        ["🌋 Zilzilalar", t.settings]
    ]).resize();
};

const getRegionsKeyboard = () => {
    const keys = Object.keys(REGIONS);
    const keyboard = [];
    for (let i = 0; i < keys.length; i += 2) {
        const row = [Markup.button.callback(keys[i], `reg_${keys[i]}`)];
        if (i + 1 < keys.length) row.push(Markup.button.callback(keys[i+1], `reg_${keys[i+1]}`));
        keyboard.push(row);
    }
    return Markup.inlineKeyboard(keyboard);
};

const weatherCache = {};

const metNoEmoji = (sym) => {
    if (!sym) return "☁️";
    if (sym.includes('clear') || sym.includes('fair')) return "☀️ Ochiq havo";
    if (sym.includes('partlycloudy')) return "⛅ Qisman bulutli";
    if (sym.includes('cloudy')) return "☁️ Bulutli";
    if (sym.includes('rain')) return "🌧️ Yomg'ir";
    if (sym.includes('snow')) return "❄️ Qor";
    if (sym.includes('thunder')) return "⛈️ Momaqaldiroq";
    if (sym.includes('fog')) return "🌫️ Tuman";
    return "☁️ Bulutli";
};

const fetchWeatherData = async (lat, lon) => {
    const cacheKey = `${lat}_${lon}`;
    const now = Date.now();
    if (weatherCache[cacheKey] && now - weatherCache[cacheKey].timestamp < 15 * 60 * 1000) {
        return weatherCache[cacheKey].data;
    }
    
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
    const opts = { headers: { 'User-Agent': 'ObHavoBot/1.0 (https://t.me/obhavo712_bot)' } };
    
    try {
        const res = await axios.get(url, opts);
        const ts = res.data.properties.timeseries;
        
        const current = ts[0];
        const cData = current.data.instant.details;
        const sym = current.data.next_1_hours?.summary?.symbol_code || current.data.next_6_hours?.summary?.symbol_code || '';
        
        const dailyMap = {};
        for (const t of ts) {
            const date = t.time.substring(0, 10);
            if (!dailyMap[date]) dailyMap[date] = { max: -999, min: 999, symbol: '', precip: 0 };
            const temp = t.data.instant.details.air_temperature;
            if (temp > dailyMap[date].max) dailyMap[date].max = temp;
            if (temp < dailyMap[date].min) dailyMap[date].min = temp;
            if (!dailyMap[date].symbol) dailyMap[date].symbol = t.data.next_6_hours?.summary?.symbol_code || t.data.next_12_hours?.summary?.symbol_code;
            dailyMap[date].precip += (t.data.next_1_hours?.details?.precipitation_amount || 0);
        }
        
        const dates = Object.keys(dailyMap).slice(0, 7);
        
        const result = {
            weather: {
                current: {
                    temperature_2m: cData.air_temperature,
                    relative_humidity_2m: cData.relative_humidity,
                    apparent_temperature: cData.air_temperature,
                    precipitation: current.data.next_1_hours?.details?.precipitation_amount || 0,
                    wind_speed_10m: (cData.wind_speed * 3.6).toFixed(1),
                    weather_code: 999,
                    condition_text: metNoEmoji(sym)
                },
                daily: {
                    time: dates,
                    temperature_2m_max: dates.map(d => dailyMap[d].max),
                    temperature_2m_min: dates.map(d => dailyMap[d].min),
                    condition_text: dates.map(d => metNoEmoji(dailyMap[d].symbol)),
                    precipitation_sum: dates.map(d => dailyMap[d].precip)
                }
            },
            aqi: null,
            kp: 0
        };
        
        weatherCache[cacheKey] = { timestamp: now, data: result };
        return result;
    } catch (error) {
        if (weatherCache[cacheKey]) return weatherCache[cacheKey].data;
        throw new Error(error.response ? JSON.stringify(error.response.data) : error.message);
    }
};

const fetchPrayerTimes = async (lat, lon) => {
    try {
        const url = `http://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=2`;
        const res = await axios.get(url);
        return res.data.data.timings;
    } catch(e) {
        return null;
    }
};

const fetchCurrency = async () => {
    try {
        const res = await axios.get('https://cbu.uz/uz/arkhiv-kursov-valyut/json/');
        const usd = res.data.find(d => d.Ccy === 'USD');
        const eur = res.data.find(d => d.Ccy === 'EUR');
        const rub = res.data.find(d => d.Ccy === 'RUB');
        let text = `🇺🇿 <b>Markaziy Bank kurslari:</b>\n\n`;
        text += `🇺🇸 1 USD = ${usd.Rate} UZS (${usd.Diff > 0 ? '📈 +'+usd.Diff : '📉 '+usd.Diff})\n`;
        text += `🇪🇺 1 EUR = ${eur.Rate} UZS (${eur.Diff > 0 ? '📈 +'+eur.Diff : '📉 '+eur.Diff})\n`;
        text += `🇷🇺 1 RUB = ${rub.Rate} UZS (${rub.Diff > 0 ? '📈 +'+rub.Diff : '📉 '+rub.Diff})\n`;
        return text;
    } catch(e) {
        return "Valyuta kurslarini olishda xatolik.";
    }
};

const generateChartUrl = (dates, tempsMax, tempsMin, regionName) => {
    const chart = {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                { label: 'Maks. Harorat (°C)', data: tempsMax, borderColor: 'rgba(255, 99, 132, 1)', fill: false },
                { label: 'Min. Harorat (°C)', data: tempsMin, borderColor: 'rgba(54, 162, 235, 1)', fill: false }
            ]
        }
    };
    return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chart))}&w=600&h=400`;
};

const formatCurrentWeather = (data, regionName, t) => {
    const w = data.weather.current;
    const condition = w.condition_text || t.condition[w.weather_code] || "Noma'lum";
    
    let warnings = [];
    if (w.wind_speed_10m > 40) warnings.push("⚠️ KUCHLI SHAMOL XAVFI!");
    if (w.temperature_2m < -10) warnings.push("❄️ QATTIQ SOVUQ XAVFI!");
    if (w.temperature_2m > 40) warnings.push("🔥 JAZIRAMA ISSIQ XAVFI!");
    if (data.kp >= 5) warnings.push(`🧽 DIQQAT: KUCHLI MAGNIT BO'RONI KUZATILMOQDA (Kp: ${data.kp}). Qon bosimingizni nazorat qiling!`);
    
    let text = warnings.length > 0 ? warnings.join("\n") + "\n\n" : "";
    
    text += `📍 <b>${regionName}</b> (${t.today}):\n\n`;
    text += `🌡️ <b>Temp:</b> ${w.temperature_2m}°C <i>(His: ${w.apparent_temperature}°C)</i>\n`;
    text += `☁️ <b>Holat:</b> ${condition}\n`;
    text += `💧 <b>Namlik:</b> ${w.relative_humidity_2m}%\n`;
    text += `💨 <b>Shamol:</b> ${w.wind_speed_10m} km/soat\n`;
    
    if (data.aqi && data.aqi.current) {
        const aqi = data.aqi.current.us_aqi;
        let aqiStatus = aqi < 50 ? "Yaxshi 🟢" : aqi < 100 ? "O'rtacha 🟡" : "Zararli 🔴";
        text += `\n🌫 <b>Havo sifati (AQI):</b> ${aqi} - ${aqiStatus}\n`;
    }
    
    // Indekslar
    const temp = w.temperature_2m;
    const isPicnic = temp >= 18 && temp <= 32 && w.wind_speed_10m < 20 && w.precipitation === 0;
    text += `\n🍖 <b>Piknik indeksi:</b> ${isPicnic ? "Dam olish va sayr uchun ajoyib ob-havo! 🌳" : "Bugun ochiq havoda dam olish unchalik qulay emas."}`;
    
    return text;
};

const formatIndices = (data, regionName) => {
    const daily = data.weather.daily;
    const rainDays = daily.precipitation_sum.slice(0, 3).filter(p => p > 0.5).length;
    
    let text = `🚙 <b>${regionName}</b> uchun Indekslar:\n\n`;
    text += `🧲 <b>Magnit Bo'roni (Kp-Index):</b> ${data.kp} / 9\n`;
    text += `<i>${data.kp >= 5 ? "⚠️ Magnit bo'roni faol. Qon bosimi borlar ehtiyot bo'ling." : "✅ Magnit maydoni barqaror."}</i>\n\n`;
    
    text += `🚗 <b>Avto-moyka Indeksi:</b>\n`;
    text += `<i>${rainDays > 0 ? "❌ Hozir mashina yuvish tavsiya etilmaydi, yaqin 3 kunda yomg'ir yog'ishi mumkin." : "✅ Mashinangizni bemalol yuvishingiz mumkin, yaqin 3 kunda yomg'ir kutilmayapti!"}</i>`;
    return text;
};

const formatForecast = (data, regionName, t, days) => {
    const daily = data.weather.daily;
    let text = `📍 <b>${regionName}</b> (${days === 1 ? t.tomorrow : t.weekly}):\n\n`;
    const limit = days === 1 ? 2 : 7;
    for (let i = (days === 1 ? 1 : 0); i < limit; i++) {
        const date = new Date(daily.time[i]).toLocaleDateString('ru-RU');
        const cond = daily.condition_text?.[i] || t.condition[daily.weather_code?.[i]] || "";
        text += `📅 <b>${date}</b>: ${cond} | ${daily.temperature_2m_min[i]}°C...${daily.temperature_2m_max[i]}°C\n`;
    }
    return text;
};

const actionKeyboard = (lat, lon, regionName, t) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(t.today, `today_${regionName}`), Markup.button.callback(t.tomorrow, `tomor_${regionName}`)],
        [Markup.button.callback(t.weekly, `week_${regionName}`), Markup.button.callback(t.graph, `graph_${regionName}`)],
        [Markup.button.callback(t.indices, `idx_${regionName}`), Markup.button.callback(t.prayer, `pray_${regionName}`)],
        [Markup.button.callback(t.subscribe, `sub_${regionName}`)]
    ]);
};

bot.start((ctx) => {
    const t = getT(ctx);
    ctx.reply(t.welcome, getMainMenu(t));
    ctx.reply("Hududlar:", getRegionsKeyboard());
});

bot.hears(['⚙️ Sozlamalar', '⚙️ Созламалар', '⚙️ Настройки'], (ctx) => {
    ctx.reply("Sozlamalar bo'limi", Markup.inlineKeyboard([
        [Markup.button.callback("O'zbekcha", "lang_uz")]
    ]));
});

bot.hears(['💵 Valyuta', '💵 Valyuta kurslari'], async (ctx) => {
    const text = await fetchCurrency();
    ctx.replyWithHTML(text);
});

bot.hears('🌋 Zilzilalar', async (ctx) => {
    try {
        const res = await axios.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson');
        const quakes = res.data.features.filter(q => {
            const [lon, lat] = q.geometry.coordinates;
            // Markaziy Osiyo hududi
            return lat >= 35 && lat <= 45 && lon >= 55 && lon <= 75;
        });
        
        if (quakes.length === 0) return ctx.reply("✅ O'zbekiston va unga qo'shni hududlarda so'nggi 24 soat ichida kuchli (4.5+ magnituda) zilzilalar qayd etilmadi.");
        
        let text = "🚨 <b>So'nggi 24 soatdagi zilzilalar (M.O):</b>\n\n";
        quakes.forEach(q => {
            text += `📍 Joy: ${q.properties.place}\n📈 Magnituda: ${q.properties.mag}\n🕰 Vaqt: ${new Date(q.properties.time).toLocaleString('uz-UZ')}\n\n`;
        });
        ctx.replyWithHTML(text);
    } catch(e) {
        ctx.reply("Zilzilalar ma'lumotini olishda xatolik.");
    }
});

// Admin commands
bot.command('admin', (ctx) => {
    const text = ctx.message.text.split(' ');
    if (text[1] === ADMIN_PASSWORD) {
        const user = getUser(ctx);
        user.isAdmin = true;
        saveDb();
        ctx.reply("Tabriklayman! Siz admin bo'ldingiz.");
    }
});
bot.command('stats', (ctx) => {
    if (!getUser(ctx).isAdmin) return;
    ctx.reply(`📊 Jami foydalanuvchilar: ${Object.keys(db).length}`);
});

bot.command('users', (ctx) => {
    if (!getUser(ctx).isAdmin) return;
    let usersArray = Object.entries(db).map(([id, user]) => ({id, ...user}));
    usersArray.sort((a, b) => (b.last_active || 0) - (a.last_active || 0));
    
    usersArray = usersArray.slice(0, 50);
    
    let text = "👥 <b>Foydalanuvchilar (So'nggi faollar):</b>\n\n";
    let count = 1;
    for (const u of usersArray) {
        const name = u.first_name || "Noma'lum";
        const username = u.username ? ` (${u.username})` : "";
        let dateStr = "Noma'lum";
        if (u.last_active) {
            dateStr = new Date(u.last_active).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
        }
        text += `${count}. <a href="tg://user?id=${u.id}">${name}</a>${username}\n⏳ Oxirgi: ${dateStr}\n\n`;
        count++;
    }
    ctx.replyWithHTML(text);
});

bot.command('broadcast', (ctx) => {
    if (!getUser(ctx).isAdmin) return;
    const msg = ctx.message.text.substring(10).trim();
    if (!msg) return ctx.reply("Xabar matnini kiriting. Masalan: /broadcast Assalomu alaykum!");
    let count = 0;
    for (const chatId in db) {
        bot.telegram.sendMessage(chatId, `📢 <b>Admin xabari:</b>\n\n${msg}`, { parse_mode: 'HTML' }).then(() => count++).catch(() => {});
    }
    ctx.reply(`Xabar ${Object.keys(db).length} ta foydalanuvchiga yuborilmoqda...`);
});

bot.on('location', async (ctx) => {
    const lat = ctx.message.location.latitude;
    const lon = ctx.message.location.longitude;
    const t = getT(ctx);
    
    let nearest = "Toshkent";
    let minDist = Infinity;
    for (const [name, coords] of Object.entries(REGIONS)) {
        const dist = Math.pow(coords.lat - lat, 2) + Math.pow(coords.lon - lon, 2);
        if (dist < minDist) {
            minDist = dist;
            nearest = name;
        }
    }
    
    try {
        const data = await fetchWeatherData(REGIONS[nearest].lat, REGIONS[nearest].lon);
        const text = formatCurrentWeather(data, nearest, t);
        ctx.replyWithHTML(`📍 Sizga eng yaqin hudud: <b>${nearest}</b>\n\n` + text, actionKeyboard(REGIONS[nearest].lat, REGIONS[nearest].lon, nearest, t));
    } catch (e) {
        ctx.reply(t.error);
    }
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;
    try {
        if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE" || !GEMINI_API_KEY) {
             return ctx.reply("Hozircha men faqat tugmalar orqali ishlayman. 🌤️ Ob-havoni bilish uchun qaysidir viloyatni tanlang yoki pastdagi tugmalardan foydalaning.", getRegionsKeyboard());
        }
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Sen ob-havo va tabiat bo'yicha yordamchisan. Savollarga qisqa va aniq o'zbek tilida javob ber. Foydalanuvchi: ${text}`);
        ctx.reply(result.response.text());
    } catch(e) {
        ctx.reply("Hozircha faqat tugmalardan foydalaning.", getRegionsKeyboard());
    }
});

bot.action(/^reg_(.+)$/, async (ctx) => {
    const regionName = ctx.match[1];
    if (!REGIONS[regionName]) return ctx.answerCbQuery();
    const { lat, lon } = REGIONS[regionName];
    const t = getT(ctx);
    try {
        const data = await fetchWeatherData(lat, lon);
        const text = formatCurrentWeather(data, regionName, t);
        ctx.answerCbQuery();
        ctx.replyWithHTML(text, actionKeyboard(lat, lon, regionName, t));
    } catch (e) {
        ctx.answerCbQuery(t.error);
    }
});

bot.action(/^(today|tomor|week|idx|pray|graph)_(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const regionName = ctx.match[2];
    const t = getT(ctx);
    
    if (!REGIONS[regionName]) return ctx.answerCbQuery();
    const { lat, lon } = REGIONS[regionName];
    
    try {
        let text = "";
        if (action === 'pray') {
            const pt = await fetchPrayerTimes(lat, lon);
            text = `🕌 <b>${regionName}</b> namoz vaqtlari:\nTong: ${pt.Fajr}\nQuyosh: ${pt.Sunrise}\nPeshin: ${pt.Dhuhr}\nAsr: ${pt.Asr}\nShom: ${pt.Maghrib}\nXufton: ${pt.Isha}`;
            ctx.answerCbQuery();
            ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: actionKeyboard(lat, lon, regionName, t).reply_markup });
        } else if (action === 'graph') {
            const data = await fetchWeatherData(lat, lon);
            const daily = data.weather.daily;
            const dates = daily.time.map(d => new Date(d).toLocaleDateString('ru-RU'));
            const chartUrl = generateChartUrl(dates, daily.temperature_2m_max, daily.temperature_2m_min, regionName);
            ctx.answerCbQuery();
            ctx.replyWithPhoto({ url: chartUrl }, { caption: `📈 ${regionName} grafigi` });
        } else {
            const data = await fetchWeatherData(lat, lon);
            if (action === 'today') text = formatCurrentWeather(data, regionName, t);
            else if (action === 'tomor') text = formatForecast(data, regionName, t, 1);
            else if (action === 'week') text = formatForecast(data, regionName, t, 7);
            else if (action === 'idx') text = formatIndices(data, regionName);
            
            ctx.answerCbQuery();
            ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: actionKeyboard(lat, lon, regionName, t).reply_markup });
        }
    } catch (e) {
        ctx.answerCbQuery(t.error);
    }
});

bot.action(/^sub_(.+)$/, (ctx) => {
    const regionName = ctx.match[1];
    const user = getUser(ctx);
    const t = getT(ctx);
    
    if (user.subscribed && user.region === regionName) {
        user.subscribed = false;
        saveDb();
        ctx.answerCbQuery(t.unsub_success, { show_alert: true });
    } else {
        user.subscribed = true;
        user.region = regionName;
        saveDb();
        ctx.answerCbQuery(t.sub_success, { show_alert: true });
    }
});

cron.schedule('0 7 * * *', async () => {
    for (const [chatId, user] of Object.entries(db)) {
        if (user.subscribed && user.region && REGIONS[user.region]) {
            try {
                const data = await fetchWeatherData(REGIONS[user.region].lat, REGIONS[user.region].lon);
                bot.telegram.sendMessage(chatId, `⏰ <b>Xayrli tong!</b>\n\n` + formatCurrentWeather(data, user.region, I18N['uz']), { parse_mode: 'HTML' });
            } catch (e) {}
        }
    }
});

const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot ishladi va Webhook orqali ulandi! 🚀'));

app.get('/test', async (req, res) => {
    try {
        const data = await fetchWeatherData(41.2995, 69.2401);
        res.json(data);
    } catch (e) {
        res.status(500).send("Xatolik: " + e.message);
    }
});

const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;

if (RENDER_URL) {
    const webhookPath = `/bot${token}`;
    bot.telegram.setWebhook(`${RENDER_URL}${webhookPath}`);
    app.use(bot.webhookCallback(webhookPath));
    console.log(`Webhook o'rnatildi: ${RENDER_URL}`);
} else {
    bot.launch().then(() => console.log('Bot Polling orqali ishga tushdi...'));
}

app.listen(PORT, () => {
    console.log(`Express server porti ${PORT} da ishga tushdi.`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
