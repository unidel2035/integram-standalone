<template>
  <div class="lesson-container">
    <!-- Progress Bar -->
    <ProgressBar
      :title="lessonData.title"
      :subtitle="lessonData.subtitle"
      :current-step="currentStep"
      :total-steps="lessonData.totalSteps"
      :step-labels="stepLabels"
      @step-click="goToStep"
    />

    <!-- Step Content -->
    <div class="step-content">
      <div v-for="step in lessonData.steps" :key="step.id">
        <div v-if="currentStep === step.id" class="step-section">
          <div class="step-header">
            <div class="step-icon">
              <i :class="step.icon"></i>
            </div>
            <h2>{{ step.title }}</h2>
          </div>

          <Card class="content-card">
            <template #content>
              <div v-html="renderStepContent(step)"></div>
            </template>
          </Card>
        </div>
      </div>
    </div>

    <!-- Navigation Buttons -->
    <div class="navigation-buttons">
      <Button
        v-if="currentStep > 1"
        label="Назад"
        icon="pi pi-arrow-left"
        @click="previousStep"
        outlined
        size="large"
      />
      <div class="spacer"></div>
      <Button
        v-if="currentStep < lessonData.totalSteps"
        label="Далее"
        icon="pi pi-arrow-right"
        iconPos="right"
        @click="nextStep"
        size="large"
      />
      <Button
        v-else
        label="Завершить урок"
        icon="pi pi-check"
        iconPos="right"
        @click="completeLesson"
        severity="success"
        size="large"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

import ProgressBar from './ProgressBar.vue'
import { lesson10Data } from '@/data/tutorial/lesson10Data'
import { logger } from '@/utils/logger'

const router = useRouter()
const currentStep = ref(1)
const lessonData = lesson10Data

const stepLabels = computed(() => {
  if (!lessonData || !Array.isArray(lessonData.steps)) {
    return []
  }
  return lessonData.steps.map(step => step?.title || 'Без названия')
})

