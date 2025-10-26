const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Конфигурация
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// In-memory storage (в продакшене заменить на базу данных)
const orders = new Map();

// Стоимости услуг
const serviceCosts = {
    'weekly_horoscope': 333,
    'compatibility': 55,
    'tarot': 888,
    'natal_chart': 999
};

// Создание инвойса для Telegram Stars
app.post('/api/create-invoice', async (req, res) => {
    try {
        const { user_id, service_type, service_data } = req.body;
        
        console.log('Creating invoice for:', { user_id, service_type, service_data });

        if (!user_id || !service_type) {
            return res.status(400).json({ 
                success: false, 
                error: 'Отсутствуют обязательные параметры' 
            });
        }

        const amount = serviceCosts[service_type];
        if (!amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Неизвестный тип услуги' 
            });
        }

        // Создаем уникальный ID заказа
        const orderId = uuidv4();
        
        // Сохраняем данные заказа
        orders.set(orderId, {
            user_id,
            service_type,
            service_data,
            amount,
            status: 'pending',
            created_at: new Date().toISOString()
        });

        // Для демо-режима создаем фиктивную ссылку на инвойс
        // В реальном приложении здесь будет вызов Telegram API
        const invoiceLink = `https://t.me/your_bot_username/invoice?start=${orderId}`;
        
        res.json({
            success: true,
            order_id: orderId,
            invoice_link: invoiceLink
        });

    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка при создании инвойса',
            details: error.message
        });
    }
});

// Генерация ежедневного гороскопа
app.post('/api/daily-horoscope', async (req, res) => {
    try {
        const { user_id, zodiac_sign } = req.body;
        
        console.log('Generating daily horoscope for:', zodiac_sign);

        if (!zodiac_sign) {
            return res.status(400).json({ 
                success: false, 
                error: 'Не указан знак зодиака' 
            });
        }

        // Генерируем контент через Gemini API
        const content = await generateServiceContent('daily_horoscope', { zodiac_sign });
        
        res.json({
            success: true,
            content: content
        });

    } catch (error) {
        console.error('Error generating daily horoscope:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка при генерации гороскопа'
        });
    }
});

// Получение результата услуги
app.get('/api/service-result/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = orders.get(orderId);
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                error: 'Заказ не найден' 
            });
        }
        
        if (order.status !== 'paid') {
            return res.status(402).json({ 
                success: false, 
                error: 'Услуга не оплачена' 
            });
        }
        
        // Если контент уже сгенерирован, возвращаем его
        if (order.service_content) {
            return res.json({
                success: true,
                service_type: order.service_type,
                service_data: order.service_data,
                content: order.service_content,
                paid_at: order.paid_at
            });
        }
        
        // Генерируем контент услуги
        const serviceContent = await generateServiceContent(order.service_type, order.service_data);
        
        // Сохраняем контент
        order.service_content = serviceContent;
        
        res.json({
            success: true,
            service_type: order.service_type,
            service_data: order.service_data,
            content: serviceContent,
            paid_at: order.paid_at
        });
        
    } catch (error) {
        console.error('Error getting service result:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения результата' 
        });
    }
});

// Вебхук для обработки успешных платежей (для реального бота)
app.post('/api/webhook/payment', async (req, res) => {
    try {
        const { order_id } = req.body;
        const order = orders.get(order_id);
        
        if (order && order.status === 'pending') {
            // Обновляем статус заказа
            order.status = 'paid';
            order.paid_at = new Date().toISOString();
            
            console.log('Order marked as paid:', order_id);
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Payment webhook error:', error);
        res.status(500).json({ success: false });
    }
});

// Генерация контента через Gemini API
async function generateServiceContent(serviceType, serviceData) {
    try {
        const prompt = createPrompt(serviceType, serviceData);
        
        console.log('Generating content with prompt:', prompt);
        
        const response = await axios.post(GEMINI_API_URL, {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000,
            }
        });

        return response.data.candidates[0].content.parts[0].text;
        
    } catch (error) {
        console.error('Gemini API Error:', error.response?.data || error.message);
        return generateDemoResponse(serviceType, serviceData);
    }
}

