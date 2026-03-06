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
import { lesson13Data } from '@/data/tutorial/lesson13Data'

const router = useRouter()
const currentStep = ref(1)
const lessonData = lesson13Data

const stepLabels = computed(() => {
  return lessonData.steps.map((step) => step.title)
})

const renderStepContent = (step) => {
  const content = step.content
  let html = ''

  // Step 1: Introduction
  if (step.id === 1) {
    html += `<div class="quote-box story"><i class="pi pi-eye quote-icon"></i><p class="story-text">${content.story}</p></div>`

    if (content.whyMonitoring) {
      html += `<h3 class="section-title">${content.whyMonitoring.title}</h3>`
      content.whyMonitoring.reasons.forEach(reason => {
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

    if (content.monitoringLevels) {
      html += `<h3 class="section-title">${content.monitoringLevels.title}</h3>`
      content.monitoringLevels.levels.forEach(level => {
        html += `
          <div class="level-card">
            <h4>${level.level}</h4>
            <p>${level.description}</p>
            <div class="metrics-box">
              <strong>Метрики:</strong> ${level.metrics.join(', ')}
            </div>
            <div class="tools-box">
              <strong>Инструменты:</strong> ${level.tools.join(', ')}
            </div>
          </div>`
      })
    }

    if (content.maintenanceTypes) {
      html += `<h3 class="section-title">${content.maintenanceTypes.title}</h3>`
      content.maintenanceTypes.types.forEach(type => {
        html += `
          <div class="maintenance-card">
            <h4>${type.type}</h4>
            <p>${type.description}</p>
            <div class="examples-box">
              <strong>Примеры:</strong>
              <ul>${type.examples.map(ex => `<li>${ex}</li>`).join('')}</ul>
            </div>
          </div>`
      })
    }
  }

  // Step 2: Key Monitoring Metrics (Lecture)
  if (step.id === 2) {
    html += `<p class="intro-text">${content.intro}</p>`

    if (content.technicalMetrics) {
      html += `<h3 class="section-title">${content.technicalMetrics.title}</h3>`
      content.technicalMetrics.categories.forEach(category => {
        html += `<h4 class="category-title">${category.category}</h4>`
        category.metrics.forEach(metric => {
          html += `
            <div class="metric-card">
              <h5 class="metric-name">${metric.metric}</h5>
              <p class="metric-description">${metric.description}</p>
              <div class="metric-details">
                <div class="detail-row"><strong>Целевое значение:</strong> ${metric.target}</div>
                <div class="detail-row"><strong>Измерение:</strong> ${metric.measurement}</div>
                <div class="detail-row"><strong>Важность:</strong> ${metric.importance}</div>
                <div class="detail-row alert"><strong>Порог алерта:</strong> ${metric.alertThreshold}</div>
              </div>
            </div>`
        })
      })
    }

    if (content.aiQualityMetrics) {
      html += `<h3 class="section-title">${content.aiQualityMetrics.title}</h3>`
      content.aiQualityMetrics.categories.forEach(category => {
        html += `<h4 class="category-title">${category.category}</h4>`
        category.metrics.forEach(metric => {
          html += `
            <div class="metric-card ai-metric">
              <h5 class="metric-name">${metric.metric}</h5>
              <p class="metric-description">${metric.description}</p>
              <div class="metric-details">
                <div class="detail-row"><strong>Целевое значение:</strong> ${metric.target}</div>
                <div class="detail-row"><strong>Применение:</strong> ${metric.useCase}</div>
                <div class="detail-row"><strong>Измерение:</strong> ${metric.measurement}</div>
                <div class="detail-row"><strong>Мониторинг:</strong> ${metric.monitoring}</div>
              </div>
            </div>`
        })
      })
    }

    if (content.businessMetrics) {
      html += `<h3 class="section-title">${content.businessMetrics.title}</h3>`
      content.businessMetrics.metrics.forEach(metric => {
        html += `
          <div class="metric-card business-metric">
            <h5 class="metric-name">${metric.metric}</h5>
            <p class="metric-description">${metric.description}</p>
            <div class="metric-details">
              <div class="detail-row"><strong>Целевое значение:</strong> ${metric.target}</div>
              <div class="detail-row"><strong>Измерение:</strong> ${metric.measurement}</div>
              <div class="detail-row"><strong>Важность:</strong> ${metric.importance}</div>
              <div class="detail-row"><strong>Инструменты:</strong> ${metric.tools}</div>
            </div>
          </div>`
      })
    }

    if (content.dashboardExample) {
      html += `<h3 class="section-title">${content.dashboardExample.title}</h3>`
      content.dashboardExample.sections.forEach(section => {
        html += `
          <div class="dashboard-section">
            <h4>${section.section}</h4>
            <ul class="widget-list">
              ${section.widgets.map(w => `<li>${w}</li>`).join('')}
            </ul>
            <p class="purpose"><strong>Назначение:</strong> ${section.purpose}</p>
          </div>`
      })
    }

    if (content.alertingBestPractices) {
      html += `<h3 class="section-title">${content.alertingBestPractices.title}</h3>`
      content.alertingBestPractices.principles.forEach(principle => {
        html += `
          <div class="principle-card">
            <h4>${principle.principle}</h4>
            <p>${principle.description}</p>
            <div class="example-box good">✅ <strong>Хороший пример:</strong> ${principle.goodExample}</div>
            <div class="example-box bad">❌ <strong>Плохой пример:</strong> ${principle.badExample}</div>
          </div>`
      })
    }
  }

  // Step 3: Dashboard Design (Practice)
  if (step.id === 3) {
    if (content.task) {
      html += `
        <div class="task-box">
          <h3>${content.task.title}</h3>
          <p class="task-description">${content.task.description}</p>
          <div class="context-box">
            <h4>Контекст:</h4>
            <ul>
              <li><strong>Система:</strong> ${content.task.context.system}</li>
              <li><strong>Пользователи:</strong> ${content.task.context.users}</li>
              <li><strong>Функции:</strong> ${content.task.context.features.join(', ')}</li>
            </ul>
          </div>
        </div>`
    }

    if (content.requirements) {
      html += `<h3 class="section-title">${content.requirements.title}</h3>`
      content.requirements.mustHave.forEach(req => {
        html += `<div class="requirement-item must-have">✅ ${req}</div>`
      })
      html += `<h4 class="subsection-title">Желательно:</h4>`
      content.requirements.niceToHave.forEach(req => {
        html += `<div class="requirement-item nice-to-have">💡 ${req}</div>`
      })
    }

    if (content.template) {
      html += `<h3 class="section-title">${content.template.title}</h3>`
      html += `<div class="template-box"><pre>${JSON.stringify(content.template.structure, null, 2)}</pre></div>`
    }

    if (content.visualizationGuide) {
      html += `<h3 class="section-title">${content.visualizationGuide.title}</h3>`
      content.visualizationGuide.types.forEach(type => {
        html += `
          <div class="viz-card">
            <h4>${type.type}</h4>
            <p><strong>Применение:</strong> ${type.useCase}</p>
            <p><strong>Примеры:</strong> ${type.examples.join(', ')}</p>
            <div class="pros-cons">
              <div class="pros">➕ ${type.pros}</div>
              <div class="cons">➖ ${type.cons}</div>
            </div>
          </div>`
      })
    }

    if (content.deliverables) {
      html += `<h3 class="section-title">${content.deliverables.title}</h3>`
      html += `<ul class="deliverables-list">`
      content.deliverables.items.forEach(item => {
        html += `<li>${item}</li>`
      })
      html += `</ul>`
    }
  }

  // Step 4: Monitoring Tools (Lecture)
  if (step.id === 4) {
    html += `<p class="intro-text">${content.intro}</p>`

    if (content.monitoringTools) {
      html += `<h3 class="section-title">${content.monitoringTools.title}</h3>`
      content.monitoringTools.tools.forEach(tool => {
        html += `
          <div class="tool-card">
            <h4>${tool.tool}</h4>
            <div class="tool-badge">${tool.type}</div>
            <p>${tool.description}</p>
            <div class="pros-section">
              <h5>Преимущества:</h5>
              <ul>${tool.pros.map(p => `<li>✅ ${p}</li>`).join('')}</ul>
            </div>
            <div class="cons-section">
              <h5>Недостатки:</h5>
              <ul>${tool.cons.map(c => `<li>⚠️ ${c}</li>`).join('')}</ul>
            </div>
            <div class="use-case-box">
              <strong>Для библиотек:</strong> ${tool.libraryUseCase}
            </div>
            <div class="setup-box">
              <strong>Настройка:</strong> ${tool.setup}
            </div>
            <div class="pricing-box">
              <strong>Стоимость:</strong> ${tool.pricing}
            </div>
          </div>`
      })
    }

    if (content.loggingTools) {
      html += `<h3 class="section-title">${content.loggingTools.title}</h3>`
      content.loggingTools.tools.forEach(tool => {
        html += `
          <div class="tool-card logging-tool">
            <h4>${tool.tool}</h4>
            <p>${tool.description}</p>
            ${tool.components ? `<div class="components"><strong>Компоненты:</strong><ul>${tool.components.map(c => `<li>${c}</li>`).join('')}</ul></div>` : ''}
            <div class="pros-section">
              <h5>Преимущества:</h5>
              <ul>${tool.pros.map(p => `<li>✅ ${p}</li>`).join('')}</ul>
            </div>
            <div class="cons-section">
              <h5>Недостатки:</h5>
              <ul>${tool.cons.map(c => `<li>⚠️ ${c}</li>`).join('')}</ul>
            </div>
            <div class="use-case-box">
              <strong>Для библиотек:</strong> ${tool.libraryUseCase}
            </div>
            <div class="pricing-box">
              <strong>Стоимость:</strong> ${tool.pricing}
            </div>
          </div>`
      })
    }

    if (content.aiMonitoringTools) {
      html += `<h3 class="section-title">${content.aiMonitoringTools.title}</h3>`
      content.aiMonitoringTools.tools.forEach(tool => {
        html += `
          <div class="tool-card ai-tool">
            <h4>${tool.tool}</h4>
            <p>${tool.description}</p>
            <div class="features-section">
              <h5>Возможности:</h5>
              <ul>${tool.features.map(f => `<li>🎯 ${f}</li>`).join('')}</ul>
            </div>
            <div class="use-case-box">
              <strong>Для библиотек:</strong> ${tool.libraryUseCase}
            </div>
            <div class="setup-box">
              <strong>Настройка:</strong> ${tool.setup}
            </div>
            <div class="pricing-box">
              <strong>Стоимость:</strong> ${tool.pricing}
            </div>
          </div>`
      })
    }

    if (content.recommendedStack) {
      html += `<h3 class="section-title">${content.recommendedStack.title}</h3>`
      content.recommendedStack.stacks.forEach(stack => {
        html += `
          <div class="stack-card">
            <h4>${stack.size}</h4>
            <div class="budget-badge">Бюджет: ${stack.budget}</div>
            <div class="stack-details">
              <h5>Рекомендуемый стек:</h5>
              <ul>${stack.stack.map(s => `<li>${s}</li>`).join('')}</ul>
            </div>
            <div class="info-row"><strong>Установка:</strong> ${stack.setup}</div>
            <div class="pros-row">✅ ${stack.pros}</div>
            <div class="cons-row">⚠️ ${stack.cons}</div>
          </div>`
      })
    }

    if (content.loggingBestPractices) {
      html += `<h3 class="section-title">${content.loggingBestPractices.title}</h3>`
      content.loggingBestPractices.practices.forEach(practice => {
        html += `
          <div class="practice-card">
            <h4>${practice.practice}</h4>
            <p>${practice.description}</p>
            ${practice.example ? `
              <div class="example-comparison">
                <div class="bad-example">❌ ${practice.example.bad}</div>
                <div class="good-example">✅ ${practice.example.good}</div>
              </div>
              <p class="benefit">💡 ${practice.benefit}</p>
            ` : ''}
            ${practice.levels ? `
              <ul class="levels-list">
                ${practice.levels.map(l => `<li>${l}</li>`).join('')}
              </ul>
            ` : ''}
            ${practice.include ? `
              <div class="include-list">
                <strong>Включать в логи:</strong>
                <ul>${practice.include.map(i => `<li>${i}</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${practice.neverLog ? `
              <div class="never-log-list">
                <strong>Никогда не логировать:</strong>
                <ul>${practice.neverLog.map(n => `<li>⛔ ${n}</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${practice.rules ? `
              <ul class="rules-list">
                ${practice.rules.map(r => `<li>${r}</li>`).join('')}
              </ul>
            ` : ''}
          </div>`
      })
    }
  }

  // Step 5: Logging Strategy (Practice)
  if (step.id === 5) {
    if (content.task) {
      html += `
        <div class="task-box">
          <h3>${content.task.title}</h3>
          <p class="task-description">${content.task.description}</p>
          <div class="context-box">
            <h4>Контекст:</h4>
            <ul>
              <li><strong>Система:</strong> ${content.task.context.system}</li>
              <li><strong>Компоненты:</strong> ${content.task.context.components.join(', ')}</li>
              <li><strong>Масштаб:</strong> ${content.task.context.scale}</li>
            </ul>
          </div>
        </div>`
    }

    if (content.requirements) {
      html += `<h3 class="section-title">${content.requirements.title}</h3>`
      content.requirements.items.forEach(req => {
        html += `
          <div class="requirement-section">
            <h4>${req.requirement}</h4>
            <p>${req.description}</p>
            ${req.questions ? `
              <ul class="questions-list">
                ${req.questions.map(q => `<li>❓ ${q}</li>`).join('')}
              </ul>
            ` : ''}
            ${req.examples ? `
              <ul class="examples-list">
                ${req.examples.map(e => `<li>📝 ${e}</li>`).join('')}
              </ul>
            ` : ''}
            ${req.fields ? `
              <ul class="fields-list">
                ${req.fields.map(f => `<li><code>${f}</code></li>`).join('')}
              </ul>
            ` : ''}
            ${req.aspects ? `
              <ul class="aspects-list">
                ${req.aspects.map(a => `<li>${a}</li>`).join('')}
              </ul>
            ` : ''}
          </div>`
      })
    }

    if (content.examples) {
      html += `<h3 class="section-title">${content.examples.title}</h3>`
      content.examples.categories.forEach(category => {
        html += `
          <div class="events-category">
            <h4>${category.category}</h4>
            <ul class="events-list">
              ${category.events.map(e => `<li>${e}</li>`).join('')}
            </ul>
          </div>`
      })
    }

    if (content.logFormatExample) {
      html += `<h3 class="section-title">${content.logFormatExample.title}</h3>`
      html += `<div class="code-box"><pre>${JSON.stringify(content.logFormatExample.example, null, 2)}</pre></div>`
      html += `<div class="benefits-box">`
      html += `<h5>Преимущества:</h5><ul>`
      content.logFormatExample.benefits.forEach(b => {
        html += `<li>✅ ${b}</li>`
      })
      html += `</ul></div>`
    }

    if (content.deliverables) {
      html += `<h3 class="section-title">${content.deliverables.title}</h3>`
      html += `<ul class="deliverables-list">`
      content.deliverables.items.forEach(item => {
        html += `<li>${item}</li>`
      })
      html += `</ul>`
    }

    if (content.tips) {
      html += `<h3 class="section-title">${content.tips.title}</h3>`
      html += `<ul class="tips-list">`
      content.tips.tipsList.forEach(tip => {
        html += `<li>💡 ${tip}</li>`
      })
      html += `</ul>`
    }
  }

  // Step 6: Maintenance Strategies (Lecture)
  if (step.id === 6) {
    html += `<p class="intro-text">${content.intro}</p>`

    if (content.maintenanceCycle) {
      html += `<h3 class="section-title">${content.maintenanceCycle.title}</h3>`
      content.maintenanceCycle.phases.forEach(phase => {
        html += `
          <div class="phase-card">
            <h4>${phase.phase}</h4>
            <p>${phase.description}</p>
            <div class="activities-section">
              <strong>Активности:</strong>
              <ul>${phase.activities.map(a => `<li>${a}</li>`).join('')}</ul>
            </div>
            <div class="frequency-box">
              <strong>Частота:</strong> ${phase.frequency}
            </div>
            <div class="deliverable-box">
              <strong>Результат:</strong> ${phase.deliverable}
            </div>
          </div>`
      })
    }

    if (content.retrainingStrategy) {
      html += `<h3 class="section-title">${content.retrainingStrategy.title}</h3>`
      content.retrainingStrategy.approaches.forEach(approach => {
        html += `
          <div class="strategy-card">
            <h4>${approach.approach}</h4>
            <p>${approach.description}</p>
            <div class="when-box"><strong>Когда использовать:</strong> ${approach.when}</div>
            ${approach.schedule ? `
              <div class="schedule-section">
                <strong>Расписание:</strong>
                <ul>${approach.schedule.map(s => `<li>${s}</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${approach.triggers ? `
              <div class="triggers-section">
                <strong>Триггеры:</strong>
                <ul>${approach.triggers.map(t => `<li>🎯 ${t}</li>`).join('')}</ul>
              </div>
            ` : ''}
            <div class="pros-cons">
              <div class="pros">✅ ${approach.pros}</div>
              <div class="cons">⚠️ ${approach.cons}</div>
            </div>
            <div class="example-box">
              <strong>Пример для библиотеки:</strong> ${approach.libraryExample}
            </div>
          </div>`
      })
    }

    if (content.versioningStrategy) {
      html += `<h3 class="section-title">${content.versioningStrategy.title}</h3>`
      html += `<p class="importance">${content.versioningStrategy.importance}</p>`
      content.versioningStrategy.whatToVersion.forEach(artifact => {
        html += `
          <div class="artifact-card">
            <h4>${artifact.artifact}</h4>
            <p>${artifact.description}</p>
            <div class="tooling-box"><strong>Инструменты:</strong> ${artifact.tooling}</div>
            <div class="naming-box"><strong>Именование:</strong> ${artifact.naming}</div>
            <div class="metadata-section">
              <strong>Метаданные:</strong>
              <ul>${artifact.metadata.map(m => `<li>${m}</li>`).join('')}</ul>
            </div>
          </div>`
      })

      if (content.versioningStrategy.rollbackPlan) {
        const rollback = content.versioningStrategy.rollbackPlan
        html += `
          <div class="rollback-plan">
            <h4>${rollback.title}</h4>
            <ol class="steps-list">
              ${rollback.steps.map(s => `<li>${s}</li>`).join('')}
            </ol>
            <p class="automation-note">💡 ${rollback.automation}</p>
          </div>`
      }
    }

    if (content.technicalDebtManagement) {
      html += `<h3 class="section-title">${content.technicalDebtManagement.title}</h3>`
      html += `<p class="definition"><strong>Определение:</strong> ${content.technicalDebtManagement.definition}</p>`

      html += `<h4>Источники технического долга:</h4>`
      html += `<ul>${content.technicalDebtManagement.sources.map(s => `<li>${s}</li>`).join('')}</ul>`

      html += `<h4>Последствия:</h4>`
      html += `<ul class="consequences">${content.technicalDebtManagement.consequences.map(c => `<li>⚠️ ${c}</li>`).join('')}</ul>`

      html += `<h4>Стратегии управления:</h4>`
      content.technicalDebtManagement.strategies.forEach(strategy => {
        html += `
          <div class="strategy-item">
            <h5>${strategy.strategy}</h5>
            <p>${strategy.description}</p>
            <div class="practice-box">
              <strong>Практика:</strong> ${strategy.practice}
            </div>
          </div>`
      })
    }

    if (content.documentationMaintenance) {
      html += `<h3 class="section-title">${content.documentationMaintenance.title}</h3>`
      content.documentationMaintenance.types.forEach(type => {
        html += `
          <div class="doc-type-card">
            <h4>${type.type}</h4>
            <p><strong>Содержание:</strong> ${type.what}</p>
            <p><strong>Аудитория:</strong> ${type.audience}</p>
            <p><strong>Обновление:</strong> ${type.update}</p>
            <p><strong>Где хранить:</strong> ${type.location}</p>
          </div>`
      })

      html += `<h4>Принципы документирования:</h4>`
      html += `<ul class="principles-list">`
      content.documentationMaintenance.principles.forEach(p => {
        html += `<li>📝 ${p}</li>`
      })
      html += `</ul>`
    }

    if (content.incidentManagement) {
      html += `<h3 class="section-title">${content.incidentManagement.title}</h3>`
      html += `<p class="definition"><strong>Определение:</strong> ${content.incidentManagement.definition}</p>`

      html += `<h4>Уровни серьёзности (Severity):</h4>`
      content.incidentManagement.severity.forEach(sev => {
        // Remove parentheses from class names to avoid CSS syntax warnings
        const levelClass = sev.level.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')
        html += `
          <div class="severity-card ${levelClass}">
            <h5>${sev.level}</h5>
            <p>${sev.description}</p>
            <div class="example"><strong>Пример:</strong> ${sev.example}</div>
            <div class="response-time"><strong>Время реакции:</strong> ${sev.responseTime}</div>
            <div class="escalation"><strong>Эскалация:</strong> ${sev.escalation}</div>
          </div>`
      })

      if (content.incidentManagement.responseProcess) {
        const process = content.incidentManagement.responseProcess
        html += `<h4>${process.title}</h4>`
        process.steps.forEach(step => {
          html += `
            <div class="process-step">
              <h5>${step.step}</h5>
              <ul>${step.actions.map(a => `<li>${a}</li>`).join('')}</ul>
            </div>`
        })
      }
    }
  }

  // Step 7: Maintenance Plan (Practice)
  if (step.id === 7) {
    if (content.task) {
      html += `
        <div class="task-box">
          <h3>${content.task.title}</h3>
          <p class="task-description">${content.task.description}</p>
          <div class="context-box">
            <h4>Контекст:</h4>
            <ul>
              <li><strong>Система:</strong> ${content.task.context.system}</li>
              <li><strong>Команда:</strong> ${content.task.context.team}</li>
              <li><strong>Бюджет:</strong> ${content.task.context.budget}</li>
            </ul>
            <h5>Известные проблемы:</h5>
            <ul>${content.task.context.knownIssues.map(i => `<li>⚠️ ${i}</li>`).join('')}</ul>
          </div>
        </div>`
    }

    if (content.requirements) {
      html += `<h3 class="section-title">${content.requirements.title}</h3>`
      content.requirements.sections.forEach(section => {
        html += `
          <div class="requirement-section">
            <h4>${section.section}</h4>
            <p>${section.description}</p>
            <ul class="examples-list">
              ${section.examples.map(e => `<li>${e}</li>`).join('')}
            </ul>
          </div>`
      })
    }

    if (content.exampleTasks) {
      html += `<h3 class="section-title">${content.exampleTasks.title}</h3>`
      Object.entries(content.exampleTasks).forEach(([category, tasks]) => {
        if (category !== 'title') {
          html += `
            <div class="tasks-category">
              <h4>${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
              <ul>${tasks.map(t => `<li>✅ ${t}</li>`).join('')}</ul>
            </div>`
        }
      })
    }

    if (content.timeAllocation) {
      html += `<h3 class="section-title">${content.timeAllocation.title}</h3>`
      content.timeAllocation.breakdown.forEach(item => {
        html += `
          <div class="allocation-card">
            <div class="percentage-badge">${item.percentage}</div>
            <h4>${item.category}</h4>
            <p>${item.activities}</p>
          </div>`
      })
      html += `<p class="note">💡 ${content.timeAllocation.note}</p>`
    }

    if (content.deliverables) {
      html += `<h3 class="section-title">${content.deliverables.title}</h3>`
      html += `<ul class="deliverables-list">`
      content.deliverables.items.forEach(item => {
        html += `<li>${item}</li>`
      })
      html += `</ul>`
    }

    if (content.tips) {
      html += `<h3 class="section-title">${content.tips.title}</h3>`
      html += `<ul class="tips-list">`
      content.tips.tipsList.forEach(tip => {
        html += `<li>💡 ${tip}</li>`
      })
      html += `</ul>`
    }
  }

  // Step 8: Summary and Best Practices
  if (step.id === 8) {
    if (content.summary) {
      html += `<h3 class="section-title">${content.summary.title}</h3>`
      html += `<ul class="topics-list">`
      content.summary.topics.forEach(topic => {
        html += `<li>${topic}</li>`
      })
      html += `</ul>`
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

    if (content.bestPracticesChecklist) {
      html += `<h3 class="section-title">${content.bestPracticesChecklist.title}</h3>`
      Object.entries(content.bestPracticesChecklist).forEach(([key, section]) => {
        if (key !== 'title' && section.practices) {
          html += `
            <div class="checklist-section">
              <h4>${section.title}</h4>
              <ul class="checklist">
                ${section.practices.map(p => `<li>${p}</li>`).join('')}
              </ul>
            </div>`
        }
      })
    }

    if (content.commonPitfalls) {
      html += `<h3 class="section-title">${content.commonPitfalls.title}</h3>`
      content.commonPitfalls.pitfalls.forEach(pitfall => {
        html += `
          <div class="pitfall-card">
            <h4>❌ ${pitfall.pitfall}</h4>
            <p class="consequence"><strong>Последствие:</strong> ${pitfall.consequence}</p>
            <p class="solution">✅ <strong>Решение:</strong> ${pitfall.solution}</p>
          </div>`
      })
    }

    if (content.actionPlan) {
      html += `<h3 class="section-title">${content.actionPlan.title}</h3>`

      if (content.actionPlan.immediate) {
        html += `<h4>${content.actionPlan.immediate.title}</h4>`
        html += `<ul class="action-list immediate">`
        content.actionPlan.immediate.actions.forEach(a => {
          html += `<li>${a}</li>`
        })
        html += `</ul>`
      }

      if (content.actionPlan.shortTerm) {
        html += `<h4>${content.actionPlan.shortTerm.title}</h4>`
        html += `<ul class="action-list short-term">`
        content.actionPlan.shortTerm.actions.forEach(a => {
          html += `<li>${a}</li>`
        })
        html += `</ul>`
      }

      if (content.actionPlan.longTerm) {
        html += `<h4>${content.actionPlan.longTerm.title}</h4>`
        html += `<ul class="action-list long-term">`
        content.actionPlan.longTerm.actions.forEach(a => {
          html += `<li>${a}</li>`
        })
        html += `</ul>`
      }
    }

    if (content.resources) {
      html += `<h3 class="section-title">${content.resources.title}</h3>`
      content.resources.categories.forEach(category => {
        html += `<h4>${category.category}</h4>`
        category.items.forEach(item => {
          html += `
            <div class="resource-item">
              <h5>${item.title}${item.author ? ` - ${item.author}` : ''}</h5>
              <p>${item.description}</p>
              ${item.link ? `<a href="${item.link}" target="_blank" class="resource-link">Перейти →</a>` : ''}
            </div>`
        })
      })
    }

    if (content.quote) {
      html += `
        <div class="final-quote">
          <i class="pi pi-star quote-icon"></i>
          <p class="quote-text">"${content.quote.text}"</p>
          <p class="quote-author">— ${content.quote.author}</p>
        </div>`
    }

    if (content.finalMessage) {
      html += `
        <div class="final-message">
          <h3>${content.finalMessage.title}</h3>
          <p>${content.finalMessage.message}</p>
          <p class="encouragement">${content.finalMessage.encouragement}</p>
          <p class="next-steps">${content.finalMessage.nextSteps}</p>
        </div>`
    }
  }

  return html
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
  router.push('/agents/tutorial')
}
</script>

<style scoped>
/* Container Styles */
.lesson-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.step-content {
  margin-top: 2rem;
}

.step-section {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
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
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 3px solid #10b981;
}

.step-icon {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  color: white;
  box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
}

.step-header h2 {
  font-size: 2rem;
  color: #047857;
  margin: 0;
}

.content-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  padding: 2rem;
}

/* Common Content Styles */
:deep(.quote-box) {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  border-left: 5px solid #10b981;
  padding: 1.5rem;
  margin: 1.5rem 0;
  border-radius: 8px;
}

:deep(.quote-icon) {
  font-size: 2rem;
  color: #059669;
  margin-bottom: 1rem;
}

:deep(.story-text) {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #064e3b;
}

:deep(.section-title) {
  font-size: 1.6rem;
  color: #047857;
  margin: 2rem 0 1rem;
  border-bottom: 2px solid #d1fae5;
  padding-bottom: 0.5rem;
}

:deep(.subsection-title) {
  font-size: 1.3rem;
  color: #059669;
  margin: 1.5rem 0 1rem;
}

:deep(.category-title) {
  font-size: 1.4rem;
  color: #065f46;
  margin: 1.5rem 0 1rem;
  padding-left: 1rem;
  border-left: 4px solid #10b981;
}

/* Card Styles */
:deep(.reason-card),
:deep(.scenario-card),
:deep(.level-card),
:deep(.maintenance-card),
:deep(.metric-card),
:deep(.principle-card),
:deep(.tool-card),
:deep(.phase-card),
:deep(.strategy-card),
:deep(.artifact-card),
:deep(.takeaway-card),
:deep(.pitfall-card) {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1rem 0;
  transition: all 0.3s ease;
}

:deep(.reason-card:hover),
:deep(.scenario-card:hover),
:deep(.level-card:hover),
:deep(.maintenance-card:hover),
:deep(.metric-card:hover),
:deep(.principle-card:hover),
:deep(.tool-card:hover),
:deep(.phase-card:hover),
:deep(.strategy-card:hover),
:deep(.artifact-card:hover),
:deep(.takeaway-card:hover),
:deep(.pitfall-card:hover) {
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
  transform: translateY(-2px);
}

:deep(.reason-card) {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

:deep(.reason-icon) {
  font-size: 2rem;
  min-width: 50px;
  text-align: center;
}

:deep(.reason-content h4) {
  color: #047857;
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
}

:deep(.scenario-card) {
  border-left: 4px solid #10b981;
}

:deep(.scenario-header) {
  font-weight: bold;
  font-size: 1.1rem;
  color: #047857;
  margin-bottom: 0.75rem;
}

:deep(.scenario-problem) {
  background: #fee2e2;
  padding: 0.75rem;
  border-radius: 6px;
  margin: 0.5rem 0;
  color: #991b1b;
}

:deep(.scenario-solution) {
  background: #d1fae5;
  padding: 0.75rem;
  border-radius: 6px;
  margin: 0.5rem 0;
  color: #065f46;
}

/* Metric Cards */
:deep(.metric-card) {
  border-left: 4px solid #10b981;
}

:deep(.metric-card.ai-metric) {
  border-left-color: #3b82f6;
  background: #eff6ff;
  border-color: #bfdbfe;
}

:deep(.metric-card.business-metric) {
  border-left-color: #f59e0b;
  background: #fffbeb;
  border-color: #fde68a;
}

:deep(.metric-name) {
  color: #047857;
  font-size: 1.2rem;
  margin: 0 0 0.5rem;
}

:deep(.metric-description) {
  color: #065f46;
  margin-bottom: 1rem;
}

:deep(.metric-details) {
  background: white;
  padding: 1rem;
  border-radius: 6px;
}

:deep(.detail-row) {
  padding: 0.5rem 0;
  border-bottom: 1px solid #d1fae5;
}

:deep(.detail-row:last-child) {
  border-bottom: none;
}

:deep(.detail-row.alert) {
  color: #dc2626;
  font-weight: 500;
}

/* Tool Cards */
:deep(.tool-card) {
  border-left: 4px solid #10b981;
}

:deep(.tool-card.logging-tool) {
  border-left-color: #8b5cf6;
  background: #faf5ff;
  border-color: #e9d5ff;
}

:deep(.tool-card.ai-tool) {
  border-left-color: #3b82f6;
  background: #eff6ff;
  border-color: #bfdbfe;
}

:deep(.tool-badge) {
  display: inline-block;
  background: #10b981;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  margin: 0.5rem 0;
}

:deep(.pros-section),
:deep(.cons-section),
:deep(.features-section) {
  margin: 1rem 0;
}

:deep(.pros-section h5),
:deep(.cons-section h5),
:deep(.features-section h5) {
  color: #047857;
  margin-bottom: 0.5rem;
}

:deep(.use-case-box),
:deep(.setup-box),
:deep(.pricing-box),
:deep(.tooling-box),
:deep(.naming-box),
:deep(.frequency-box),
:deep(.deliverable-box),
:deep(.when-box) {
  background: white;
  padding: 0.75rem;
  border-radius: 6px;
  margin: 0.5rem 0;
}

/* Example Boxes */
:deep(.example-box),
:deep(.metrics-box),
:deep(.tools-box),
:deep(.examples-box),
:deep(.context-box),
:deep(.template-box),
:deep(.code-box) {
  background: white;
  border: 1px solid #d1fae5;
  padding: 1rem;
  border-radius: 6px;
  margin: 1rem 0;
}

:deep(.example-box.good) {
  border-color: #10b981;
  background: #d1fae5;
}

:deep(.example-box.bad) {
  border-color: #ef4444;
  background: #fee2e2;
}

:deep(.code-box pre),
:deep(.template-box pre) {
  background: #1e293b;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Dashboard and Visualization */
:deep(.dashboard-section),
:deep(.viz-card),
:deep(.stack-card) {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1rem 0;
}

:deep(.widget-list),
:deep(.levels-list),
:deep(.rules-list),
:deep(.include-list ul),
:deep(.never-log-list ul) {
  list-style-type: none;
  padding-left: 0;
}

:deep(.widget-list li),
:deep(.levels-list li),
:deep(.rules-list li) {
  padding: 0.5rem 0 0.5rem 1.5rem;
  position: relative;
}

:deep(.widget-list li::before),
:deep(.levels-list li::before),
:deep(.rules-list li::before) {
  content: "▶";
  position: absolute;
  left: 0;
  color: #10b981;
}

:deep(.purpose),
:deep(.note),
:deep(.automation-note) {
  background: #fef3c7;
  padding: 0.75rem;
  border-radius: 6px;
  margin-top: 1rem;
  border-left: 3px solid #f59e0b;
}

/* Pros and Cons */
:deep(.pros-cons) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 1rem 0;
}

:deep(.pros),
:deep(.pros-row) {
  background: #d1fae5;
  padding: 0.75rem;
  border-radius: 6px;
  border-left: 3px solid #10b981;
}

:deep(.cons),
:deep(.cons-row) {
  background: #fed7aa;
  padding: 0.75rem;
  border-radius: 6px;
  border-left: 3px solid #f59e0b;
}

/* Task and Requirements */
:deep(.task-box) {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border: 2px solid #3b82f6;
  border-radius: 12px;
  padding: 2rem;
  margin: 2rem 0;
}

:deep(.task-box h3) {
  color: #1e40af;
  margin-top: 0;
}

:deep(.task-description) {
  font-size: 1.1rem;
  color: #1e3a8a;
  margin: 1rem 0;
}

:deep(.requirement-item) {
  padding: 1rem;
  margin: 0.5rem 0;
  border-radius: 6px;
}

:deep(.requirement-item.must-have) {
  background: #d1fae5;
  border-left: 4px solid #10b981;
}

:deep(.requirement-item.nice-to-have) {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
}

/* Deliverables and Tips */
:deep(.deliverables-list),
:deep(.tips-list),
:deep(.topics-list),
:deep(.action-list),
:deep(.checklist) {
  list-style-type: none;
  padding-left: 0;
}

:deep(.deliverables-list li),
:deep(.tips-list li),
:deep(.topics-list li),
:deep(.action-list li),
:deep(.checklist li) {
  background: white;
  padding: 1rem;
  margin: 0.5rem 0;
  border-radius: 6px;
  border-left: 4px solid #10b981;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

:deep(.action-list.immediate li) {
  border-left-color: #dc2626;
  background: #fef2f2;
}

:deep(.action-list.short-term li) {
  border-left-color: #f59e0b;
  background: #fffbeb;
}

:deep(.action-list.long-term li) {
  border-left-color: #3b82f6;
  background: #eff6ff;
}

/* Severity Cards */
:deep(.severity-card) {
  padding: 1.5rem;
  margin: 1rem 0;
  border-radius: 8px;
  border-left: 5px solid;
}

:deep(.severity-card.p1-critical) {
  background: #fee2e2;
  border-left-color: #dc2626;
}

:deep(.severity-card.p2-high) {
  background: #fed7aa;
  border-left-color: #f59e0b;
}

:deep(.severity-card.p3-medium) {
  background: #fef3c7;
  border-left-color: #eab308;
}

:deep(.severity-card.p4-low) {
  background: #dbeafe;
  border-left-color: #3b82f6;
}

/* Process Steps */
:deep(.process-step) {
  background: #f0fdf4;
  border-left: 4px solid #10b981;
  padding: 1rem;
  margin: 1rem 0;
  border-radius: 6px;
}

:deep(.process-step h5) {
  color: #047857;
  margin: 0 0 0.5rem;
}

/* Allocation Cards */
:deep(.allocation-card) {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  border: 2px solid #d1fae5;
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1rem 0;
}

:deep(.percentage-badge) {
  background: #10b981;
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  padding: 1rem;
  border-radius: 50%;
  min-width: 80px;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Budget and Info Badges */
:deep(.budget-badge) {
  display: inline-block;
  background: #3b82f6;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  margin: 0.5rem 0;
}

/* Final Elements */
:deep(.final-quote) {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  border: 2px solid #10b981;
  border-radius: 12px;
  padding: 2rem;
  margin: 2rem 0;
  text-align: center;
}

:deep(.final-quote .quote-icon) {
  font-size: 3rem;
  color: #059669;
  margin-bottom: 1rem;
}

:deep(.final-quote .quote-text) {
  font-size: 1.3rem;
  font-style: italic;
  color: #064e3b;
  margin: 1rem 0;
  line-height: 1.6;
}

:deep(.final-quote .quote-author) {
  color: #047857;
  font-weight: 600;
  margin-top: 1rem;
}

:deep(.final-message) {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 2px solid #f59e0b;
  border-radius: 12px;
  padding: 2rem;
  margin: 2rem 0;
  text-align: center;
}

:deep(.final-message h3) {
  color: #92400e;
  font-size: 2rem;
  margin-top: 0;
}

:deep(.final-message p) {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #78350f;
  margin: 1rem 0;
}

:deep(.encouragement) {
  font-weight: 600;
  color: #92400e;
}

:deep(.next-steps) {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #f59e0b;
}

/* Resource Items */
:deep(.resource-item) {
  background: white;
  border: 1px solid #d1fae5;
  border-radius: 8px;
  padding: 1rem;
  margin: 0.75rem 0;
}

:deep(.resource-item h5) {
  color: #047857;
  margin: 0 0 0.5rem;
}

:deep(.resource-link) {
  display: inline-block;
  background: #10b981;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  text-decoration: none;
  margin-top: 0.5rem;
  transition: background 0.3s ease;
}

:deep(.resource-link:hover) {
  background: #059669;
}

/* Navigation Buttons */
.navigation-buttons {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #d1fae5;
}

.spacer {
  flex-grow: 1;
}

/* Responsive Design */
@media (max-width: 768px) {
  .lesson-container {
    padding: 1rem;
  }

  .step-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .step-header h2 {
    font-size: 1.5rem;
  }

  .content-card {
    padding: 1.5rem;
  }

  :deep(.pros-cons) {
    grid-template-columns: 1fr;
  }

  :deep(.allocation-card) {
    flex-direction: column;
    text-align: center;
  }

  .navigation-buttons {
    flex-direction: column;
  }

  .spacer {
    display: none;
  }
}
</style>