const renderStepContent = step => {
  try {
    if (!step || !step.content) {
      return '<p>Содержимое шага недоступно</p>'
    }

    const content = step.content
    let html = ''

    // Step 1: Introduction
    if (step.id === 1) {
      html += `<div class="quote-box story"><i class="pi pi-book quote-icon"></i><p class="story-text">${content.story}</p></div>`

      if (content.whatIsNlp) {
        html += `<h3 class="section-title">${content.whatIsNlp.title || ''}</h3>`
        html += `<p class="intro-text">${content.whatIsNlp.definition || ''}</p>`
        html += `<ul class="benefits-list">`
        if (Array.isArray(content.whatIsNlp.capabilities)) {
          content.whatIsNlp.capabilities.forEach(cap => {
            html += `<li>${cap}</li>`
          })
        }
        html += `</ul>`
      }

      if (content.realWorldExamples) {
        html += `<h3 class="section-title">${content.realWorldExamples.title || ''}</h3>`
        if (Array.isArray(content.realWorldExamples.examples)) {
          content.realWorldExamples.examples.forEach(ex => {
            html += `
          <div class="nlp-example-card">
            <div class="query">🔍 <strong>Запрос:</strong> "${ex.query}"</div>
            <div class="comparison">
              <div class="traditional">
                <h5>Традиционный подход:</h5>
                <p>${ex.traditional}</p>
              </div>
              <div class="nlp-approach">
                <h5>NLP понимает:</h5>
                <p>${ex.nlp}</p>
              </div>
            </div>
            <div class="result">✅ <strong>Результат:</strong> ${ex.result}</div>
          </div>`
          })
        }
      }

      if (content.benefits) {
        html += `<h3 class="section-title">${content.benefits.title || ''}</h3>`
        html += `<ul class="benefits-list">`
        if (Array.isArray(content.benefits.points)) {
          content.benefits.points.forEach(point => {
            html += `<li>${point}</li>`
          })
        }
        html += `</ul>`
      }
    }

    // Step 2: Processing stages
    if (step.id === 2) {
      html += `<p class="intro-text">${content.intro}</p>`
      html += `<div class="example-query-box">📝 <strong>Пример запроса:</strong> "${content.exampleQuery}"</div>`

      content.steps.forEach(s => {
        html += `
        <div class="processing-step">
          <div class="step-number">${s.step}</div>
          <div class="step-content">
            <h4>${s.name}</h4>
            <p class="description">${s.description}</p>
            <div class="transformation">
              <div class="input-output">
                <span class="label">Вход:</span>
                <code>${escapeHtml(s.input)}</code>
              </div>
              <div class="arrow">→</div>
              <div class="input-output">
                <span class="label">Выход:</span>
                <code>${escapeHtml(s.output)}</code>
              </div>
            </div>
            <p class="explanation"><i class="pi pi-info-circle"></i> ${s.explanation}</p>
          </div>
        </div>`
      })

      if (content.practicalExample) {
        html += `
        <div class="practical-example">
          <h3 class="section-title">${content.practicalExample.title}</h3>
          <div class="user-query">💬 <strong>Запрос читателя:</strong> "${content.practicalExample.userQuery}"</div>`

        content.practicalExample.processing.forEach(p => {
          html += `
          <div class="processing-result">
            <span class="stage-name">${p.stage}:</span>
            <code>${escapeHtml(p.result)}</code>
          </div>`
        })
        html += `</div>`
      }
    }

    // Step 3: Smart search case
    if (step.id === 3) {
      html += `<p class="intro-text">${content.explanation}</p>`

      if (content.problemStatement) {
        html += `<h3 class="section-title">${content.problemStatement.title}</h3>`
        html += `<ul class="issue-list">`
        content.problemStatement.issues.forEach(issue => {
          html += `<li>❌ ${issue}</li>`
        })
        html += `</ul>`
      }

      if (content.nlpSolution) {
        html += `<h3 class="section-title">${content.nlpSolution.title}</h3>`
        content.nlpSolution.features.forEach(feature => {
          html += `
          <div class="feature-card">
            <h4>${feature.name}</h4>
            <p>${feature.description}</p>
            <div class="example-box">
              <strong>Пример:</strong> ${feature.example}
            </div>
          </div>`
        })
      }

      if (content.implementation) {
        html += `<h3 class="section-title">${content.implementation.title}</h3>`

        const opt1 = content.implementation.option1
        html += `
        <div class="implementation-option">
          <h4>${opt1.name}</h4>
          <div class="meta">
            <span class="difficulty">Сложность: ${opt1.difficulty}</span>
            <span class="time">Время: ${opt1.time}</span>
          </div>
          <p><strong>Требования:</strong></p>
          <ul>${opt1.requirements.map(r => `<li>${r}</li>`).join('')}</ul>`

        opt1.steps.forEach(s => {
          html += `
          <div class="impl-step">
            <h5>${s.step}. ${s.title}</h5>
            <p>${s.description}</p>
            ${s.code ? `<pre class="code-block"><code>${escapeHtml(s.code)}</code></pre>` : ''}
          </div>`
        })

        html += `
          <div class="pros-cons-simple">
            <div class="pros">${opt1.pros}</div>
            <div class="cons">${opt1.cons}</div>
          </div>
        </div>`

        if (content.implementation.option2) {
          const opt2 = content.implementation.option2
          html += `
          <div class="implementation-option advanced">
            <h4>${opt2.name}</h4>
            <div class="meta">
              <span class="difficulty">Сложность: ${opt2.difficulty}</span>
              <span class="time">Время: ${opt2.time}</span>
            </div>
            <p><strong>Требования:</strong></p>
            <ul>${opt2.requirements.map(r => `<li>${r}</li>`).join('')}</ul>
            <p><strong>Преимущества:</strong></p>
            <ul>${opt2.benefits.map(b => `<li>${b}</li>`).join('')}</ul>
            <pre class="architecture-diagram">${opt2.architecture}</pre>
          </div>`
        }
      }

      if (content.expectedResults) {
        html += `
        <div class="results-section">
          <h3 class="section-title">${content.expectedResults.title}</h3>
          <table class="metrics-table">
            <thead>
              <tr>
                <th>Метрика</th>
                <th>Было</th>
                <th>Стало</th>
                <th>Улучшение</th>
              </tr>
            </thead>
            <tbody>`

        content.expectedResults.metrics.forEach(m => {
          html += `
              <tr>
                <td>${m.metric}</td>
                <td>${m.before}</td>
                <td class="improved">${m.after}</td>
                <td class="improvement">${m.improvement}</td>
              </tr>`
        })

        html += `
            </tbody>
          </table>
        </div>`
      }

      if (content.caseStudy) {
        const cs = content.caseStudy
        html += `
        <div class="case-study success">
          <i class="pi pi-trophy"></i>
          <div class="case-content">
            <h4>Кейс: ${cs.library}</h4>
            <p><strong>Каталог:</strong> ${cs.catalogSize}</p>
            <p><strong>Решение:</strong> ${cs.implementation}</p>
            <ul class="results">
              <li>📊 ${cs.results.searchAccuracy}</li>
              <li>👥 ${cs.results.userSatisfaction}</li>
              <li>📈 ${cs.results.bookIssues}</li>
            </ul>
            <p class="quote">"${cs.results.quote}"</p>
          </div>
        </div>`
      }
    }

    // Step 4: Classification
    if (step.id === 4) {
      html += `<p class="intro-text">${content.explanation}</p>`

      if (content.useCases) {
        html += `<h3 class="section-title">${content.useCases.title}</h3>`
        content.useCases.scenarios.forEach(scenario => {
          html += `
          <div class="use-case-card">
            <h4>📌 ${scenario.scenario}</h4>
            <p><strong>Задача:</strong> ${scenario.task}</p>
            <div class="comparison-grid">
              <div class="manual">
                <h5>Вручную:</h5>
                <p>${scenario.manual}</p>
              </div>
              <div class="with-nlp">
                <h5>С NLP:</h5>
                <p>${scenario.nlp}</p>
              </div>
            </div>
            <div class="savings">
              ⚡ <strong>Экономия:</strong> ${scenario.timeSaved || scenario.quality}
            </div>
          </div>`
        })
      }

      if (content.implementation) {
        html += `<h3 class="section-title">${content.implementation.title}</h3>`
        ;['step1', 'step2', 'step3'].forEach(stepKey => {
          const s = content.implementation[stepKey]
          html += `
          <div class="impl-step-card">
            <h4>${s.title}</h4>
            <p>${s.description}</p>
            ${s.code ? `<pre class="code-block"><code>${escapeHtml(s.code)}</code></pre>` : ''}
          </div>`
        })
      }

      if (content.advancedFeatures) {
        html += `<h3 class="section-title">${content.advancedFeatures.title}</h3>`
        content.advancedFeatures.features.forEach(feature => {
          html += `
          <div class="feature-highlight">
            <h4>✨ ${feature.name}</h4>
            <p>${feature.description}</p>
            <div class="example-box"><em>Пример:</em> ${feature.example}</div>
          </div>`
        })
      }

      if (content.metrics) {
        html += `
        <div class="metrics-section">
          <h3 class="section-title">${content.metrics.title}</h3>
          <table class="metrics-table">
            <thead>
              <tr>
                <th>Метрика</th>
                <th>Показатели</th>
                <th>Примечания</th>
              </tr>
            </thead>
            <tbody>`

        content.metrics.kpis.forEach(kpi => {
          html += `
              <tr>
                <td>${kpi.metric}</td>
                <td>${kpi.before ? `${kpi.before} → ${kpi.after}` : kpi.value || `${kpi.nlp} vs ${kpi.human}`}</td>
                <td>${kpi.improvement || kpi.note || kpi.formula}</td>
              </tr>`
        })

        html += `
            </tbody>
          </table>
        </div>`
      }
    }

    // Step 5: Recommendations
    if (step.id === 5) {
      html += `<p class="intro-text">${content.explanation}</p>`

      if (content.traditionalVsNlp) {
        html += `<h3 class="section-title">${content.traditionalVsNlp.title}</h3>`

        const trad = content.traditionalVsNlp.traditional
        const nlp = content.traditionalVsNlp.nlp

        html += `
        <div class="comparison-cards">
          <div class="approach-card traditional">
            <h4>❌ ${trad.name}</h4>
            <p><strong>Как работает:</strong> ${trad.howItWorks}</p>
            <div class="pros-cons-section">
              <div class="pros-list">
                <h5>Плюсы:</h5>
                <ul>${trad.pros.map(p => `<li>${p}</li>`).join('')}</ul>
              </div>
              <div class="cons-list">
                <h5>Минусы:</h5>
                <ul>${trad.cons.map(c => `<li>${c}</li>`).join('')}</ul>
              </div>
            </div>
            <div class="example-box"><em>Пример:</em> ${trad.example}</div>
          </div>
          <div class="approach-card nlp-card">
            <h4>✅ ${nlp.name}</h4>
            <p><strong>Как работает:</strong> ${nlp.howItWorks}</p>
            <div class="pros-list">
              <h5>Преимущества:</h5>
              <ul>${nlp.pros.map(p => `<li>${p}</li>`).join('')}</ul>
            </div>
            <div class="example-box"><em>Пример:</em> ${nlp.example}</div>
          </div>
        </div>`
      }

      if (content.howItWorks) {
        html += `<h3 class="section-title">${content.howItWorks.title}</h3>`
        content.howItWorks.steps.forEach(s => {
          html += `
          <div class="workflow-step">
            <div class="step-num">Шаг ${s.step}</div>
            <div class="step-details">
              <h4>${s.name}</h4>
              <p>${s.description}</p>
              ${s.example ? `<div class="example-box"><strong>Пример:</strong> ${s.example}</div>` : ''}
              ${s.nlpAnalysis ? `<div class="analysis-box">🔍 ${s.nlpAnalysis}</div>` : ''}
              ${s.technical ? `<div class="technical-note">⚙️ ${s.technical}</div>` : ''}
              ${s.method ? `<div class="method-note">📐 ${s.method}</div>` : ''}
              ${s.filters ? `<div class="filters-note"><strong>Фильтры:</strong><ul>${s.filters.map(f => `<li>${f}</li>`).join('')}</ul></div>` : ''}
            </div>
          </div>`
        })
      }

      if (content.implementation) {
        html += `
        <div class="implementation-section">
          <h3 class="section-title">${content.implementation.title}</h3>
          <pre class="code-block"><code>${escapeHtml(content.implementation.code)}</code></pre>
        </div>`
      }

      if (content.advancedTechniques) {
        html += `<h3 class="section-title">${content.advancedTechniques.title}</h3>`
        content.advancedTechniques.techniques.forEach(tech => {
          html += `
          <div class="technique-card">
            <h4>🎯 ${tech.name}</h4>
            <p>${tech.description}</p>
            ${tech.formula ? `<div class="formula-box"><code>${tech.formula}</code></div>` : ''}
            ${tech.example ? `<div class="example-box"><em>Пример:</em> ${tech.example}</div>` : ''}
            ${tech.workflow ? `<div class="workflow-box">${tech.workflow}</div>` : ''}
            <div class="benefit-box">💡 ${tech.benefit}</div>
          </div>`
        })
      }

      if (content.caseStudy) {
        const cs = content.caseStudy
        html += `
        <div class="case-study success">
          <i class="pi pi-trophy"></i>
          <div class="case-content">
            <h4>Кейс: ${cs.library}</h4>
            <p><strong>Внедрение:</strong> ${cs.implementation}</p>
            <div class="before-after-grid">
              <div class="before-section">
                <h5>Было:</h5>
                <ul>
                  <li>${cs.before.method}</li>
                  <li>CTR: ${cs.before.ctr}</li>
                  <li>Конверсия: ${cs.before.conversion}</li>
                  <li>Оценка: ${cs.before.satisfaction}</li>
                </ul>
              </div>
              <div class="after-section">
                <h5>Стало:</h5>
                <ul>
                  <li>${cs.after.method}</li>
                  <li>CTR: ${cs.after.ctr}</li>
                  <li>Конверсия: ${cs.after.conversion}</li>
                  <li>Оценка: ${cs.after.satisfaction}</li>
                </ul>
              </div>
            </div>
            <p class="quote">"${cs.quote}"</p>
          </div>
        </div>`
      }
    }

    // Step 6: Summary
    if (step.id === 6) {
      if (content.summary) {
        html += `<h3 class="section-title">${content.summary.title}</h3>`
        html += `<ul class="benefits-list">`
        content.summary.topics.forEach(topic => {
          html += `<li>${topic}</li>`
        })
        html += `</ul>`
      }

      if (content.keyTakeaways) {
        html += `<h3 class="section-title">${content.keyTakeaways.title}</h3>`
        content.keyTakeaways.points.forEach(point => {
          html += `
          <div class="takeaway-item">
            <span class="emoji">${point.emoji}</span>
            <div class="text">${point.text}</div>
            <span class="impact badge-${point.impact.toLowerCase()}">${point.impact}</span>
          </div>`
        })
      }

      if (content.implementationRoadmap) {
        html += `<h3 class="section-title">${content.implementationRoadmap.title}</h3>`
        ;['week1_2', 'week3_4', 'week5_6', 'week7_8'].forEach(weekKey => {
          const week = content.implementationRoadmap[weekKey]
          html += `
          <div class="roadmap-week">
            <h4>${week.title}</h4>
            <ul>${week.tasks.map(t => `<li>${t}</li>`).join('')}</ul>
          </div>`
        })
      }

      if (content.budgetEstimate) {
        html += `<h3 class="section-title">${content.budgetEstimate.title}</h3>`
        content.budgetEstimate.scenarios.forEach(scenario => {
          html += `
          <div class="budget-card">
            <h4>${scenario.scale}</h4>
            <p>${scenario.description}</p>
            <div class="cost-info">
              <div class="monthly-cost">💰 ${scenario.cost}</div>
              ${scenario.oneTime ? `<div class="one-time-cost">🔧 Разово: ${scenario.oneTime}</div>` : ''}
              ${scenario.time ? `<div class="time-cost">⏱️ ${scenario.time}</div>` : ''}
            </div>
            <p class="suitable">✔️ ${scenario.suitable}</p>
            ${scenario.roi ? `<p class="roi">📈 ${scenario.roi}</p>` : ''}
          </div>`
        })
      }

      if (content.resources) {
        html += `<h3 class="section-title">${content.resources.title}</h3>`
        html += `<h4>Инструменты:</h4><ul class="resource-list">`
        content.resources.tools.forEach(tool => {
          html += `<li><strong>${tool.name}</strong> - ${tool.description} ${tool.url ? `(<a href="${tool.url}" target="_blank">ссылка</a>)` : ''}</li>`
        })
        html += `</ul><h4>Обучение:</h4><ul class="resource-list">`
        content.resources.learning.forEach(item => {
          html += `<li><strong>${item.name}</strong> - ${item.description} ${item.url ? `(<a href="${item.url}" target="_blank">ссылка</a>)` : ''}</li>`
        })
        html += `</ul>`
      }

      if (content.practiceExercise) {
        html += `
        <div class="practice-exercise">
          <h3 class="section-title">${content.practiceExercise.title}</h3>
          <p><strong>${content.practiceExercise.task}</strong></p>
          <ol class="steps-list">
            ${content.practiceExercise.steps.map(step => `<li>${step}</li>`).join('')}
          </ol>
          <p><strong>Время:</strong> ${content.practiceExercise.expectedTime}</p>
          <p><strong>Результат:</strong> ${content.practiceExercise.outcome}</p>
        </div>`
      }

      if (content.finalWords) {
        html += `
        <div class="final-words">
          <p class="motivation">${content.finalWords.motivation}</p>
          <div class="cta-box">
            <h4>${content.finalWords.cta.title}</h4>
            <p><strong>${content.finalWords.cta.action}</strong></p>
            <p class="promise">${content.finalWords.cta.promise}</p>
          </div>
          <div class="quote-box final-quote">
            <i class="pi pi-quote-right"></i>
            <p class="quote-text">"${content.finalWords.quote.text}"</p>
            <p class="quote-author">— ${content.finalWords.quote.author}</p>
          </div>
        </div>`
      }
    }

    return html
  } catch (error) {
    console.error('Error rendering step content:', error)
    logger.error('Lesson10Container renderStepContent error', {
      stepId: step?.id,
      error: error.message,
      stack: error.stack,
    })
    return '<p class="error-message">Ошибка при отображении содержимого шага. Попробуйте обновить страницу.</p>'
  }
}