// Вспомогательные функции
function createPrompt(serviceType, serviceData) {
    const prompts = {
        'daily_horoscope': `Напиши краткий ежедневный гороскоп для знака зодиака ${serviceData.zodiac_sign} на сегодня. 
Сделай его позитивным и мотивирующим, длиной 100-150 слов. Опиши ключевые тенденции дня и дай практический совет.`,

        'weekly_horoscope': `Напиши подробный недельный гороскоп для знака зодиака ${serviceData.zodiac_sign}. 
Опиши основные тенденции в личной жизни, работе, здоровье и финансах на предстоящую неделю. 
Дай практические рекомендации. Будь позитивным и мотивирующим. Длина 250-300 слов.`,

        'compatibility': `Проанализируй совместимость между знаками зодиака ${serviceData.first_sign} и ${serviceData.second_sign}. 
Опиши сильные и слабые стороны этих отношений, потенциал для развития в любви, дружбе и работе. 
Дай конкретные рекомендации для гармонии. Длина 200-250 слов.`,

        'tarot': `Сделай психологический анализ с помощью карт Таро. 
Дай мудрый совет и интерпретацию, которая поможет в личностном росте и принятии решений. 
Будь поддерживающим и insightful. Длина 250-300 слов.`,

        'natal_chart': `Проанализируй натальную карту для человека. 
Опиши основные черты характера, таланты, потенциал и возможные жизненные уроки. 
Дай рекомендации по саморазвитию и реализации потенциала. Длина 300-350 слов.`
    };

    return prompts[serviceType] || 'Напиши астрологический анализ';
}

function generateDemoResponse(serviceType, serviceData) {
    const responses = {
        'daily_horoscope': `✨ Гороскоп на сегодня для ${serviceData.zodiac_sign}:\n\nСегодняшний день принесет вам новые возможности! Будьте открыты для неожиданных встреч и предложений. В первой половине дня сосредоточьтесь на важных задачах, а после обеда - время для творчества и общения.\n\nСовет дня: доверяйте своей интуиции и не бойтесь проявлять инициативу. Сегодня особенно благоприятное время для начала новых проектов.\n\nУдачного дня! 🌟`,

        'weekly_horoscope': `✨ Гороскоп на неделю для ${serviceData.zodiac_sign}:\n\nЭта неделя принесет вам новые возможности! Будьте готовы к неожиданным поворотам судьбы. В середине недели возможны важные встречи. В работе - время проявлять инициативу. В личной жизни - гармония и взаимопонимание. Финансы: осторожность в крупных тратах.\n\nСовет недели: доверяйте своей интуиции и не бойтесь перемен!\n\nУдачной недели! 🌟`,

        'compatibility': `💑 Совместимость ${serviceData.first_sign} и ${serviceData.second_sign}:\n\nЭти два знака имеют хороший потенциал для гармоничных отношений! Сильные стороны: взаимное уважение и общие интересы. Слабые стороны: возможны разногласия в бытовых вопросах.\n\nРекомендации:\n• Учитесь слушать друг друга\n• Находите время для совместного отдыха\n• Уважайте личное пространство\n\nСовместимость: 85% ⭐`,

        'tarot': `🃏 Расклад Таро:\n\nКарты показывают, что вы на правильном пути! Сейчас важный период для самоанализа и планирования.\n\nКлючевые моменты:\n• Сила - у вас достаточно мудрости для преодоления challenges\n• Звезда - впереди ждут прекрасные возможности\n• Мир - гармония и завершение циклов\n\nСовет: сохраняйте баланс и не торопите события. Доверяйте себе! ✨`,

        'natal_chart': `🌌 Ваша натальная карта:\n\nВаша карта рождения указывает на сильную личность с большим потенциалом!\n\nОсновные черты:\n• Лидерские качества и целеустремленность\n• Развитая интуиция и эмпатия\n• Творческий подход к решению задач\n\nРекомендации:\n• Развивайте коммуникативные навыки\n• Уделяйте время самообразованию\n• Балансируйте работу и отдых\n\nУспехов в саморазвитии! 💫`
    };

    return responses[serviceType] || 'Информация временно недоступна. Пожалуйста, попробуйте позже.';
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        services: Object.keys(serviceCosts)
    });
});

// Получение информации о заказе
app.get('/api/order/:orderId', (req, res) => {
    const { orderId } = req.params;
    const order = orders.get(orderId);
    
    if (!order) {
        return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }
    
    res.json({ success: true, order });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Astrology Bot Backend running on port ${PORT}`);
    console.log(`📊 Available services:`, Object.keys(serviceCosts));
});

module.exports = app;