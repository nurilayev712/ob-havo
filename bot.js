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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const DB_FILE = path.join(__dirname, 'database.json');
let db = {};
if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

let Mongoose = null;
let UserModel = null;
try {
    Mongoose = require('mongoose');
    if (process.env.MONGODB_URI) {
        Mongoose.connect(process.env.MONGODB_URI).then(() => console.log('MongoDB ulandi!')).catch(console.error);
        UserModel = Mongoose.model('User', new Mongoose.Schema({
            id: String, lang: String, subscribed: Boolean, subTime: String, region: String, isAdmin: Boolean, first_name: String, username: String, last_active: Number
        }, { strict: false }));
        
        // Sync from Mongo on startup
        UserModel.find({}).then(users => {
            users.forEach(u => {
                if (!db[u.id] || (u.last_active && u.last_active > (db[u.id].last_active || 0))) {
                    db[u.id] = u.toObject();
                }
            });
        });
    }
} catch(e) {}

const saveDb = () => {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    if (UserModel) {
        for (const [id, user] of Object.entries(db)) {
            UserModel.findOneAndUpdate({ id }, { ...user, id }, { upsert: true }).catch(()=>{});
        }
    }
};

bot.use((ctx, next) => {
    const from = ctx.from;
    if (from) {
        const id = from.id;
        if (!db[id]) db[id] = { lang: 'uz', subscribed: false, isAdmin: false, subTime: '07:00' };
        db[id].first_name = from.first_name || '';
        db[id].username = from.username ? `@${from.username}` : '';
        db[id].last_active = Date.now();
        saveDb();
    }
    return next();
});

const getUser = (ctx) => {
    const id = ctx.chat?.id || ctx.from?.id;
    if (!db[id]) db[id] = { lang: 'uz', subscribed: false, isAdmin: false, subTime: '07:00' };
    return db[id];
};

const I18N = {
    uz: {
        welcome: "Assalomu alaykum! 🌤️\n\nQaysi viloyat ob-havosi sizni qiziqtiradi?",
        send_loc: "📍 Joylashuvni yuborish",
        settings: "⚙️ Sozlamalar",
        currency: "💵 Valyuta",
        agro: "🌱 Agro-rejim",
        choose_lang: "Tilni tanlang / Выберите язык:",
        lang_saved: "Til o'zgartirildi! 🇺🇿",
        today: "Bugun",
        tomorrow: "Ertaga",
        weekly: "7 kunlik",
        graph: "📈 Grafik",
        subscribe: "🔔 Obuna",
        unsubscribe: "🔕 Bekor qilish",
        sub_success: "Obuna vaqti o'rnatildi! ✅",
        unsub_success: "Obuna bekor qilindi. ❌",
        error: "Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.",
        prayer: "🕌 Namoz",
        indices: "🚙 Indekslar"
    },
    ru: {
        welcome: "Здравствуйте! 🌤️\n\nПогода в каком регионе вас интересует?",
        send_loc: "📍 Отправить геолокацию",
        settings: "⚙️ Настройки",
        currency: "💵 Валюта",
        agro: "🌱 Агро-режим",
        choose_lang: "Tilni tanlang / Выберите язык:",
        lang_saved: "Язык изменен! 🇷🇺",
        today: "Сегодня",
        tomorrow: "Завтра",
        weekly: "На 7 дней",
        graph: "📈 График",
        subscribe: "🔔 Подписка",
        unsubscribe: "🔕 Отписаться",
        sub_success: "Время подписки установлено! ✅",
        unsub_success: "Подписка отменена. ❌",
        error: "Произошла ошибка. Пожалуйста, попробуйте позже.",
        prayer: "🕌 Намаз",
        indices: "🚙 Индексы"
    }
};

