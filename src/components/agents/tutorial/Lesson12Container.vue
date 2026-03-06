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
      <div v-for="(step, index) in lessonData.steps" :key="step.id">
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
import { lesson12Data } from '@/data/tutorial/lesson12Data'

const router = useRouter()
const currentStep = ref(1)
const lessonData = lesson12Data

const stepLabels = computed(() => {
  return lessonData.steps.map((step) => step.title)
})

const renderStepContent = (step) => {
  const content = step.content
  let html = ''

  // Step 1: Introduction
  if (step.id === 1) {
    html += `<div class="quote-box story"><i class="pi pi-shield quote-icon"></i><p class="story-text">${content.story}</p></div>`

    if (content.whyTesting) {
      html += `<h3 class="section-title">${content.whyTesting.title}</h3>`
      content.whyTesting.reasons.forEach(reason => {
        html += `
          <div class="reason-card">
            <div class="reason-icon">${reason.icon}</div>
            <div class="reason-content">
              <h4>${reason.title}</h4>
              <p>${reason.description}</p>
            </div>
          </div>`
      })
    }

    if (content.realWorldScenarios) {
      html += `<h3 class="section-title">${content.realWorldScenarios.title}</h3>`
      content.realWorldScenarios.scenarios.forEach(scenario => {
        html += `
          <div class="scenario-card">
            <div class="scenario-header">📌 ${scenario.situation}</div>
            <div class="scenario-problem">❌ <strong>Проблема:</strong> ${scenario.problem}</div>
            <div class="scenario-solution">✅ <strong>Решение:</strong> ${scenario.solution}</div>
          </div>`
      })
    }

    if (content.testingLevels) {
      html += `<h3 class="section-title">${content.testingLevels.title}</h3>`
      content.testingLevels.levels.forEach(level => {
        html += `
          <div class="level-card">
            <h4>${level.level}</h4>
            <p>${level.description}</p>
            <div class="example-box">
              <strong>Пример:</strong> ${level.example}
            </div>
          </div>`
      })
    }
  }

  // Step 2: Functional Testing Methods (Lecture)
  if (step.id === 2) {
    html += `<p class="intro-text">${content.intro}</p>`

    if (content.methods) {
      content.methods.forEach(method => {
        html += `
          <div class="method-card">
            <h3 class="method-title">${method.method}</h3>
            <p class="method-description">${method.description}</p>
            <div class="example-section">
              <h4>Пример: ${method.example.scenario}</h4>
              <div class="steps-list">
                <strong>Шаги:</strong>
                <ol>${method.example.steps.map(s => `<li>${s}</li>`).join('')}</ol>
              </div>
              <div class="expected-result">
                ✅ <strong>Ожидаемый результат:</strong> ${method.example.expectedResult}
              </div>
            </div>
          </div>`
      })
    }

    if (content.testCases) {
      html += `<h3 class="section-title">${content.testCases.title}</h3>`
      content.testCases.cases.forEach(testCase => {
        html += `
          <div class="test-case-card priority-${testCase.priority.toLowerCase()}">
            <div class="test-case-header">
              <span class="test-id">${testCase.id}</span>
              <span class="priority-badge">${testCase.priority}</span>
            </div>
            <h4>${testCase.module}: ${testCase.testCase}</h4>
            <p><strong>Предусловия:</strong> ${testCase.preconditions}</p>
            <div class="test-steps">
              <strong>Шаги:</strong>
              <ol>${testCase.steps.map(s => `<li>${s}</li>`).join('')}</ol>
            </div>
            <div class="expected-box">
              ✅ <strong>Ожидаемый результат:</strong> ${testCase.expected}
            </div>
          </div>`
      })
    }

    if (content.automationTools) {
      html += `<h3 class="section-title">${content.automationTools.title}</h3>`
      content.automationTools.tools.forEach(tool => {
        html += `
          <div class="tool-card">
            <h4>🛠️ ${tool.name}</h4>
            <p><strong>Назначение:</strong> ${tool.purpose}</p>
            <p><strong>Использование:</strong> ${tool.usage}</p>
            <div class="example-box">
              <strong>Пример для библиотек:</strong> ${tool.libraryExample}
            </div>
          </div>`
      })
    }
  }

  // Step 3: Practical Assignment - Test Cases
  if (step.id === 3) {
    html += `
      <div class="assignment-card">
        <h3 class="assignment-title">${content.task.title}</h3>
        <p class="assignment-description">${content.task.description}</p>
        <div class="requirements-section">
          <h4>Требования:</h4>
          <ul>${content.task.requirements.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>
      </div>`

    if (content.template) {
      html += `
        <div class="template-section">
          <h3 class="section-title">${content.template.title}</h3>
          <pre class="template-code">${JSON.stringify(content.template.structure, null, 2)}</pre>
        </div>`
    }

    if (content.examples) {
      html += `
        <div class="examples-section">
          <h3 class="section-title">${content.examples.title}</h3>
          <ul class="examples-list">
            ${content.examples.testScenarios.map(s => `<li>💡 ${s}</li>`).join('')}
          </ul>
        </div>`
    }

    if (content.deliverables) {
      html += `
        <div class="deliverables-section">
          <h3 class="section-title">${content.deliverables.title}</h3>
          <ul class="deliverables-list">
            ${content.deliverables.items.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>`
    }

    if (content.tips) {
      html += `
        <div class="tips-section">
          <h3 class="section-title">${content.tips.title}</h3>
          <ul class="tips-list">
            ${content.tips.tipsList.map(tip => `<li>💡 ${tip}</li>`).join('')}
          </ul>
        </div>`
    }
  }

  // Step 4: Performance Testing Lecture
  if (step.id === 4) {
    html += `<p class="intro-text">${content.intro}</p>`

    if (content.typesOfPerformanceTesting) {
      html += `<h3 class="section-title">${content.typesOfPerformanceTesting.title}</h3>`
      content.typesOfPerformanceTesting.types.forEach(type => {
        html += `
          <div class="performance-type-card">
            <h4>${type.type}</h4>
            <p>${type.description}</p>
            <div class="example-box">
              <strong>Пример:</strong> ${type.example}
            </div>
            <div class="metrics-box">
              <strong>Метрики:</strong>
              <ul>${type.metrics.map(m => `<li>${m}</li>`).join('')}</ul>
            </div>
            <div class="target-box">
              🎯 <strong>Цель:</strong> ${type.target}
            </div>
          </div>`
      })
    }

    if (content.performanceMetrics) {
      html += `<h3 class="section-title">${content.performanceMetrics.title}</h3>`
      html += `<div class="metrics-grid">`
      content.performanceMetrics.metrics.forEach(metric => {
        html += `
          <div class="metric-card">
            <h4>${metric.metric}</h4>
            <p>${metric.description}</p>
            <div class="metric-levels">
              <div class="level acceptable">Приемлемо: ${metric.acceptable}</div>
              <div class="level good">Хорошо: ${metric.good}</div>
              <div class="level excellent">Отлично: ${metric.excellent}</div>
            </div>
            <p class="measurement">📊 ${metric.measurement}</p>
          </div>`
      })
      html += `</div>`
    }

    if (content.toolsForPerformanceTesting) {
      html += `<h3 class="section-title">${content.toolsForPerformanceTesting.title}</h3>`
      content.toolsForPerformanceTesting.tools.forEach(tool => {
        html += `
          <div class="tool-card">
            <h4>🛠️ ${tool.tool}</h4>
            <p class="tool-type">${tool.type}</p>
            <div class="pros-cons">
              <div class="pros-section">
                <strong>Плюсы:</strong>
                <ul>${tool.pros.map(p => `<li>${p}</li>`).join('')}</ul>
              </div>
              <div class="cons-section">
                <strong>Минусы:</strong>
                <ul>${tool.cons.map(c => `<li>${c}</li>`).join('')}</ul>
              </div>
            </div>
            <div class="use-case-box">
              <strong>Применение:</strong> ${tool.useCase}
            </div>
            <div class="example-box">
              <strong>Пример:</strong> ${tool.example}
            </div>
          </div>`
      })
    }

    if (content.realWorldExample) {
      const ex = content.realWorldExample
      html += `
        <div class="real-world-example">
          <h3 class="section-title">${ex.title}</h3>
          <p><strong>Сценарий:</strong> ${ex.scenario}</p>
          <p><strong>Цель:</strong> ${ex.goal}</p>
          <div class="setup-box">
            <h4>Настройки:</h4>
            <ul>
              <li>Инструмент: ${ex.setup.tool}</li>
              <li>Пользователи: ${ex.setup.users}</li>
              <li>Длительность: ${ex.setup.duration}</li>
              <li>Нарастание: ${ex.setup.rampUp}</li>
            </ul>
          </div>
          <div class="behavior-box">
            <h4>Поведение пользователя:</h4>
            <ol>${ex.userBehavior.map(b => `<li>${b}</li>`).join('')}</ol>
          </div>
          <div class="criteria-box">
            <h4>Критерии успешности:</h4>
            <ul>
              <li>Среднее время отклика: ${ex.acceptanceCriteria.avgResponseTime}</li>
              <li>95-й перцентиль: ${ex.acceptanceCriteria.p95ResponseTime}</li>
              <li>Процент ошибок: ${ex.acceptanceCriteria.errorRate}</li>
              <li>Пропускная способность: ${ex.acceptanceCriteria.throughput}</li>
            </ul>
          </div>
          <div class="result-box success">
            <h4>Результат: ${ex.result.passed ? '✅ Тест пройден' : '❌ Тест провален'}</h4>
            <ul>
              <li>Среднее время отклика: ${ex.result.avgResponseTime}</li>
              <li>95-й перцентиль: ${ex.result.p95ResponseTime}</li>
              <li>Процент ошибок: ${ex.result.errorRate}</li>
              <li>Пропускная способность: ${ex.result.throughput}</li>
            </ul>
            <p><strong>Вывод:</strong> ${ex.result.conclusion}</p>
          </div>
        </div>`
    }

    if (content.optimizationTips) {
      html += `<h3 class="section-title">${content.optimizationTips.title}</h3>`
      content.optimizationTips.tips.forEach(tip => {
        html += `
          <div class="optimization-tip-card">
            <div class="tip-problem">❌ <strong>Проблема:</strong> ${tip.problem}</div>
            <div class="tip-cause">🔍 <strong>Возможная причина:</strong> ${tip.possibleCause}</div>
            <div class="tip-solution">✅ <strong>Решение:</strong> ${tip.solution}</div>
          </div>`
      })
    }
  }

  // Step 5: Practical Assignment - Load Test Plan
  if (step.id === 5) {
    html += `
      <div class="assignment-card">
        <h3 class="assignment-title">${content.task.title}</h3>
        <p class="assignment-description">${content.task.description}</p>
        <div class="context-section">
          <h4>Контекст:</h4>
          <ul>
            <li>Размер библиотеки: ${content.task.context.librarySize}</li>
            <li>Часы пик: ${content.task.context.peakHours}</li>
            <li>Средняя одновременная нагрузка: ${content.task.context.avgConcurrentUsers}</li>
            <li>Пиковая одновременная нагрузка: ${content.task.context.peakConcurrentUsers}</li>
            <li>Функции: ${content.task.context.systemFeatures.join(', ')}</li>
          </ul>
        </div>
      </div>`

    if (content.requirements) {
      html += `<h3 class="section-title">${content.requirements.title}</h3>`
      content.requirements.items.forEach(item => {
        html += `
          <div class="requirement-card">
            <h4>${item.item}</h4>
            <p>${item.description}</p>
            ${item.questions ? `<div class="questions-box">
              <strong>Вопросы для размышления:</strong>
              <ul>${item.questions.map(q => `<li>${q}</li>`).join('')}</ul>
            </div>` : ''}
            ${item.examples ? `<div class="examples-box">
              <strong>Примеры:</strong>
              <ul>${item.examples.map(e => `<li>${e}</li>`).join('')}</ul>
            </div>` : ''}
            ${item.parameters ? `<div class="parameters-box">
              <strong>Параметры:</strong>
              <ul>${item.parameters.map(p => `<li>${p}</li>`).join('')}</ul>
            </div>` : ''}
            ${item.metrics ? `<div class="metrics-box">
              <strong>Метрики:</strong>
              <ul>${item.metrics.map(m => `<li>${m}</li>`).join('')}</ul>
            </div>` : ''}
            ${item.options ? `<div class="options-box">
              <strong>Варианты:</strong> ${item.options.join(', ')}
              <p>${item.justification}</p>
            </div>` : ''}
          </div>`
      })
    }

    if (content.example) {
      const ex = content.example
      html += `
        <div class="plan-example">
          <h3 class="section-title">${ex.title}</h3>
          <div class="example-plan">
            <h4>${ex.testName}</h4>
            <p><strong>Цель:</strong> ${ex.objective}</p>
            <p><strong>Область:</strong> ${ex.scope}</p>
            <div class="scenarios-section">
              <h5>Сценарии:</h5>
              ${ex.scenarios.map(s => `
                <div class="scenario-item">
                  <strong>${s.name}</strong> (${s.frequency})
                  <ul>${s.actions.map(a => `<li>${a}</li>`).join('')}</ul>
                </div>
              `).join('')}
            </div>
            <div class="load-profile-section">
              <h5>Профиль нагрузки:</h5>
              <ul>
                <li>Пользователи: ${ex.loadProfile.users}</li>
                <li>Нарастание: ${ex.loadProfile.rampUp}</li>
                <li>Длительность: ${ex.loadProfile.duration}</li>
                <li>Паузы: ${ex.loadProfile.thinkTime}</li>
              </ul>
            </div>
            <div class="criteria-section">
              <h5>Критерии успешности:</h5>
              <ul>
                <li>${ex.criteria.avgResponseTime}</li>
                <li>${ex.criteria.p95ResponseTime}</li>
                <li>${ex.criteria.errorRate}</li>
                <li>${ex.criteria.throughput}</li>
              </ul>
            </div>
            <p><strong>Инструмент:</strong> ${ex.tool}</p>
            <p><strong>Окружение:</strong> ${ex.environment}</p>
          </div>
        </div>`
    }

    if (content.deliverables) {
      html += `
        <div class="deliverables-section">
          <h3 class="section-title">${content.deliverables.title}</h3>
          <ul class="deliverables-list">
            ${content.deliverables.items.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>`
    }
  }

  // Step 6: Optimization Lecture
  if (step.id === 6) {
    html += `<p class="intro-text">${content.intro}</p>`

    if (content.optimizationAreas) {
      content.optimizationAreas.forEach(area => {
        html += `
          <div class="optimization-area">
            <h3 class="area-title">${area.area}</h3>`
        area.techniques.forEach(tech => {
          html += `
            <div class="technique-card">
              <h4>${tech.technique}</h4>
              <p>${tech.description}</p>
              <div class="example-box">
                <strong>Пример:</strong> ${tech.example}
              </div>
              <div class="improvement-box">
                📈 <strong>Улучшение:</strong> ${tech.improvement}
              </div>
              <div class="implementation-box">
                💻 <strong>Реализация:</strong> <code>${tech.implementation}</code>
              </div>
            </div>`
        })
        html += `</div>`
      })
    }

    if (content.prioritizationMatrix) {
      html += `
        <div class="prioritization-section">
          <h3 class="section-title">${content.prioritizationMatrix.title}</h3>
          <p>${content.prioritizationMatrix.description}</p>`
      content.prioritizationMatrix.matrix.forEach(item => {
        html += `
          <div class="priority-card priority-${item.priority.toLowerCase()}">
            <div class="priority-header">
              <span class="priority-level">${item.priority}</span>
              <span class="priority-details">Влияние: ${item.impact} | Усилия: ${item.effort}</span>
            </div>
            <div class="examples-box">
              <strong>Примеры:</strong>
              <ul>${item.examples.map(e => `<li>${e}</li>`).join('')}</ul>
            </div>
            <div class="action-box">
              💡 <strong>Действие:</strong> ${item.action}
            </div>
          </div>`
      })
      html += `</div>`
    }

    if (content.monitoringTools) {
      html += `<h3 class="section-title">${content.monitoringTools.title}</h3>`
      content.monitoringTools.tools.forEach(tool => {
        html += `
          <div class="tool-card">
            <h4>📊 ${tool.tool}</h4>
            <p><strong>Назначение:</strong> ${tool.purpose}</p>
            <div class="metrics-box">
              <strong>Метрики:</strong> ${tool.metrics.join(', ')}
            </div>
            <div class="use-case-box">
              <strong>Применение:</strong> ${tool.useCase}
            </div>
          </div>`
      })
    }

    if (content.realWorldOptimizationCase) {
      const caseStudy = content.realWorldOptimizationCase
      html += `
        <div class="case-study-section">
          <h3 class="section-title">${caseStudy.title}</h3>
          <p class="problem-statement"><strong>Проблема:</strong> ${caseStudy.problem}</p>
          <div class="analysis-section">
            <h4>Анализ:</h4>
            <ul>
              <li>${caseStudy.analysis.step1}</li>
              <li>${caseStudy.analysis.step2}</li>
              <li>${caseStudy.analysis.step3}</li>
            </ul>
          </div>
          <div class="actions-section">
            <h4>Предпринятые действия:</h4>
            ${caseStudy.actions.map(action => `
              <div class="action-item">
                <strong>${action.action}</strong>
                <p class="result">Результат: ${action.result}</p>
              </div>
            `).join('')}
          </div>
          <div class="result-box success">
            <h4>Итоговый результат:</h4>
            <p><strong>До:</strong> ${caseStudy.result.before}</p>
            <p><strong>После:</strong> ${caseStudy.result.after}</p>
            <p><strong>Улучшение:</strong> ${caseStudy.result.improvement}</p>
            <p><strong>Затраты:</strong> ${caseStudy.result.cost}</p>
          </div>
        </div>`
    }
  }

  // Step 7: Practical Assignment - Optimization Plan
  if (step.id === 7) {
    html += `
      <div class="assignment-card">
        <h3 class="assignment-title">${content.task.title}</h3>
        <p class="assignment-description">${content.task.description}</p>
        <div class="scenario-section">
          <h4>Сценарий:</h4>
          <p>${content.task.scenario.currentState}</p>
          <div class="metrics-box">
            <strong>Текущие метрики:</strong>
            <ul>
              <li>Время отклика: ${content.task.scenario.metrics.responseTime}</li>
              <li>95-й перцентиль: ${content.task.scenario.metrics.p95ResponseTime}</li>
              <li>Одновременные пользователи: ${content.task.scenario.metrics.concurrentUsers}</li>
              <li>Процент ошибок: ${content.task.scenario.metrics.errorRate}</li>
              <li>CPU: ${content.task.scenario.metrics.cpuUsage}</li>
              <li>Запросы к БД: ${content.task.scenario.metrics.dbQueryTime}</li>
            </ul>
          </div>
          <p><strong>Бюджет:</strong> ${content.task.scenario.budget}</p>
          <p><strong>Сроки:</strong> ${content.task.scenario.timeframe}</p>
        </div>
      </div>`

    if (content.requirements) {
      html += `<h3 class="section-title">${content.requirements.title}</h3>`
      content.requirements.steps.forEach(step => {
        html += `
          <div class="requirement-step">
            <h4>Шаг ${step.step}: ${step.description}</h4>
            ${step.questions ? `<div class="questions-box">
              <ul>${step.questions.map(q => `<li>${q}</li>`).join('')}</ul>
            </div>` : ''}
            ${step.hint ? `<div class="hint-box">💡 ${step.hint}</div>` : ''}
            ${step.details ? `<p>${step.details}</p>` : ''}
            ${step.metrics ? `<div class="metrics-box">
              <strong>Метрики:</strong> ${step.metrics.join(', ')}
            </div>` : ''}
          </div>`
      })
    }

    if (content.hints) {
      html += `
        <div class="hints-section">
          <h3 class="section-title">${content.hints.title}</h3>
          <ul class="tips-list">
            ${content.hints.tips.map(tip => `<li>💡 ${tip}</li>`).join('')}
          </ul>
        </div>`
    }

    if (content.deliverables) {
      html += `
        <div class="deliverables-section">
          <h3 class="section-title">${content.deliverables.title}</h3>
          <ul class="deliverables-list">
            ${content.deliverables.items.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>`
    }
  }

  // Step 8: Summary
  if (step.id === 8) {
    if (content.summary) {
      html += `
        <div class="summary-section">
          <h3 class="section-title">${content.summary.title}</h3>
          <ul class="benefits-list">
            ${content.summary.topics.map(topic => `<li>${topic}</li>`).join('')}
          </ul>
        </div>`
    }

    if (content.keyTakeaways) {
      html += `<h3 class="section-title">${content.keyTakeaways.title}</h3>`
      content.keyTakeaways.points.forEach(point => {
        html += `
          <div class="takeaway-card">
            <h4>${point.takeaway}</h4>
            <p>${point.explanation}</p>
          </div>`
      })
    }

    if (content.practicalChecklist) {
      html += `<h3 class="section-title">${content.practicalChecklist.title}</h3>`
      const checklist = content.practicalChecklist

      html += `
        <div class="checklist-section">
          <h4>${checklist.shortTerm.title}</h4>
          <ul class="checklist-list">
            ${checklist.shortTerm.actions.map(action => `<li>${action}</li>`).join('')}
          </ul>
        </div>
        <div class="checklist-section">
          <h4>${checklist.mediumTerm.title}</h4>
          <ul class="checklist-list">
            ${checklist.mediumTerm.actions.map(action => `<li>${action}</li>`).join('')}
          </ul>
        </div>
        <div class="checklist-section">
          <h4>${checklist.longTerm.title}</h4>
          <ul class="checklist-list">
            ${checklist.longTerm.actions.map(action => `<li>${action}</li>`).join('')}
          </ul>
        </div>`
    }

    if (content.recommendedReading) {
      html += `<h3 class="section-title">${content.recommendedReading.title}</h3>`
      content.recommendedReading.resources.forEach(resource => {
        html += `
          <div class="resource-card">
            <span class="resource-type">${resource.type}</span>
            <h4>${resource.title}</h4>
            <p>${resource.description}</p>
            <a href="${resource.link}" target="_blank" class="resource-link">Перейти →</a>
          </div>`
      })
    }

    if (content.nextSteps) {
      html += `
        <div class="next-steps-section">
          <h3 class="section-title">${content.nextSteps.title}</h3>
          ${content.nextSteps.steps.map(step => `
            <div class="next-step-card">
              <h4>${step.step}</h4>
              <p>${step.action}</p>
            </div>
          `).join('')}
        </div>`
    }

    if (content.quote) {
      html += `
        <div class="quote-box final-quote">
          <i class="pi pi-quote-right quote-icon"></i>
          <p class="quote-text">"${content.quote.text}"</p>
          <p class="quote-author">— ${content.quote.author}</p>
        </div>`
    }

    if (content.finalMessage) {
      html += `
        <div class="final-message">
          <h3 class="section-title">${content.finalMessage.title}</h3>
          <p>${content.finalMessage.message}</p>
          <div class="encouragement-box">
            <strong>${content.finalMessage.encouragement}</strong>
          </div>
        </div>`
    }
  }

  return html
}

