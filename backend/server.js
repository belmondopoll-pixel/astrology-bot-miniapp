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

// In-memory storage
const orders = new Map();
const userSessions = new Map();

// Стоимости услуг
const serviceCosts = {
    'weekly_horoscope': 333,
    'compatibility': 55,
    'tarot': 888,
    'natal_chart': 999
};

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        services: Object.keys(serviceCosts)
    });
});

// Корневой путь для проверки
app.get('/', (req, res) => {
  res.json({ 
    message: 'Astrology Bot Backend is running!',
    timestamp: new Date().toISOString(),
    endpoints: ['/api/health', '/api/daily-horoscope', '/api/create-invoice', etc...]
  });
});

// Создание инвойса для Telegram Stars
app.post('/api/create-invoice', async (req, res) => {
    try {
        const { user_id, service_type, service_data } = req.body;
        
        console.log('Creating invoice for:', { user_id, service_type, service_data });

        if (!user_id || !service_type) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required parameters' 
            });
        }

        const amount = serviceCosts[service_type];
        if (!amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Unknown service type' 
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

        // Для реального бота здесь будет вызов Telegram Bot API
        // Сейчас возвращаем успех для демонстрации
        res.json({
            success: true,
            order_id: orderId,
            invoice_link: `https://t.me/your_bot?start=${orderId}`,
            amount: amount
        });

    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Invoice creation failed',
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
                error: 'Zodiac sign not specified' 
            });
        }

        // Генерируем контент
        const content = await generateHoroscopeContent('daily', zodiac_sign);
        
        res.json({
            success: true,
            content: content
        });

    } catch (error) {
        console.error('Error generating daily horoscope:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Horoscope generation failed'
        });
    }
});

// Генерация недельного гороскопа
app.post('/api/weekly-horoscope', async (req, res) => {
    try {
        const { user_id, zodiac_sign } = req.body;
        
        if (!zodiac_sign) {
            return res.status(400).json({ 
                success: false, 
                error: 'Zodiac sign not specified' 
            });
        }

        const content = await generateHoroscopeContent('weekly', zodiac_sign);
        
        res.json({
            success: true,
            content: content
        });

    } catch (error) {
        console.error('Error generating weekly horoscope:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Weekly horoscope generation failed'
        });
    }
});

// Генерация совместимости
app.post('/api/compatibility', async (req, res) => {
    try {
        const { user_id, first_sign, second_sign } = req.body;
        
        if (!first_sign || !second_sign) {
            return res.status(400).json({ 
                success: false, 
                error: 'Both signs required' 
            });
        }

        const content = await generateCompatibilityContent(first_sign, second_sign);
        
        res.json({
            success: true,
            content: content
        });

    } catch (error) {
        console.error('Error generating compatibility:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Compatibility analysis failed'
        });
    }
});

// Генерация расклада Таро
app.post('/api/tarot-reading', async (req, res) => {
    try {
        const { user_id, spread_type } = req.body;
        
        if (!spread_type) {
            return res.status(400).json({ 
                success: false, 
                error: 'Spread type required' 
            });
        }

        const content = await generateTarotReading(spread_type);
        
        res.json({
            success: true,
            content: content
        });

    } catch (error) {
        console.error('Error generating tarot reading:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Tarot reading failed'
        });
    }
});

// Генерация натальной карты
app.post('/api/natal-chart', async (req, res) => {
    try {
        const { user_id, birth_data } = req.body;
        
        if (!birth_data || !birth_data.birth_date) {
            return res.status(400).json({ 
                success: false, 
                error: 'Birth data required' 
            });
        }

        const content = await generateNatalChart(birth_data);
        
        res.json({
            success: true,
            content: content
        });

    } catch (error) {
        console.error('Error generating natal chart:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Natal chart generation failed'
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
                error: 'Order not found' 
            });
        }
        
        // Генерируем контент услуги
        let serviceContent;
        switch (order.service_type) {
            case 'weekly_horoscope':
                serviceContent = await generateHoroscopeContent('weekly', order.service_data.zodiac_sign);
                break;
            case 'compatibility':
                serviceContent = await generateCompatibilityContent(
                    order.service_data.first_sign, 
                    order.service_data.second_sign
                );
                break;
            case 'tarot':
                serviceContent = await generateTarotReading(order.service_data.spread_type);
                break;
            case 'natal_chart':
                serviceContent = await generateNatalChart(order.service_data.birth_data);
                break;
            default:
                serviceContent = 'Service content not available';
        }
        
        // Помечаем как выполненный
        order.status = 'completed';
        order.completed_at = new Date().toISOString();
        order.service_content = serviceContent;
        
        res.json({
            success: true,
            service_type: order.service_type,
            service_data: order.service_data,
            content: serviceContent,
            completed_at: order.completed_at
        });
        
    } catch (error) {
        console.error('Error getting service result:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Service result retrieval failed' 
        });
    }
});