const REGIONS = {
    "Toshkent": { lat: 41.2995, lon: 69.2401, name_ru: "Ташкент" },
    "Andijon": { lat: 40.7821, lon: 72.3442, name_ru: "Андижан" },
    "Buxoro": { lat: 39.7747, lon: 64.4286, name_ru: "Бухара" },
    "Farg'ona": { lat: 40.3842, lon: 71.7843, name_ru: "Фергана" },
    "Jizzax": { lat: 40.1158, lon: 67.8422, name_ru: "Джизак" },
    "Namangan": { lat: 40.9983, lon: 71.6726, name_ru: "Наманган" },
    "Navoiy": { lat: 40.0844, lon: 65.3792, name_ru: "Навои" },
    "Qashqadaryo": { lat: 38.8606, lon: 65.7891, name_ru: "Кашкадарья" },
    "Samarqand": { lat: 39.6542, lon: 66.9597, name_ru: "Самарканд" },
    "Sirdaryo": { lat: 40.4897, lon: 68.7842, name_ru: "Сырдарья" },
    "Surxondaryo": { lat: 37.2242, lon: 67.2783, name_ru: "Сурхандарья" },
    "Xorazm": { lat: 41.55, lon: 60.6333, name_ru: "Хорезм" },
    "Qoraqalpog'iston": { lat: 42.4619, lon: 59.6166, name_ru: "Каракалпакстан" }
};

const getT = (ctx) => {
    const user = getUser(ctx);
    return I18N[user.lang] || I18N['uz'];
};

const getMainMenu = (t) => {
    return Markup.keyboard([
        [Markup.button.locationRequest(t.send_loc)],
        [t.currency, Markup.button.webApp("🛰 Jonli Radar", "https://yandex.uz/pogoda/maps/radar")],
        ["🌋 Zilzilalar", t.settings]
    ]).resize();
};

const getRegionsKeyboard = (lang) => {
    const keys = Object.keys(REGIONS);
    const keyboard = [];
    for (let i = 0; i < keys.length; i += 2) {
        const name1 = lang === 'ru' ? REGIONS[keys[i]].name_ru : keys[i];
        const row = [Markup.button.callback(name1, `reg_${keys[i]}`)];
        if (i + 1 < keys.length) {
            const name2 = lang === 'ru' ? REGIONS[keys[i+1]].name_ru : keys[i+1];
            row.push(Markup.button.callback(name2, `reg_${keys[i+1]}`));
        }
        keyboard.push(row);
    }
    return Markup.inlineKeyboard(keyboard);
};

const weatherCache = {};

const metNoEmoji = (sym, lang) => {
    if (!sym) return "☁️";
    if (sym.includes('clear') || sym.includes('fair')) return lang === 'ru' ? "☀️ Ясно" : "☀️ Ochiq havo";
    if (sym.includes('partlycloudy')) return lang === 'ru' ? "⛅ Переменная облачность" : "⛅ Qisman bulutli";
    if (sym.includes('cloudy')) return lang === 'ru' ? "☁️ Облачно" : "☁️ Bulutli";
    if (sym.includes('rain')) return lang === 'ru' ? "🌧️ Дождь" : "🌧️ Yomg'ir";
    if (sym.includes('snow')) return lang === 'ru' ? "❄️ Снег" : "❄️ Qor";
    if (sym.includes('thunder')) return lang === 'ru' ? "⛈️ Гроза" : "⛈️ Momaqaldiroq";
    if (sym.includes('fog')) return lang === 'ru' ? "🌫️ Туман" : "🌫️ Tuman";
    return lang === 'ru' ? "☁️ Облачно" : "☁️ Bulutli";
};