const escapeHtml = text => {
  if (text === null || text === undefined) {
    return ''
  }
  const textStr = String(text)
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return textStr.replace(/[&<>"']/g, m => map[m])
}

const nextStep = () => {
  if (currentStep.value < lessonData.totalSteps) {
    currentStep.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const goToStep = step => {
  currentStep.value = step
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const completeLesson = () => {
  localStorage.setItem('tutorial_lesson10_completed', 'true')
  router.push('/agents/tutorial/lesson-1')
}
</script>

<style scoped>
.lesson-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.step-content {
  margin-bottom: 2rem;
}

.step-section {
  animation: fadeInUp 0.5s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-header {
  text-align: center;
  margin-bottom: 2rem;
}

.step-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.3);
}

.step-icon i {
  font-size: 2.5rem;
  color: white;
}

.step-header h2 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.content-card {
  margin-bottom: 2rem;
}

/* Common Content Styles */
:deep(.quote-box) {
  padding: 1.5rem;
  background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
  border-radius: 12px;
  border-left: 4px solid #8b5cf6;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

:deep(.quote-icon) {
  font-size: 1.5rem;
  color: #8b5cf6;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

:deep(.story-text) {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #581c87;
  margin: 0;
  font-style: italic;
}

:deep(.section-title) {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 2rem 0 1rem 0;
}

:deep(.intro-text) {
  font-size: 1.05rem;
  line-height: 1.7;
  color: #4b5563;
  margin-bottom: 1.5rem;
}

:deep(.benefits-list) {
  list-style: none;
  padding-left: 0;
}

:deep(.benefits-list li) {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: #f5f3ff;
  border-radius: 8px;
  font-size: 1rem;
}

:deep(.nlp-example-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 2px solid #e5e7eb;
}

:deep(.nlp-example-card .query) {
  font-size: 1.1rem;
  margin-bottom: 1rem;
  color: #1f2937;
}

:deep(.comparison) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 1rem 0;
}

:deep(.traditional),
:deep(.nlp-approach) {
  padding: 1rem;
  border-radius: 8px;
}

:deep(.traditional) {
  background: #fef2f2;
  border-left: 3px solid #ef4444;
}

:deep(.nlp-approach) {
  background: #f0fdf4;
  border-left: 3px solid #10b981;
}

:deep(.result) {
  margin-top: 1rem;
  padding: 1rem;
  background: #dbeafe;
  border-radius: 8px;
  font-weight: 500;
}

:deep(.example-query-box) {
  padding: 1rem;
  background: #fef3c7;
  border-radius: 8px;
  margin: 1.5rem 0;
  font-size: 1.1rem;
  border-left: 4px solid #f59e0b;
}

:deep(.processing-step) {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 12px;
}

:deep(.step-number) {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

:deep(.transformation) {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1rem 0;
  padding: 1rem;
  background: white;
  border-radius: 8px;
}

:deep(.input-output) {
  flex: 1;
}

:deep(.input-output .label) {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #6b7280;
  font-size: 0.875rem;
}

:deep(.input-output code) {
  display: block;
  padding: 0.5rem;
  background: #1f2937;
  color: #f9fafb;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

:deep(.arrow) {
  font-size: 1.5rem;
  color: #8b5cf6;
  font-weight: bold;
}

:deep(.explanation) {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #eff6ff;
  border-radius: 6px;
  color: #1e40af;
}

:deep(.code-block) {
  background: #1f2937;
  color: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
}

:deep(.case-study) {
  margin: 2rem 0;
  padding: 1.5rem;
  border-radius: 12px;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

:deep(.case-study.success) {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 2px solid #10b981;
}

:deep(.case-study i) {
  font-size: 2rem;
  color: #10b981;
  flex-shrink: 0;
}

:deep(.case-content h4) {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.75rem 0;
}

:deep(.quote) {
  font-style: italic;
  margin-top: 0.75rem;
  color: #065f46;
  font-weight: 500;
}

:deep(.metrics-table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
}

:deep(.metrics-table th),
:deep(.metrics-table td) {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

:deep(.metrics-table th) {
  background: #8b5cf6;
  color: white;
  font-weight: 600;
}

:deep(.metrics-table .improved) {
  color: #059669;
  font-weight: 600;
}

:deep(.metrics-table .improvement) {
  color: #8b5cf6;
  font-weight: 600;
}

:deep(.feature-card),
:deep(.use-case-card),
:deep(.impl-step-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 2px solid #e5e7eb;
}

:deep(.example-box) {
  padding: 1rem;
  background: #f5f3ff;
  border-radius: 8px;
  margin-top: 1rem;
  border-left: 3px solid #8b5cf6;
}

:deep(.takeaway-item) {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 2px solid #e5e7eb;
}

:deep(.takeaway-item .emoji) {
  font-size: 2rem;
}

:deep(.impact) {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

:deep(.badge-критично) {
  background: #fee2e2;
  color: #991b1b;
}

:deep(.badge-очень) {
  background: #fed7aa;
  color: #9a3412;
}

:deep(.badge-важно) {
  background: #fef3c7;
  color: #78350f;
}

:deep(.badge-философски) {
  background: #e0e7ff;
  color: #3730a3;
}

:deep(.roadmap-week),
:deep(.budget-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 2px solid #e5e7eb;
}

:deep(.practice-exercise) {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  padding: 2rem;
  border-radius: 12px;
  margin: 2rem 0;
}

:deep(.final-words) {
  margin-top: 2rem;
}

:deep(.cta-box) {
  background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
  padding: 1.5rem;
  border-radius: 12px;
  margin: 1.5rem 0;
}

/* Navigation Buttons */
.navigation-buttons {
  display: flex;
  gap: 1rem;
  padding: 2rem 0;
  border-top: 2px solid #e5e7eb;
}

.spacer {
  flex: 1;
}

:deep(.error-message) {
  padding: 1rem;
  background: #fee2e2;
  border-left: 4px solid #dc2626;
  border-radius: 8px;
  color: #991b1b;
  font-weight: 500;
}

@media (max-width: 768px) {
  .lesson-container {
    padding: 1rem;
  }

  .step-header h2 {
    font-size: 1.5rem;
  }

  .step-icon {
    width: 64px;
    height: 64px;
  }

  .step-icon i {
    font-size: 2rem;
  }

  :deep(.comparison),
  :deep(.comparison-grid) {
    grid-template-columns: 1fr;
  }

  .navigation-buttons {
    flex-direction: column;
  }

  .spacer {
    display: none;
  }
}
</style>
