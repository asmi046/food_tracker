const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Системный промпт: просим модель вернуть строго JSON с БЖУ/ккал для всей порции на фото
const SYSTEM_PROMPT = `You are a food nutrition analyst.
When given an image of a food product, analyze it and respond ONLY with a valid JSON object.
Do not include any text before or after the JSON.

Required JSON format:
{
  "productName": "Name of the food product in Russian",
  "proteins": 0.0,
  "fats": 0.0,
  "carbs": 0.0,
  "calories": 0.0,
  "portionGrams": 100,
  "confidence": "high|medium|low"
}

Rules:
- All numeric values (proteins, fats, carbs, calories) must be for the FULL visible portion on the plate
- portionGrams is estimated total weight of the visible portion in grams
- Use decimal numbers (e.g. 12.5, not 12)
- productName must be in Russian
- If you cannot identify the food, set confidence to "low" and use 0 for all values
- Never return anything except the JSON object`;

function createOpenrouterAdapter({ apiKey, model }) {
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is required');
    }

    const resolvedModel = model || 'google/gemini-2.0-flash-lite';

    // Парсит строку ответа от модели и возвращает объект с БЖУ
    function parseNutritionResponse(content) {
        // Убираем markdown-обертку если модель вернула ```json ... ```
        const cleaned = content
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (e) {
            throw new Error(`AI returned invalid JSON: ${content}`);
        }

        // Проверяем что все нужные поля есть
        const required = ['productName', 'proteins', 'fats', 'carbs', 'calories'];
        for (const field of required) {
            if (parsed[field] === undefined || parsed[field] === null) {
                throw new Error(`AI response missing field: ${field}`);
            }
        }

        return {
            productName: String(parsed.productName),
            proteins: Number(parsed.proteins),
            fats: Number(parsed.fats),
            carbs: Number(parsed.carbs),
            calories: Number(parsed.calories),
            portionGrams: Number(parsed.portionGrams || 100),
            confidence: parsed.confidence || 'medium',
        };
    }

    // Основной метод: принимает Buffer или base64-строку изображения
    async function analyzeImage(imageBuffer) {
        const base64 = Buffer.isBuffer(imageBuffer)
            ? imageBuffer.toString('base64')
            : imageBuffer;

        const body = {
            model: resolvedModel,
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64}`,
                            },
                        },
                        {
                            type: 'text',
                            text: 'Определи блюдо на фото и верни БЖУ/ккал для всей порции на тарелке в JSON формате.',
                        },
                    ],
                },
            ],
            temperature: 0.1,
            max_tokens: 512,
        };

        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/food-tracker-bot',
                'X-Title': 'Food Tracker Bot',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('Empty response from OpenRouter API');
        }

        const nutrition = parseNutritionResponse(content);

        return {
            ...nutrition,
            aiProvider: 'openrouter',
            aiModel: resolvedModel,
            aiRawResponse: content,
        };
    }

    return {
        analyzeImage,
        provider: 'openrouter',
        model: resolvedModel,
    };
}

module.exports = {
    createOpenrouterAdapter,
};