const fetchWeatherData = async (lat, lon, lang = 'uz') => {
    const cacheKey = `${lat}_${lon}`;
    const now = Date.now();
    if (weatherCache[cacheKey] && now - weatherCache[cacheKey].timestamp < 15 * 60 * 1000) {
        return weatherCache[cacheKey].data;
    }
    
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5&timezone=auto`;
    const kpUrl = `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`;
    
    const opts = { headers: { 'User-Agent': 'ObHavoBot/2.0 (https://t.me/obhavo712_bot)' } };
    
    try {
        const [res, aqiReq, kpReq] = await Promise.all([
            axios.get(url, opts),
            axios.get(aqiUrl, opts).catch(() => null),
            axios.get(kpUrl, opts).catch(() => null)
        ]);
        
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
        
        let kpIndex = 0;
        if (kpReq && kpReq.data) {
            const latest = kpReq.data[kpReq.data.length - 1];
            kpIndex = parseFloat(latest[1]);
        }
        
        const result = {
            weather: {
                current: {
                    temperature_2m: cData.air_temperature,
                    relative_humidity_2m: cData.relative_humidity,
                    apparent_temperature: cData.air_temperature,
                    precipitation: current.data.next_1_hours?.details?.precipitation_amount || 0,
                    wind_speed_10m: (cData.wind_speed * 3.6).toFixed(1),
                    weather_code: 999,
                    condition_text: metNoEmoji(sym, lang)
                },
                daily: {
                    time: dates,
                    temperature_2m_max: dates.map(d => dailyMap[d].max),
                    temperature_2m_min: dates.map(d => dailyMap[d].min),
                    condition_text: dates.map(d => metNoEmoji(dailyMap[d].symbol, lang)),
                    precipitation_sum: dates.map(d => dailyMap[d].precip)
                }
            },
            aqi: aqiReq ? aqiReq.data : null,
            kp: kpIndex
        };
        
        weatherCache[cacheKey] = { timestamp: now, data: result };
        return result;
    } catch (error) {
        if (weatherCache[cacheKey]) return weatherCache[cacheKey].data;
        throw new Error(error.message);
    }
};

const fetchPrayerTimes = async (lat, lon) => {
    try {
        const url = `http://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=2`;
        const res = await axios.get(url);
        return res.data.data.timings;
    } catch(e) { return null; }
};

const fetchCurrency = async (lang) => {
    try {
        const res = await axios.get('https://cbu.uz/uz/arkhiv-kursov-valyut/json/');
        const usd = res.data.find(d => d.Ccy === 'USD');
        const eur = res.data.find(d => d.Ccy === 'EUR');
        const rub = res.data.find(d => d.Ccy === 'RUB');
        let text = lang === 'ru' ? `🇷🇺 <b>Курсы ЦБ РУз:</b>\n\n` : `🇺🇿 <b>Markaziy Bank kurslari:</b>\n\n`;
        text += `🇺🇸 1 USD = ${usd.Rate} UZS\n`;
        text += `🇪🇺 1 EUR = ${eur.Rate} UZS\n`;
        text += `🇷🇺 1 RUB = ${rub.Rate} UZS\n`;
        return text;
    } catch(e) { return "Xatolik / Ошибка."; }
};