// Вспомогательные функции для генерации контента
async function generateHoroscopeContent(type, zodiacSign) {
    try {
        if (GEMINI_API_KEY) {
            const prompt = type === 'daily' 
                ? `Напиши краткий ежедневный гороскоп для знака зодиака ${zodiacSign} на сегодня. Сделай его позитивным и мотивирующим, длиной 150-200 слов.`
                : `Напиши подробный недельный гороскоп для знака зодиака ${zodiacSign}. Опиши основные тенденции в личной жизни, работе, здоровье и финансах на предстоящую неделю. Длина 300-400 слов.`;

            const response = await axios.post(GEMINI_API_URL, {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                }
            });

            return response.data.candidates[0].content.parts[0].text;
        }
    } catch (error) {
        console.error('Gemini API Error:', error.message);
    }

    // Fallback контент
    return generateFallbackHoroscope(type, zodiacSign);
}

async function generateCompatibilityContent(firstSign, secondSign) {
    try {
        if (GEMINI_API_KEY) {
            const prompt = `Проанализируй совместимость между знаками зодиака ${firstSign} и ${secondSign}. Опиши сильные и слабые стороны этих отношений, потенциал для развития в любви, дружбе и работе. Дай конкретные рекомендации для гармонии. Длина 250-300 слов.`;

            const response = await axios.post(GEMINI_API_URL, {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                }
            });

            return response.data.candidates[0].content.parts[0].text;
        }
    } catch (error) {
        console.error('Gemini API Error:', error.message);
    }

    return generateFallbackCompatibility(firstSign, secondSign);
}

async function generateTarotReading(spreadType) {
    try {
        if (GEMINI_API_KEY) {
            const prompt = `Сделай психологический анализ с помощью карт Таро для расклада "${spreadType}". Дай мудрый совет и интерпретацию, которая поможет в личностном росте и принятии решений. Будь поддерживающим и insightful. Длина 300-350 слов.`;

            const response = await axios.post(GEMINI_API_URL, {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 2000,
                }
            });

            return response.data.candidates[0].content.parts[0].text;
        }
    } catch (error) {
        console.error('Gemini API Error:', error.message);
    }

    return generateFallbackTarot(spreadType);
}

async function generateNatalChart(birthData) {
    try {
        if (GEMINI_API_KEY) {
            const prompt = `Проанализируй натальную карту для человека родившегося ${birthData.birth_date} в ${birthData.birth_place}. Опиши основные черты характера, таланты, потенциал и возможные жизненные уроки. Дай рекомендации по саморазвитию и реализации потенциала. Длина 400-500 слов.`;

            const response = await axios.post(GEMINI_API_URL, {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2500,
                }
            });

            return response.data.candidates[0].content.parts[0].text;
        }
    } catch (error) {
        console.error('Gemini API Error:', error.message);
    }

    return generateFallbackNatalChart(birthData);
}

