/**
 * Quiz Generation Service
 * Generates quiz questions using AI based on module content
 */

/**
 * Generate quiz questions for a module using AI
 * @param {string} moduleId - Module identifier (e.g., 'fst-committee')
 * @param {string} moduleTitle - Human-readable module title
 * @param {number} questionCount - Number of questions to generate (default: 5)
 * @returns {Promise<Array>} Generated questions
 */
export async function generateQuizQuestions(moduleId, moduleTitle, questionCount = 5) {
  try {
    const systemPrompt = `Ты — эксперт по созданию образовательных квизов для венчурного инвестирования.
Твоя задача — создать качественные вопросы для проверки знаний по модулю "${moduleTitle}".

ТРЕБОВАНИЯ К ВОПРОСАМ:
1. Вопросы должны быть конкретными и проверять реальное понимание, а не зазубривание
2. Используй разные типы вопросов: multiple-choice, true-false, fill-blank
3. Каждый вопрос должен иметь образовательную ценность
4. Объяснения должны быть информативными и помогать учиться
5. Вопросы должны быть на русском языке
6. Сложность: от базового до среднего уровня

ФОРМАТЫ ВОПРОСОВ:
1. multiple-choice: вопрос с 4 вариантами ответа
2. true-false: утверждение, которое верно или неверно
3. fill-blank: вопрос с пропуском, который нужно заполнить

Верни ответ СТРОГО в формате JSON array, без дополнительного текста.`

    const userPrompt = `Сгенерируй ${questionCount} вопросов для модуля "${moduleTitle}" (ID: ${moduleId}).

Верни JSON array в следующем формате:
[
  {
    "id": "generated-q1",
    "question": "Текст вопроса?",
    "type": "multiple-choice",
    "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
    "correctAnswer": 1,
    "explanation": "Подробное объяснение правильного ответа"
  },
  {
    "id": "generated-q2",
    "question": "Утверждение для проверки",
    "type": "true-false",
    "correctAnswer": true,
    "explanation": "Объяснение"
  },
  {
    "id": "generated-q3",
    "question": "Вопрос с пропуском: значение ___",
    "type": "fill-blank",
    "correctAnswer": ["правильный ответ", "альтернативный вариант"],
    "explanation": "Объяснение"
  }
]

ВАЖНО:
- Для fill-blank correctAnswer должен быть массивом возможных правильных ответов
- Для true-false correctAnswer должен быть boolean (true/false)
- Для multiple-choice correctAnswer — индекс правильного ответа (0-3)
- id должен быть уникальным для каждого вопроса`

    const response = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat', // Fast model for structured data
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        application: 'QuizGeneration',
        temperature: 0.7,
        maxTokens: 2000
      })
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const aiResponse = data.response

    // Parse JSON from AI response
    let questions
    try {
      // Try to extract JSON from response (in case AI added extra text)
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0])
      } else {
        questions = JSON.parse(aiResponse)
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse)
      throw new Error('Не удалось разобрать ответ AI. Попробуйте ещё раз.')
    }

    // Validate questions format
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('AI вернул некорректный формат вопросов')
    }

    // Validate each question
    questions.forEach((q, index) => {
      if (!q.id || !q.question || !q.type || !q.explanation) {
        throw new Error(`Вопрос ${index + 1} имеет некорректный формат`)
      }

      if (q.type === 'multiple-choice' && (!q.options || !Array.isArray(q.options) || q.options.length !== 4)) {
        throw new Error(`Вопрос ${index + 1}: multiple-choice должен иметь 4 варианта ответа`)
      }

      if (q.type === 'fill-blank' && !Array.isArray(q.correctAnswer)) {
        // Convert single answer to array
        q.correctAnswer = [q.correctAnswer]
      }
    })

    return questions
  } catch (error) {
    console.error('Error generating quiz questions:', error)
    throw error
  }
}

/**
 * Generate a scenario-based question using AI
 * @param {string} moduleId - Module identifier
 * @param {string} scenario - Scenario description
 * @returns {Promise<Object>} Generated scenario question
 */
export async function generateScenarioQuestion(moduleId, scenario) {
  try {
    const systemPrompt = `Ты — эксперт по созданию сценарных вопросов для венчурного инвестирования.
Создай реалистичный сценарий с вопросом для проверки практических навыков.`

    const userPrompt = `Создай сценарный вопрос на основе ситуации: "${scenario}"

Верни JSON в формате:
{
  "id": "scenario-q1",
  "question": "Описание сценария и вопрос",
  "type": "multiple-choice",
  "options": ["Действие 1", "Действие 2", "Действие 3", "Действие 4"],
  "correctAnswer": 0,
  "explanation": "Почему это правильное решение и что произойдёт при других выборах"
}`

    const response = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: 'anthropic/claude-sonnet-4-20250514', // Claude for complex scenarios
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        application: 'QuizGeneration',
        temperature: 0.8
      })
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const aiResponse = data.response

    // Parse JSON
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Не удалось извлечь JSON из ответа AI')
    }

    const question = JSON.parse(jsonMatch[0])
    return question
  } catch (error) {
    console.error('Error generating scenario question:', error)
    throw error
  }
}

/**
 * Enhance existing quiz questions with AI-generated alternatives
 * @param {Array} existingQuestions - Current quiz questions
 * @param {number} additionalCount - Number of additional questions to generate
 * @returns {Promise<Array>} Combined questions
 */
export async function enhanceQuizWithAI(existingQuestions, additionalCount = 3) {
  try {
    const systemPrompt = `Ты — эксперт по созданию образовательных квизов.
Проанализируй существующие вопросы и создай дополнительные вопросы, которые:
1. Не дублируют существующие
2. Углубляют понимание темы
3. Проверяют применение знаний на практике`

    const userPrompt = `Существующие вопросы:
${JSON.stringify(existingQuestions.map(q => ({ question: q.question, type: q.type })), null, 2)}

Создай ${additionalCount} НОВЫХ вопроса, которые дополняют эти темы, но не повторяют их.
Верни JSON array в том же формате, что и существующие вопросы.`

    const response = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        application: 'QuizGeneration',
        temperature: 0.8
      })
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const aiResponse = data.response

    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Не удалось извлечь JSON из ответа AI')
    }

    const newQuestions = JSON.parse(jsonMatch[0])

    // Combine existing and new questions
    return [...existingQuestions, ...newQuestions]
  } catch (error) {
    console.error('Error enhancing quiz:', error)
    throw error
  }
}

export default {
  generateQuizQuestions,
  generateScenarioQuestion,
  enhanceQuizWithAI
}