const generateChartUrl = (dates, tempsMax, tempsMin, regionName) => {
    const chart = {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                { label: 'Max (°C)', data: tempsMax, borderColor: 'rgba(255, 99, 132, 1)', fill: false },
                { label: 'Min (°C)', data: tempsMin, borderColor: 'rgba(54, 162, 235, 1)', fill: false }
            ]
        }
    };
    return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chart))}&w=600&h=400`;
};

const formatCurrentWeather = (data, regionName, t, lang) => {
    const w = data.weather.current;
    const condition = w.condition_text || "Noma'lum";
    
    let warnings = [];
    if (w.wind_speed_10m > 40) warnings.push(lang==='ru' ? "⚠️ ВНИМАНИЕ: СИЛЬНЫЙ ВЕТЕР!" : "⚠️ KUCHLI SHAMOL XAVFI!");
    if (w.temperature_2m < -10) warnings.push(lang==='ru' ? "❄️ СИЛЬНЫЙ ХОЛОД!" : "❄️ QATTIQ SOVUQ XAVFI!");
    if (w.temperature_2m > 40) warnings.push(lang==='ru' ? "🔥 СИЛЬНАЯ ЖАРА!" : "🔥 JAZIRAMA ISSIQ XAVFI!");
    if (data.kp >= 5) warnings.push(lang==='ru' ? `🧽 МАГНИТНАЯ БУРЯ (Kp: ${data.kp}).` : `🧽 DIQQAT: KUCHLI MAGNIT BO'RONI (Kp: ${data.kp}).`);
    if (data.aqi && data.aqi.current && data.aqi.current.us_aqi > 150) warnings.push(lang==='ru' ? `😷 ГРЯЗНЫЙ ВОЗДУХ (AQI: ${data.aqi.current.us_aqi}). Наденьте маску!` : `😷 HAVO IFLOSLANISHI YUQORI (AQI: ${data.aqi.current.us_aqi}). Niqob taqish tavsiya etiladi!`);
    
    let text = warnings.length > 0 ? warnings.join("\n") + "\n\n" : "";
    text += `📍 <b>${regionName}</b> (${t.today}):\n\n`;
    text += `🌡️ <b>Temp:</b> ${w.temperature_2m}°C <i>(${lang==='ru'?'Ощущается':'His'}: ${w.apparent_temperature}°C)</i>\n`;
    text += `☁️ <b>${lang==='ru'?'Состояние':'Holat'}:</b> ${condition}\n`;
    text += `💧 <b>${lang==='ru'?'Влажность':'Namlik'}:</b> ${w.relative_humidity_2m}%\n`;
    text += `💨 <b>${lang==='ru'?'Ветер':'Shamol'}:</b> ${w.wind_speed_10m} ${lang==='ru'?'км/ч':'km/soat'}\n`;
    
    if (data.aqi && data.aqi.current) {
        const aqi = data.aqi.current.us_aqi;
        let aqiStatus = aqi < 50 ? (lang==='ru'?"Хорошо 🟢":"Yaxshi 🟢") : aqi < 100 ? (lang==='ru'?"Средне 🟡":"O'rtacha 🟡") : (lang==='ru'?"Вредно 🔴":"Zararli 🔴");
        text += `\n🌫 <b>${lang==='ru'?'Качество воздуха (AQI)':'Havo sifati (AQI)'}:</b> ${aqi} - ${aqiStatus}\n`;
    }
    
    const temp = w.temperature_2m;
    const isPicnic = temp >= 18 && temp <= 32 && w.wind_speed_10m < 20 && w.precipitation === 0;
    text += `\n🍖 <b>${lang==='ru'?'Индекс пикника':'Piknik indeksi'}:</b> ${isPicnic ? (lang==='ru'?"Отличная погода! 🌳":"Ajoyib ob-havo! 🌳") : (lang==='ru'?"Некомфортно":"Noqulay ob-havo")}`;
    
    return text;
};

const formatIndices = (data, regionName, lang) => {
    const daily = data.weather.daily;
    const rainDays = daily.precipitation_sum.slice(0, 3).filter(p => p > 0.5).length;
    let text = `🚙 <b>${regionName}</b> ${lang==='ru'?'Индексы':'Indekslar'}:\n\n`;
    text += `🧲 <b>${lang==='ru'?'Магнитная буря':'Magnit Bo\'roni'} (Kp-Index):</b> ${data.kp} / 9\n`;
    text += `🚗 <b>${lang==='ru'?'Индекс автомойки':'Avto-moyka Indeksi'}:</b>\n`;
    text += `<i>${rainDays > 0 ? (lang==='ru'?"❌ Не рекомендуется мыть машину.":"❌ Mashina yuvish tavsiya etilmaydi.") : (lang==='ru'?"✅ Можно мыть машину!":"✅ Mashina yuvish tavsiya etiladi!")}</i>`;
    return text;
};

const formatAgro = (data, regionName, lang) => {
    const daily = data.weather.daily;
    let text = `🌱 <b>${regionName}</b> ${lang==='ru'?'Агро-режим':'Agro-rejim'}:\n\n`;
    for(let i=0; i<3; i++) {
        const date = new Date(daily.time[i]).toLocaleDateString('ru-RU');
        const max = daily.temperature_2m_max[i];
        const min = daily.temperature_2m_min[i];
        const precip = daily.precipitation_sum[i];
        
        let warning = "";
        if (min < 3) warning += lang==='ru' ? "❄️ Риск заморозков! " : "❄️ Sovuq urish (Заморозки) xavfi! ";
        if (max > 35) warning += lang==='ru' ? "🔥 Жара, рекомендуется полив. " : "🔥 Jazirama, tez-tez sug'orish tavsiya etiladi. ";
        if (precip > 5) warning += lang==='ru' ? "🌧️ Ожидается сильный дождь. " : "🌧️ Kuchli yomg'ir kutilmoqda. ";
        
        text += `📅 <b>${date}</b>: ${min}°C...${max}°C\n`;
        text += `💧 ${lang==='ru'?'Осадки':'Yog\'ingarchilik'}: ${precip.toFixed(1)} mm\n`;
        if (warning) text += `<i>${warning}</i>\n`;
        text += `\n`;
    }
    return text;
};