const escapeHtml = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
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

const goToStep = (step) => {
  currentStep.value = step
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const completeLesson = () => {
  localStorage.setItem('tutorial_lesson12_completed', 'true')
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
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
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
  background: linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%);
  border-radius: 12px;
  border-left: 4px solid #3B82F6;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

:deep(.quote-icon) {
  font-size: 1.5rem;
  color: #3B82F6;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

:deep(.story-text) {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #1E40AF;
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
  color: #4B5563;
  margin-bottom: 1.5rem;
}

:deep(.benefits-list) {
  list-style: none;
  padding-left: 0;
}

:deep(.benefits-list li) {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: #EFF6FF;
  border-radius: 8px;
  font-size: 1rem;
}

:deep(.reason-card) {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  margin-bottom: 1rem;
  border: 2px solid #E5E7EB;
}

:deep(.reason-icon) {
  font-size: 2rem;
  flex-shrink: 0;
}

:deep(.reason-content h4) {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
  font-size: 1.1rem;
}

:deep(.scenario-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  border: 2px solid #E5E7EB;
}

:deep(.scenario-header) {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #1f2937;
}

:deep(.scenario-problem) {
  padding: 0.75rem;
  background: #FEE2E2;
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

:deep(.scenario-solution) {
  padding: 0.75rem;
  background: #D1FAE5;
  border-radius: 8px;
}

:deep(.level-card),
:deep(.method-card),
:deep(.tool-card),
:deep(.technique-card),
:deep(.performance-type-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 2px solid #E5E7EB;
}

:deep(.example-box) {
  padding: 1rem;
  background: #F3F4F6;
  border-radius: 8px;
  margin-top: 1rem;
  border-left: 3px solid #3B82F6;
}

:deep(.test-case-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border-left: 4px solid #3B82F6;
}

:deep(.test-case-card.priority-высокий) {
  border-left-color: #EF4444;
}

:deep(.test-case-card.priority-критический) {
  border-left-color: #DC2626;
  background: #FEF2F2;
}

:deep(.test-case-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

:deep(.test-id) {
  font-weight: 600;
  color: #3B82F6;
}

:deep(.priority-badge) {
  padding: 0.25rem 0.75rem;
  background: #DBEAFE;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

:deep(.expected-box) {
  margin-top: 1rem;
  padding: 1rem;
  background: #D1FAE5;
  border-radius: 8px;
}

:deep(.assignment-card) {
  background: linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%);
  padding: 2rem;
  border-radius: 12px;
  margin-bottom: 2rem;
}

:deep(.assignment-title) {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1E40AF;
  margin: 0 0 1rem 0;
}

:deep(.template-code) {
  background: #1f2937;
  color: #F9FAFB;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
}

:deep(.deliverables-list),
:deep(.tips-list),
:deep(.examples-list),
:deep(.checklist-list) {
  list-style: none;
  padding-left: 0;
}

:deep(.deliverables-list li),
:deep(.tips-list li),
:deep(.examples-list li),
:deep(.checklist-list li) {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: #F3F4F6;
  border-radius: 8px;
}

:deep(.metrics-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}

:deep(.metric-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 2px solid #E5E7EB;
}

:deep(.metric-levels) {
  margin-top: 1rem;
}

:deep(.level) {
  padding: 0.5rem;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

:deep(.level.acceptable) {
  background: #FEF3C7;
}

:deep(.level.good) {
  background: #D1FAE5;
}

:deep(.level.excellent) {
  background: #BFDBFE;
}

:deep(.pros-cons) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 1rem 0;
}

:deep(.pros-section) {
  padding: 1rem;
  background: #D1FAE5;
  border-radius: 8px;
}

:deep(.cons-section) {
  padding: 1rem;
  background: #FEE2E2;
  border-radius: 8px;
}

:deep(.real-world-example),
:deep(.case-study-section) {
  background: #F9FAFB;
  padding: 2rem;
  border-radius: 12px;
  margin: 2rem 0;
}

:deep(.result-box.success) {
  background: #D1FAE5;
  padding: 1.5rem;
  border-radius: 8px;
  margin-top: 1rem;
}

:deep(.optimization-tip-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  border: 2px solid #E5E7EB;
}

:deep(.tip-problem) {
  padding: 0.75rem;
  background: #FEE2E2;
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

:deep(.tip-cause) {
  padding: 0.75rem;
  background: #FEF3C7;
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

:deep(.tip-solution) {
  padding: 0.75rem;
  background: #D1FAE5;
  border-radius: 8px;
}

:deep(.priority-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  border-left: 4px solid #6B7280;
}

:deep(.priority-card.priority-высокий) {
  border-left-color: #10B981;
  background: #ECFDF5;
}

:deep(.priority-card.priority-средний) {
  border-left-color: #F59E0B;
  background: #FFFBEB;
}

:deep(.priority-card.priority-низкий) {
  border-left-color: #EF4444;
  background: #FEF2F2;
}

:deep(.takeaway-card),
:deep(.next-step-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  border: 2px solid #E5E7EB;
}

:deep(.resource-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  border: 2px solid #E5E7EB;
}

:deep(.resource-type) {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #DBEAFE;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

:deep(.resource-link) {
  color: #3B82F6;
  text-decoration: none;
  font-weight: 600;
}

:deep(.resource-link:hover) {
  text-decoration: underline;
}

:deep(.final-quote) {
  background: linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%);
  border-left-color: #8B5CF6;
}

:deep(.quote-text) {
  font-size: 1.2rem;
  font-style: italic;
  margin-bottom: 0.5rem;
}

:deep(.quote-author) {
  text-align: right;
  font-weight: 600;
  color: #6B7280;
}

:deep(.encouragement-box) {
  text-align: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%);
  border-radius: 12px;
  margin-top: 1rem;
  font-size: 1.2rem;
  color: #1E40AF;
}

/* Navigation Buttons */
.navigation-buttons {
  display: flex;
  gap: 1rem;
  padding: 2rem 0;
  border-top: 2px solid #E5E7EB;
}

.spacer {
  flex: 1;
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

  :deep(.pros-cons) {
    grid-template-columns: 1fr;
  }

  :deep(.metrics-grid) {
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
