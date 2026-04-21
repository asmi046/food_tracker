const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

const SYSTEM_PROMPT = `Ты профессиональный диетолог и нутрициолог. На переданном фото порция потребляемой еды. Твоя задача проанализировать это изображение разделить его на составные ингридиенты, затем для каждого ингредиента определить:

- спопоб приготовлени
- приблизительный вес
- энергетическую уенность
- БЖУ

При анализе учитывай и опирайся на то что средний размер тарелки 21 см в диаметре. Если на фото видна рука держащая продукт учитывай что длинна лодони 18 см а ширина 7 см.

Проанализировава каждый ингридиент согласно указанным выше правилам ты должен посчитать суммарные параметры блюда изображенного на фото и выдать результат в формате json:

{
"productName": "Name of the food product in Russian",
"proteins": 0.0,
"fats": 0.0,
"carbs": 0.0,
"calories": 0.0,
"portionGrams": 50,
"confidence": "high|medium|low"
}

Правила формирования ответа:

- Все числовые значения (белки, жиры, углеводы, калории) это суммарные значения по всем ингридиентам блюда
- portionGrams - это приблизительный общий вес всех ингридиентов блюда
- Используйте десятичные числа (например, 12,5, а не 12)
- Название продукта должно быть на русском языке
- Если вы не можете идентифицировать продукт, установите значение достоверности (confidence) "низкое" и используйте 0 для всех значений
- Никогда не возвращайте ничего, кроме объекта JSON
- Не добавляй текст до и после обекта.`;

function createOpenaiAdapter({ apiKey, model }) {
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required');
    }

    const resolvedModel = model || 'gpt-4o-mini';

    function parseNutritionResponse(content) {
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

    async function analyzeImage(imageBuffer) {
        const base64 = Buffer.isBuffer(imageBuffer)
            ? imageBuffer.toString('base64')
            : imageBuffer;

        const body = {
            model: resolvedModel,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Определи блюдо на фото и верни БЖУ/ккал для всей порции на тарелке в JSON формате.',
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64}`,
                            },
                        },
                    ],
                },
            ],
            temperature: 0.1,
            max_tokens: 512,
        };

        const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('Empty response from OpenAI API');
        }

        const nutrition = parseNutritionResponse(content);

        return {
            ...nutrition,
            aiProvider: 'openai',
            aiModel: resolvedModel,
            aiRawResponse: content,
        };
    }

    return {
        analyzeImage,
        provider: 'openai',
        model: resolvedModel,
    };
}

module.exports = {
    createOpenaiAdapter,
};