const formatForecast = (data, regionName, t, days) => {
    const daily = data.weather.daily;
    let text = `📍 <b>${regionName}</b> (${days === 1 ? t.tomorrow : t.weekly}):\n\n`;
    const limit = days === 1 ? 2 : 7;
    for (let i = (days === 1 ? 1 : 0); i < limit; i++) {
        const date = new Date(daily.time[i]).toLocaleDateString('ru-RU');
        const cond = daily.condition_text?.[i] || "";
        text += `📅 <b>${date}</b>: ${cond} | ${daily.temperature_2m_min[i]}°C...${daily.temperature_2m_max[i]}°C\n`;
    }
    return text;
};

const actionKeyboard = (lat, lon, regionName, t) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(t.today, `today_${regionName}`), Markup.button.callback(t.tomorrow, `tomor_${regionName}`)],
        [Markup.button.callback(t.weekly, `week_${regionName}`), Markup.button.callback(t.graph, `graph_${regionName}`)],
        [Markup.button.callback(t.indices, `idx_${regionName}`), Markup.button.callback(t.agro, `agro_${regionName}`)],
        [Markup.button.callback(t.prayer, `pray_${regionName}`)],
        [Markup.button.callback(t.subscribe, `subs_${regionName}`)]
    ]);
};

bot.start((ctx) => {
    const t = getT(ctx);
    ctx.reply(t.welcome, getMainMenu(t));
    ctx.reply(getUser(ctx).lang === 'ru' ? "Регионы:" : "Hududlar:", getRegionsKeyboard(getUser(ctx).lang));
});

bot.hears(['⚙️ Sozlamalar', '⚙️ Созламалар', '⚙️ Настройки'], (ctx) => {
    ctx.reply("Sozlamalar bo'limi / Настройки", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz"), Markup.button.callback("🇷🇺 Русский", "lang_ru")]
    ]));
});

bot.action(/^lang_(uz|ru)$/, (ctx) => {
    const user = getUser(ctx);
    user.lang = ctx.match[1];
    saveDb();
    ctx.answerCbQuery(I18N[user.lang].lang_saved);
    ctx.reply(I18N[user.lang].welcome, getMainMenu(I18N[user.lang]));
    ctx.reply(user.lang === 'ru' ? "Регионы:" : "Hududlar:", getRegionsKeyboard(user.lang));
});

bot.hears(['💵 Valyuta', '💵 Валюта', '💵 Valyuta kurslari'], async (ctx) => {
    const text = await fetchCurrency(getUser(ctx).lang);
    ctx.replyWithHTML(text);
});

bot.hears(['🌋 Zilzilalar', '🌋 Землетрясения'], async (ctx) => {
    const lang = getUser(ctx).lang;
    try {
        const res = await axios.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson');
        const quakes = res.data.features.filter(q => {
            const [lon, lat] = q.geometry.coordinates;
            return lat >= 35 && lat <= 45 && lon >= 55 && lon <= 75;
        });
        if (quakes.length === 0) return ctx.reply(lang === 'ru' ? "✅ Землетрясений не зафиксировано." : "✅ Zilzilalar qayd etilmadi.");
        let text = lang === 'ru' ? "🚨 <b>Землетрясения (ЦА):</b>\n\n" : "🚨 <b>Zilzilalar (M.O):</b>\n\n";
        quakes.forEach(q => {
            text += `📍 ${lang==='ru'?'Место':'Joy'}: ${q.properties.place}\n📈 Magnituda: ${q.properties.mag}\n🕰 ${lang==='ru'?'Время':'Vaqt'}: ${new Date(q.properties.time).toLocaleString('uz-UZ')}\n\n`;
        });
        ctx.replyWithHTML(text);
    } catch(e) {
        ctx.reply(lang === 'ru' ? "Ошибка." : "Xatolik.");
    }
});

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
    let text = "👥 <b>Foydalanuvchilar:</b>\n\n";
    let count = 1;
    for (const u of usersArray) {
        const name = u.first_name || "Noma'lum";
        const dateStr = u.last_active ? new Date(u.last_active).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : "Noma'lum";
        text += `${count}. <a href="tg://user?id=${u.id}">${name}</a>\n⏳ Oxirgi: ${dateStr}\n\n`;
        count++;
    }
    ctx.replyWithHTML(text);
});
bot.command('broadcast', (ctx) => {
    if (!getUser(ctx).isAdmin) return;
    const msg = ctx.message.text.substring(10).trim();
    if (!msg) return ctx.reply("Xabar matnini kiriting.");
    let count = 0;
    for (const chatId in db) {
        bot.telegram.sendMessage(chatId, `📢 <b>Admin xabari:</b>\n\n${msg}`, { parse_mode: 'HTML' }).then(() => count++).catch(() => {});
    }
    ctx.reply(`Xabar ${Object.keys(db).length} ta foydalanuvchiga yuborilmoqda...`);
});