// Fallback контент
function generateFallbackHoroscope(type, zodiacSign) {
    const baseText = type === 'daily' 
        ? `✨ Гороскоп на сегодня для ${zodiacSign}:\n\nСегодняшний день принесет вам новые возможности! Звезды располагают к активным действиям и смелым решениям. В первой половине дня сосредоточьтесь на важных задачах, а после обеда - время для творчества и общения.\n\nСовет дня: доверяйте своей интуиции и не бойтесь проявлять инициативу. Сегодня особенно благоприятное время для начала новых проектов и установления важных связей.\n\nЭнергетика дня: ⭐⭐⭐⭐☆\nУдачного дня! 🌟`
        : `✨ Гороскоп на неделю для ${zodiacSign}:\n\nНа этой неделе вас ждут интересные события! Понедельник и вторник - время для планирования и организации. Среда и четверг принесут неожиданные возможности в профессиональной сфере. Пятница - идеальный день для социальной активности и встреч с друзьями.\n\nВ выходные уделите время отдыху и саморазвитию. Возможны важные insights и откровения, которые помогут в личностном росте.\n\nФинансы: стабильность с возможностью неожиданных поступлений.\nЗдоровье: обратите внимание на баланс работы и отдыха.\n\nУдачной недели! 🌟`;

    return baseText;
}

function generateFallbackCompatibility(firstSign, secondSign) {
    return `💑 Совместимость ${firstSign} и ${secondSign}:\n\nЭти два знака имеют хороший потенциал для гармоничных отношений! \n\n🌟 Сильные стороны:\n• Взаимное уважение и понимание\n• Общие интересы и ценности\n• Способность поддерживать друг друга в трудные моменты\n\n⚠️ Слабые стороны:\n• Возможны разногласия в бытовых вопросах\n• Периодические недопонимания из-за разного темперамента\n\n💡 Рекомендации:\n• Учитесь слушать и слышать друг друга\n• Находите время для совместного отдыха и хобби\n• Уважайте личное пространство партнера\n• Открыто обсуждайте возникающие вопросы\n\nОбщая совместимость: 85% ⭐\nЛюбовь: 80% ❤️\nДружба: 90% 🤝\nРабота: 75% 💼`;
}

function generateFallbackTarot(spreadType) {
    return `🃏 Расклад Таро: ${spreadType}\n\nКарты показывают, что вы находитесь на важном этапе своего пути! Сейчас время для глубокого самоанализа и принятия взвешенных решений.\n\n✨ Ключевые сообщения:\n• Карта Силы указывает на вашу внутреннюю мудрость и способность преодолевать challenges\n• Звезда символизирует надежду и новые возможности на горизонте\n• Карта Мира говорит о завершении циклов и достижении гармонии\n\n💫 Советы карт:\n• Сохраняйте баланс между действием и ожиданием\n• Доверяйте своей интуиции при принятии решений\n• Не бойтесь просить помощи у близких\n• Уделите время медитации и саморефлексии\n\nПомните: карты лишь показывают потенциал, окончательный выбор всегда за вами!`;
}

function generateFallbackNatalChart(birthData) {
    return `🌌 Натальная карта для рождения ${birthData.birth_date}\n\nВаша карта рождения указывает на сильную и многогранную личность с большим потенциалом!\n\n✨ Основные характеристики:\n• Сильные лидерские качества и целеустремленность\n• Развитая интуиция и эмпатия\n• Творческий подход к решению задач\n• Способность вдохновлять других\n\n🌟 Таланты и способности:\n• Коммуникативные навыки и дар убеждения\n• Аналитический склад ума\n• Художественное восприятие мира\n• Способность к быстрому обучению\n\n💫 Рекомендации по развитию:\n• Развивайте навыки публичных выступлений\n• Уделяйте время постоянному самообразованию\n• Балансируйте работу и отдых для поддержания энергии\n• Развивайте эмоциональный интеллект\n\n🎯 Жизненные уроки:\n• Научиться делегировать задачи\n• Развивать терпение в достижении целей\n• Балансировать между логикой и интуицией\n\nУспехов в вашем пути саморазвития! 💫`;
}

// Получение информации о заказе
app.get('/api/order/:orderId', (req, res) => {
    const { orderId } = req.params;
    const order = orders.get(orderId);
    
    if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    res.json({ success: true, order });
});

// Получение истории заказов пользователя
app.get('/api/user-orders/:userId', (req, res) => {
    const { userId } = req.params;
    const userOrders = Array.from(orders.values())
        .filter(order => order.user_id == userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json({ success: true, orders: userOrders });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Astrology Bot Backend running on port ${PORT}`);
    console.log(`📊 Available services:`, Object.keys(serviceCosts));
    console.log(`🔑 Gemini API:`, GEMINI_API_KEY ? 'Configured' : 'Not configured');
});

module.exports = app;