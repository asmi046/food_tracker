const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

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