bot.on('location', async (ctx) => {
    const lat = ctx.message.location.latitude;
    const lon = ctx.message.location.longitude;
    const user = getUser(ctx);
    const t = getT(ctx);
    let nearest = "Toshkent";
    let minDist = Infinity;
    for (const [name, coords] of Object.entries(REGIONS)) {
        const dist = Math.pow(coords.lat - lat, 2) + Math.pow(coords.lon - lon, 2);
        if (dist < minDist) { minDist = dist; nearest = name; }
    }
    try {
        const data = await fetchWeatherData(REGIONS[nearest].lat, REGIONS[nearest].lon, user.lang);
        const text = formatCurrentWeather(data, nearest, t, user.lang);
        const rep = user.lang === 'ru' ? `📍 Ближайший регион: <b>${REGIONS[nearest].name_ru}</b>\n\n` : `📍 Sizga eng yaqin hudud: <b>${nearest}</b>\n\n`;
        ctx.replyWithHTML(rep + text, actionKeyboard(REGIONS[nearest].lat, REGIONS[nearest].lon, nearest, t));
    } catch (e) { ctx.reply(t.error); }
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;
    try {
        if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE" || !GEMINI_API_KEY) {
             return ctx.reply(getUser(ctx).lang === 'ru' ? "Пожалуйста, используйте кнопки." : "Hozircha faqat tugmalardan foydalaning.", getRegionsKeyboard(getUser(ctx).lang));
        }
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Sen ob-havo yordamchisan. Qisqa javob ber. Foydalanuvchi: ${text}`);
        ctx.reply(result.response.text());
    } catch(e) { ctx.reply("Hozircha faqat tugmalardan foydalaning."); }
});

bot.action(/^reg_(.+)$/, async (ctx) => {
    const regionName = ctx.match[1];
    if (!REGIONS[regionName]) return ctx.answerCbQuery();
    const { lat, lon } = REGIONS[regionName];
    const user = getUser(ctx);
    const t = getT(ctx);
    const rName = user.lang === 'ru' ? REGIONS[regionName].name_ru : regionName;
    try {
        const data = await fetchWeatherData(lat, lon, user.lang);
        const text = formatCurrentWeather(data, rName, t, user.lang);
        ctx.answerCbQuery();
        ctx.replyWithHTML(text, actionKeyboard(lat, lon, regionName, t));
    } catch (e) { ctx.answerCbQuery(t.error); }
});

bot.action(/^(today|tomor|week|idx|agro|pray|graph)_(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const regionName = ctx.match[2];
    const user = getUser(ctx);
    const t = getT(ctx);
    if (!REGIONS[regionName]) return ctx.answerCbQuery();
    const { lat, lon } = REGIONS[regionName];
    const rName = user.lang === 'ru' ? REGIONS[regionName].name_ru : regionName;
    try {
        let text = "";
        if (action === 'pray') {
            const pt = await fetchPrayerTimes(lat, lon);
            text = `🕌 <b>${rName}</b>:\n${user.lang==='ru'?'Утро':'Tong'}: ${pt.Fajr}\n${user.lang==='ru'?'Восход':'Quyosh'}: ${pt.Sunrise}\n${user.lang==='ru'?'Обед':'Peshin'}: ${pt.Dhuhr}\n${user.lang==='ru'?'Аср':'Asr'}: ${pt.Asr}\n${user.lang==='ru'?'Магриб':'Shom'}: ${pt.Maghrib}\n${user.lang==='ru'?'Иша':'Xufton'}: ${pt.Isha}`;
            ctx.answerCbQuery();
            ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: actionKeyboard(lat, lon, regionName, t).reply_markup });
        } else if (action === 'graph') {
            const data = await fetchWeatherData(lat, lon, user.lang);
            const daily = data.weather.daily;
            const chartUrl = generateChartUrl(daily.time, daily.temperature_2m_max, daily.temperature_2m_min, rName);
            ctx.answerCbQuery();
            ctx.replyWithPhoto({ url: chartUrl }, { caption: `📈 ${rName}` });
        } else {
            const data = await fetchWeatherData(lat, lon, user.lang);
            if (action === 'today') text = formatCurrentWeather(data, rName, t, user.lang);
            else if (action === 'tomor') text = formatForecast(data, rName, t, 1);
            else if (action === 'week') text = formatForecast(data, rName, t, 7);
            else if (action === 'idx') text = formatIndices(data, rName, user.lang);
            else if (action === 'agro') text = formatAgro(data, rName, user.lang);
            ctx.answerCbQuery();
            ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: actionKeyboard(lat, lon, regionName, t).reply_markup });
        }
    } catch (e) { ctx.answerCbQuery(t.error); }
});

bot.action(/^subs_(.+)$/, (ctx) => {
    const regionName = ctx.match[1];
    const user = getUser(ctx);
    ctx.answerCbQuery();
    ctx.reply(user.lang === 'ru' ? `Выберите время (${REGIONS[regionName].name_ru}):` : `Obuna vaqtini tanlang (${regionName}):`, Markup.inlineKeyboard([
        [Markup.button.callback("06:00", `setSub_${regionName}_06:00`), Markup.button.callback("07:00", `setSub_${regionName}_07:00`)],
        [Markup.button.callback("08:00", `setSub_${regionName}_08:00`), Markup.button.callback("21:00", `setSub_${regionName}_21:00`)],
        [Markup.button.callback(user.lang === 'ru' ? "❌ Отписаться" : "❌ Bekor qilish", `setSub_${regionName}_none`)]
    ]));
});

bot.action(/^setSub_(.+)_(.+)$/, (ctx) => {
    const regionName = ctx.match[1];
    const time = ctx.match[2];
    const user = getUser(ctx);
    if (time === 'none') {
        user.subscribed = false;
        saveDb();
        ctx.editMessageText(I18N[user.lang].unsub_success);
    } else {
        user.subscribed = true;
        user.region = regionName;
        user.subTime = time;
        saveDb();
        ctx.editMessageText(`✅ ${user.lang === 'ru' ? 'Время установлено:' : 'Obuna vaqti:'} ${time} (${user.lang === 'ru' ? REGIONS[regionName].name_ru : regionName})`);
    }
});

cron.schedule('0 * * * *', async () => {
    const hourStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent', hour: '2-digit', hour12: false, minute: '2-digit' });
    const targetTime = `${hourStr.substring(0,2)}:00`;
    for (const [chatId, user] of Object.entries(db)) {
        const uTime = user.subTime || '07:00';
        if (user.subscribed && user.region && REGIONS[user.region] && uTime === targetTime) {
            try {
                const data = await fetchWeatherData(REGIONS[user.region].lat, REGIONS[user.region].lon, user.lang || 'uz');
                const rName = user.lang === 'ru' ? REGIONS[user.region].name_ru : user.region;
                const head = user.lang === 'ru' ? `⏰ <b>Прогноз погоды:</b>\n\n` : `⏰ <b>Kunlik ob-havo:</b>\n\n`;
                bot.telegram.sendMessage(chatId, head + formatCurrentWeather(data, rName, I18N[user.lang || 'uz'], user.lang || 'uz'), { parse_mode: 'HTML' });
            } catch (e) {}
        }
    }
});

const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot ishladi va Webhook orqali ulandi! 🚀 v2.0'));
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
