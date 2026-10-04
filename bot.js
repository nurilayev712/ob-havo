const { Telegraf, Markup, session } = require('telegraf');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const token = '8653744492:AAHxdUwVkrKPhBraaas6eeBNjT-Vn1_FRmQ';
const bot = new Telegraf(token);
const ADMIN_PASSWORD = "havo_admin_2026";

const DB_FILE = path.join(__dirname, 'database.json');
let db = {};
if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
const saveDb = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

const getUser = (ctx) => {
    const id = ctx.chat?.id || ctx.from?.id;
    if (!db[id]) db[id] = { lang: 'uz', subscribed: false, isAdmin: false };
    return db[id];
};

const I18N = {
    uz: {
        welcome: "Assalomu alaykum! 🌤️\n\nQaysi viloyat ob-havosi sizni qiziqtiradi? Quyidagi tugmalardan birini tanlang yoki joylashuvingizni yuboring:",
        send_loc: "📍 Joylashuvni yuborish",
        settings: "⚙️ Sozlamalar",
        choose_lang: "Tilni tanlang:",
        lang_saved: "Til o'zgartirildi! 🇺🇿",
        today: "Bugun",
        tomorrow: "Ertaga",
        weekly: "7 kunlik",
        subscribe: "🔔 Har kuni 07:00 da ob-havo olish",
        unsubscribe: "🔕 Obunani bekor qilish",
        sub_success: "Siz har kuni 07:00 da ob-havo ma'lumotlarini qabul qilasiz! ✅",
        unsub_success: "Obuna bekor qilindi. ❌",
        error: "Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.",
        prayer: "🕌 Namoz",
        agro: "🌱 Agro-info",
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
    },
    uz_cyr: {
        welcome: "Ассалому алайкум! 🌤️\n\nҚайси вилоят об-ҳавоси сизни қизиқтиради? Қуйидаги тугмалардан бирини танланг ёки жойлашувингизни юборинг:",
        send_loc: "📍 Жойлашувни юбориш",
        settings: "⚙️ Созламалар",
        choose_lang: "Тилни танланг:",
        lang_saved: "Тил ўзгартирилди! 🇺🇿",
        today: "Бугун",
        tomorrow: "Эртага",
        weekly: "7 кунлик",
        subscribe: "🔔 Ҳар куни 07:00 да об-ҳаво олиш",
        unsubscribe: "🔕 Обунани бекор қилиш",
        sub_success: "Сиз ҳар куни 07:00 да об-ҳаво маълумотларини қабул қиласиз! ✅",
        unsub_success: "Обуна бекор қилинди. ❌",
        error: "Хатолик юз берди. Илтимос кейинроқ уриниб кўринг.",
        prayer: "🕌 Намоз",
        agro: "🌱 Агро-инфо",
        condition: {
            0: "Очиқ ҳаво ☀️", 1: "Қисман булутли ⛅", 2: "Булутли ☁️", 3: "Булутли ☁️",
            45: "Туман 🌫️", 48: "Туман 🌫️",
            51: "Ёмғир шивалаши 🌧️", 53: "Ёмғир шивалаши 🌧️", 55: "Ёмғир шивалаши 🌧️",
            61: "Ёмғир 🌧️", 63: "Ёмғир 🌧️", 65: "Ёмғир 🌧️",
            71: "Қор ❄️", 73: "Қор ❄️", 75: "Қор ❄️", 77: "Қор ❄️",
            80: "Кучли ёмғир 🌧️", 81: "Кучли ёмғир 🌧️", 82: "Кучли ёмғир 🌧️",
            85: "Кучли қор ❄️", 86: "Кучли қор ❄️",
            95: "Момақалдироқ ⛈️", 96: "Момақалдироқ ⛈️", 99: "Момақалдироқ ⛈️"
        }
    },
    ru: {
        welcome: "Здравствуйте! 🌤️\n\nПогода в каком регионе вас интересует? Выберите кнопку ниже или отправьте свою геопозицию:",
        send_loc: "📍 Отправить геопозицию",
        settings: "⚙️ Настройки",
        choose_lang: "Выберите язык:",
        lang_saved: "Язык изменен! 🇷🇺",
        today: "Сегодня",
        tomorrow: "Завтра",
        weekly: "На 7 дней",
        subscribe: "🔔 Получать погоду каждый день в 07:00",
        unsubscribe: "🔕 Отписаться от рассылки",
        sub_success: "Вы будете получать прогноз каждый день в 07:00! ✅",
        unsub_success: "Подписка отменена. ❌",
        error: "Произошла ошибка. Пожалуйста, попробуйте позже.",
        prayer: "🕌 Намаз",
        agro: "🌱 Агро-инфо",
        condition: {
            0: "Ясно ☀️", 1: "Малооблачно ⛅", 2: "Облачно с прояснениями ⛅", 3: "Пасмурно ☁️",
            45: "Туман 🌫️", 48: "Туман 🌫️",
            51: "Морось 🌧️", 53: "Морось 🌧️", 55: "Морось 🌧️",
            61: "Дождь 🌧️", 63: "Дождь 🌧️", 65: "Дождь 🌧️",
            71: "Снег ❄️", 73: "Снег ❄️", 75: "Снег ❄️", 77: "Снег ❄️",
            80: "Сильный дождь 🌧️", 81: "Сильный дождь 🌧️", 82: "Сильный дождь 🌧️",
            85: "Сильный снег ❄️", 86: "Сильный снег ❄️",
            95: "Гроза ⛈️", 96: "Гроза ⛈️", 99: "Гроза ⛈️"
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

const getT = (ctx) => I18N[getUser(ctx).lang] || I18N['uz'];

const getMainMenu = (t) => {
    return Markup.keyboard([
        [Markup.button.locationRequest(t.send_loc)],
        [t.settings]
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

const fetchWeatherData = async (lat, lon) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,soil_temperature_0cm&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5&timezone=auto`;
    
    const [weatherReq, aqiReq] = await Promise.all([
        axios.get(url).catch(() => null),
        axios.get(aqiUrl).catch(() => null)
    ]);
    
    return {
        weather: weatherReq ? weatherReq.data : null,
        aqi: aqiReq ? aqiReq.data : null
    };
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

const checkExtremeWeather = (current) => {
    let warnings = [];
    if (current.wind_speed_10m > 40) warnings.push("⚠️ KUCHLI SHAMOL XAVFI!");
    if (current.temperature_2m < -10) warnings.push("❄️ QATTIQ SOVUQ XAVFI!");
    if (current.temperature_2m > 40) warnings.push("🔥 JAZIRAMA ISSIQ XAVFI!");
    if ([80,81,82,95,96,99].includes(current.weather_code)) warnings.push("🌪 KUCHLI JALA / BO'RON!");
    return warnings.length > 0 ? warnings.join("\n") + "\n\n" : "";
};

const formatCurrentWeather = (data, regionName, t) => {
    const w = data.weather.current;
    const condition = t.condition[w.weather_code] || "Noma'lum";
    const warnings = checkExtremeWeather(w);
    
    let text = warnings;
    text += `📍 <b>${regionName}</b> (${t.today}):\n\n`;
    text += `🌡️ <b>Temp:</b> ${w.temperature_2m}°C <i>(His: ${w.apparent_temperature}°C)</i>\n`;
    text += `☁️ <b>Holat:</b> ${condition}\n`;
    text += `💧 <b>Namlik:</b> ${w.relative_humidity_2m}%\n`;
    text += `💨 <b>Shamol:</b> ${w.wind_speed_10m} km/soat\n`;
    
    if (data.aqi && data.aqi.current) {
        const aqi = data.aqi.current.us_aqi;
        let aqiStatus = aqi < 50 ? "Yaxshi 🟢" : aqi < 100 ? "O'rtacha 🟡" : "Zararli 🔴 (Niqob taqing!)";
        text += `\n🌫 <b>Havo sifati (AQI):</b> ${aqi} - ${aqiStatus}\n`;
        text += `😷 <b>Chang (PM2.5):</b> ${data.aqi.current.pm2_5} µg/m³\n`;
    }
    return text;
};

const formatAgro = (data, regionName, t) => {
    const w = data.weather.current;
    let text = `🌱 <b>${regionName}</b> (Agro-ma'lumot):\n\n`;
    text += `🌡️ Havo harorati: ${w.temperature_2m}°C\n`;
    text += `🌍 Tuproq harorati (ustki): ${w.soil_temperature_0cm}°C\n`;
    text += `💧 Havo namligi: ${w.relative_humidity_2m}%\n`;
    text += `☔ Yog'ingarchilik: ${w.precipitation} mm\n`;
    if (w.soil_temperature_0cm < 5) text += `\n⚠️ Tuproq sovuq, urug' qadashga erta!`;
    else if (w.soil_temperature_0cm > 15) text += `\n✅ Tuproq harorati ekin ekish uchun qulay!`;
    return text;
};

const formatForecast = (data, regionName, t, days) => {
    const daily = data.weather.daily;
    let text = `📍 <b>${regionName}</b> (${days === 1 ? t.tomorrow : t.weekly}):\n\n`;
    
    const limit = days === 1 ? 2 : 7;
    const startIdx = days === 1 ? 1 : 0; 
    
    for (let i = startIdx; i < limit; i++) {
        const date = new Date(daily.time[i]).toLocaleDateString('ru-RU');
        const cond = t.condition[daily.weather_code[i]] || "";
        text += `📅 <b>${date}</b>: ${cond}\n`;
        text += `🌡️ ${daily.temperature_2m_min[i]}°C ... ${daily.temperature_2m_max[i]}°C\n\n`;
    }
    return text;
};

const actionKeyboard = (lat, lon, regionName, t) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(t.today, `today_${regionName}`), Markup.button.callback(t.tomorrow, `tomor_${regionName}`)],
        [Markup.button.callback(t.weekly, `week_${regionName}`), Markup.button.callback(t.agro, `agro_${regionName}`)],
        [Markup.button.callback(t.prayer, `pray_${regionName}`)],
        [Markup.button.callback(t.subscribe, `sub_${regionName}`)]
    ]);
};

bot.start((ctx) => {
    const t = getT(ctx);
    ctx.reply(t.welcome, getMainMenu(t));
    ctx.reply("Hududlar:", getRegionsKeyboard());
});

bot.hears(['⚙️ Sozlamalar', '⚙️ Созламалар', '⚙️ Настройки'], (ctx) => {
    const t = getT(ctx);
    ctx.reply(t.choose_lang, Markup.inlineKeyboard([
        [Markup.button.callback("O'zbekcha (Lotin)", "lang_uz")],
        [Markup.button.callback("Ўзбекча (Кирилл)", "lang_uz_cyr")],
        [Markup.button.callback("Русский", "lang_ru")]
    ]));
});

// Admin Panel commands
bot.command('admin', (ctx) => {
    const text = ctx.message.text.split(' ');
    if (text[1] === ADMIN_PASSWORD) {
        const user = getUser(ctx);
        user.isAdmin = true;
        saveDb();
        ctx.reply("Tabriklayman! Siz admin bo'ldingiz.\nBuyruqlar:\n/stats - Statistika\n/broadcast <xabar> - Barchaga xabar yuborish");
    }
});

bot.command('stats', (ctx) => {
    const user = getUser(ctx);
    if (!user.isAdmin) return;
    const count = Object.keys(db).length;
    let subs = Object.values(db).filter(u => u.subscribed).length;
    ctx.reply(`📊 Jami foydalanuvchilar: ${count}\n🔔 Obunachilar: ${subs}`);
});

bot.command('broadcast', async (ctx) => {
    const user = getUser(ctx);
    if (!user.isAdmin) return;
    const msg = ctx.message.text.substring(10).trim();
    if (!msg) return ctx.reply("Xabarni kiriting: /broadcast Salom hammaga!");
    
    let sent = 0;
    for (const chatId of Object.keys(db)) {
        try {
            await bot.telegram.sendMessage(chatId, `📢 <b>Admin xabari:</b>\n\n${msg}`, { parse_mode: 'HTML' });
            sent++;
        } catch(e) {}
    }
    ctx.reply(`✅ Xabar ${sent} ta foydalanuvchiga yuborildi.`);
});

bot.action(/^lang_(.+)$/, (ctx) => {
    const lang = ctx.match[1];
    const user = getUser(ctx);
    user.lang = lang;
    saveDb();
    const t = getT(ctx);
    ctx.answerCbQuery();
    ctx.reply(t.lang_saved, getMainMenu(t));
});

bot.on('location', async (ctx) => {
    const { latitude, longitude } = ctx.message.location;
    const t = getT(ctx);
    try {
        const data = await fetchWeatherData(latitude, longitude);
        const text = formatCurrentWeather(data, "Sizning manzilingiz", t);
        ctx.replyWithHTML(text);
    } catch (e) {
        ctx.reply(t.error);
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

bot.action(/^(today|tomor|week|agro|pray)_(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const regionName = ctx.match[2];
    const t = getT(ctx);
    
    if (!REGIONS[regionName]) return ctx.answerCbQuery();
    const { lat, lon } = REGIONS[regionName];
    
    try {
        let text = "";
        if (action === 'pray') {
            const pt = await fetchPrayerTimes(lat, lon);
            if (!pt) throw new Error("API error");
            text = `🕌 <b>${regionName}</b> uchun bugungi namoz vaqtlari:\n\n🌅 Tong: ${pt.Fajr}\n🌄 Quyosh: ${pt.Sunrise}\n☀️ Peshin: ${pt.Dhuhr}\n🌤 Asr: ${pt.Asr}\n🌇 Shom: ${pt.Maghrib}\n🌙 Xufton: ${pt.Isha}`;
        } else {
            const data = await fetchWeatherData(lat, lon);
            if (action === 'today') text = formatCurrentWeather(data, regionName, t);
            else if (action === 'tomor') text = formatForecast(data, regionName, t, 1);
            else if (action === 'week') text = formatForecast(data, regionName, t, 7);
            else if (action === 'agro') text = formatAgro(data, regionName, t);
        }
        
        ctx.answerCbQuery();
        ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: actionKeyboard(lat, lon, regionName, t).reply_markup });
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

// CRON JOB
cron.schedule('0 7 * * *', async () => {
    console.log("Running daily notifications...");
    for (const [chatId, user] of Object.entries(db)) {
        if (user.subscribed && user.region && REGIONS[user.region]) {
            const { lat, lon } = REGIONS[user.region];
            const t = I18N[user.lang] || I18N['uz'];
            try {
                const data = await fetchWeatherData(lat, lon);
                const text = `⏰ <b>Xayrli tong!</b>\n\n` + formatCurrentWeather(data, user.region, t);
                bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
            } catch (e) {}
        }
    }
});

const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot ishladi va Webhook orqali ulandi! 🚀'));

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
