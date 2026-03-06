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
import { lesson8Data } from '@/data/tutorial/lesson8Data'

const router = useRouter()
const currentStep = ref(1)
const lessonData = lesson8Data

const stepLabels = computed(() => {
  return lessonData.steps.map((step) => step.title)
})

const renderStepContent = (step) => {
  const content = step.content
  let html = ''

  // Step 1: Introduction
  if (step.id === 1) {
    html += `<div class="quote-box story"><i class="pi pi-book quote-icon"></i><p class="story-text">${content.story}</p></div>`
    
    if (content.challenges) {
      html += `<h3 class="section-title">${content.challenges.title}</h3>`
      content.challenges.items.forEach(item => {
        html += `
          <div class="challenge-item">
            <div class="problem">❌ <strong>${item.problem}</strong></div>
            <div class="time">⏱️ Сейчас: ${item.time}</div>
            <div class="solution">✅ С ИИ: ${item.solution}</div>
          </div>`
      })
    }

    if (content.benefits) {
      html += `<h3 class="section-title">${content.benefits.title}</h3><ul class="benefits-list">`
      content.benefits.points.forEach(point => {
        html += `<li>${point}</li>`
      })
      html += `</ul>`
    }

    if (content.realExample) {
      html += `
        <div class="case-study success">
          <i class="pi pi-trophy"></i>
          <div class="case-content">
            <h4>Реальный пример: ${content.realExample.library}</h4>
            <p><strong>Было:</strong> ${content.realExample.before}</p>
            <p><strong>Стало:</strong> ${content.realExample.after}</p>
            <p class="result">✨ ${content.realExample.result}</p>
          </div>
        </div>`
    }
  }

  // Step 2: Architecture
  if (step.id === 2) {
    html += `<p class="intro-text">${content.intro}</p>`
    
    content.architectureTypes.forEach(arch => {
      html += `
        <div class="architecture-card">
          <div class="arch-header">
            <span class="arch-emoji">${arch.emoji}</span>
            <h3>${arch.type}</h3>
            <span class="difficulty badge-${arch.difficulty.toLowerCase()}">${arch.difficulty} сложность</span>
          </div>
          <p class="description">${arch.description}</p>
          <div class="pros-cons">
            <div class="pros">
              <h4>Плюсы:</h4>
              <ul>${arch.pros.map(p => `<li>${p}</li>`).join('')}</ul>
            </div>
            <div class="cons">
              <h4>Минусы:</h4>
              <ul>${arch.cons.map(c => `<li>${c}</li>`).join('')}</ul>
            </div>
          </div>
          <p class="best-for"><strong>Подходит для:</strong> ${arch.bestFor}</p>
          ${arch.warning ? `<div class="warning-box">${arch.warning}</div>` : ''}
        </div>`
    })

    if (content.recommendedStack) {
      html += `<h3 class="section-title">${content.recommendedStack.title}</h3>`
      ;['forSmallLibrary', 'forMediumLibrary', 'forLargeLibrary'].forEach(key => {
        const stack = content.recommendedStack[key]
        html += `
          <div class="stack-card">
            <h4>${stack.title}</h4>
            <ul>${stack.tools.map(t => `<li>${t}</li>`).join('')}</ul>
            <div class="stack-meta">
              <span class="cost">💰 ${stack.cost}</span>
              <span class="complexity">🔧 ${stack.complexity}</span>
            </div>
          </div>`
      })
    }
  }

  // Step 3: Cataloging case
  if (step.id === 3) {
    html += `<p class="intro-text">${content.explanation}</p>`
    
    if (content.scenario) {
      html += `
        <div class="scenario-box">
          <h3>${content.scenario.title}</h3>
          <p>${content.scenario.description}</p>
          <div class="time-comparison">
            <div class="time-before">⏱️ Вручную: ${content.scenario.manualTime}</div>
            <div class="time-after">🚀 С ИИ: ${content.scenario.aiTime}</div>
          </div>
        </div>`
    }

    if (content.technicalSetup) {
      html += `<h3 class="section-title">${content.technicalSetup.title}</h3>`
      html += `<ul class="requirements">`
      content.technicalSetup.requirements.forEach(req => {
        html += `<li>✓ ${req}</li>`
      })
      html += `</ul>`

      content.technicalSetup.steps.forEach(s => {
        html += `
          <div class="setup-step">
            <div class="step-number">${s.step}</div>
            <div class="step-content">
              <h4>${s.title}</h4>
              <p>${s.description}</p>
              ${s.code ? `<pre class="code-block"><code>${escapeHtml(s.code)}</code></pre>` : ''}
              <span class="time-badge">⏱️ ${s.time}</span>
            </div>
          </div>`
      })

      html += `<div class="total-time-box">⏰ ${content.technicalSetup.totalTime}</div>`
    }

    if (content.expectedResults) {
      html += `
        <div class="results-box">
          <h4>Ожидаемые результаты:</h4>
          <ul>
            <li>📊 Точность: ${content.expectedResults.accuracy}</li>
            <li>⚡ Ускорение: ${content.expectedResults.timesSaved}</li>
            <li>🔍 Требует проверки: ${content.expectedResults.needsReview}</li>
            <li>💰 Окупаемость: ${content.expectedResults.roiReturn}</li>
          </ul>
        </div>`
    }
  }

  // Step 4: Search case
  if (step.id === 4) {
    html += `<p class="intro-text">${content.explanation}</p>`
    
    if (content.problem) {
      html += `<h3 class="section-title">${content.problem.title}</h3>`
      content.problem.examples.forEach(ex => {
        html += `
          <div class="search-example problem">
            <div class="query">🔍 <strong>Запрос:</strong> "${ex.userQuery}"</div>
            <div class="search-method">Традиционный поиск: ${ex.traditionalSearch}</div>
            <div class="result">${ex.result}</div>
          </div>`
      })
    }

    if (content.solution) {
      html += `<h3 class="section-title">${content.solution.title}</h3>`
      html += `<p class="intro-text">${content.solution.howItWorks}</p>`
      content.solution.examples.forEach(ex => {
        html += `
          <div class="search-example solution">
            <div class="query">🔍 <strong>Запрос:</strong> "${ex.userQuery}"</div>
            <div class="search-method">ИИ-поиск: ${ex.aiSearch}</div>
            <div class="result">${ex.result}</div>
          </div>`
      })
    }
  }

  // Step 5: Recommendations case
  if (step.id === 5) {
    html += `<p class="intro-text">${content.explanation}</p>`
    
    if (content.businessValue) {
      html += `<h3 class="section-title">${content.businessValue.title}</h3>`
      html += `<ul class="benefits-list">`
      content.businessValue.benefits.forEach(b => {
        html += `<li>${b}</li>`
      })
      html += `</ul>`
    }

    if (content.successStory) {
      html += `
        <div class="case-study success">
          <i class="pi pi-trophy"></i>
          <div class="case-content">
            <h4>История успеха: ${content.successStory.library}</h4>
            <p>Внедрили: ${content.successStory.implemented}</p>
            <ul>
              <li>👥 Подписчиков: ${content.successStory.results.subscribers}</li>
              <li>📧 Open Rate: ${content.successStory.results.openRate}</li>
              <li>🖱️ CTR: ${content.successStory.results.ctr}</li>
              <li>✅ Конверсия: ${content.successStory.results.conversion}</li>
              <li>📈 Рост книговыдач: ${content.successStory.results.bookIssues}</li>
            </ul>
            <p class="quote">"${content.successStory.results.quote}"</p>
          </div>
        </div>`
    }
  }

  // Step 6: Reporting
  if (step.id === 6) {
    html += `<p class="intro-text">${content.explanation}</p>`
    
    if (content.painPoints) {
      html += `<h3 class="section-title">${content.painPoints.title}</h3>`
      content.painPoints.issues.forEach(issue => {
        html += `
          <div class="pain-point">
            <div class="problem">❌ ${issue.problem}</div>
            <div class="time">⏱️ ${issue.time}</div>
            <div class="error">⚠️ ${issue.error}</div>
          </div>`
      })
      html += `<div class="total-pain">💢 ${content.painPoints.total}</div>`
    }

    if (content.caseStudy) {
      html += `
        <div class="case-study success">
          <i class="pi pi-trophy"></i>
          <div class="case-content">
            <h4>${content.caseStudy.library}</h4>
            <p><strong>Задача:</strong> ${content.caseStudy.challenge}</p>
            <div class="before-after">
              <div class="before">
                <h5>Было:</h5>
                <ul>
                  <li>⏱️ ${content.caseStudy.before.time}</li>
                  <li>❌ ${content.caseStudy.before.errors}</li>
                  <li>😰 ${content.caseStudy.before.stress}</li>
                </ul>
              </div>
              <div class="after">
                <h5>Стало:</h5>
                <ul>
                  <li>⚡ ${content.caseStudy.after.time}</li>
                  <li>✅ ${content.caseStudy.after.errors}</li>
                  <li>😊 ${content.caseStudy.after.stress}</li>
                  <li>🎁 ${content.caseStudy.after.bonus}</li>
                </ul>
              </div>
            </div>
            <p class="result">💰 ${content.caseStudy.roi}</p>
          </div>
        </div>`
    }
  }

  // Step 7: Summary
  if (step.id === 7) {
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
      ;['month1', 'month2', 'month3'].forEach(monthKey => {
        const month = content.implementationRoadmap[monthKey]
        html += `
          <div class="roadmap-month">
            <h4>${month.title}</h4>`
        month.weeks.forEach(week => {
          html += `
            <div class="week-block">
              <h5>${week.week}</h5>
              <ul>${week.tasks.map(t => `<li>${t}</li>`).join('')}</ul>
            </div>`
        })
        html += `</div>`
      })
    }

    if (content.finalWords) {
      html += `
        <div class="final-words">
          <h3>${content.finalWords.title}</h3>
          <p class="motivation">${content.finalWords.motivation}</p>
          <div class="cta-box">
            <h4>${content.finalWords.cta.title}</h4>
            <p><strong>${content.finalWords.cta.action}</strong></p>
            <p class="promise">${content.finalWords.cta.promise}</p>
          </div>
          <div class="quote-box">
            <i class="pi pi-quote-right"></i>
            <p class="quote-text">${content.finalWords.quote.text}</p>
            <p class="quote-author">— ${content.finalWords.quote.author}</p>
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
  localStorage.setItem('tutorial_lesson8_completed', 'true')
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

/* Content Styles */
:deep(.quote-box) {
  padding: 1.5rem;
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
  border-radius: 12px;
  border-left: 4px solid #3B82F6;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

:deep(.quote-box.story) {
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  border-left-color: #F59E0B;
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
  color: #78350F;
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

:deep(.challenge-item) {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border-left: 4px solid #EF4444;
}

:deep(.challenge-item .problem) {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

:deep(.challenge-item .solution) {
  color: #059669;
  font-weight: 500;
  margin-top: 0.5rem;
}

:deep(.benefits-list) {
  list-style: none;
  padding-left: 0;
}

:deep(.benefits-list li) {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: #F0FDF4;
  border-radius: 8px;
  font-size: 1rem;
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
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  border: 2px solid #10B981;
}

:deep(.case-study i) {
  font-size: 2rem;
  color: #10B981;
  flex-shrink: 0;
}

:deep(.case-content h4) {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.75rem 0;
}

:deep(.case-content .result) {
  font-weight: 600;
  color: #059669;
  margin-top: 0.75rem;
}

:deep(.architecture-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 2px solid #E5E7EB;
}

:deep(.arch-header) {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

:deep(.arch-emoji) {
  font-size: 2rem;
}

:deep(.difficulty) {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

:deep(.badge-низкая), :deep(.badge-низкая) {
  background: #D1FAE5;
  color: #065F46;
}

:deep(.badge-средняя) {
  background: #FEF3C7;
  color: #78350F;
}

:deep(.badge-высокая) {
  background: #FEE2E2;
  color: #991B1B;
}

:deep(.pros-cons) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 1rem 0;
}

:deep(.pros h4) {
  color: #059669;
}

:deep(.cons h4) {
  color: #DC2626;
}

:deep(.code-block) {
  background: #1f2937;
  color: #F9FAFB;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
}

:deep(.setup-step) {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #F9FAFB;
  border-radius: 8px;
}

:deep(.step-number) {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

:deep(.time-badge) {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #DBEAFE;
  color: #1E40AF;
  border-radius: 12px;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

:deep(.search-example) {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

:deep(.search-example.problem) {
  background: #FEF2F2;
  border-left: 4px solid #EF4444;
}

:deep(.search-example.solution) {
  background: #F0FDF4;
  border-left: 4px solid #10B981;
}

:deep(.takeaway-item) {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  margin-bottom: 1rem;
}

:deep(.takeaway-item .emoji) {
  font-size: 2rem;
}

:deep(.roadmap-month) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 2px solid #E5E7EB;
}

:deep(.week-block) {
  margin: 1rem 0;
  padding: 1rem;
  background: #F9FAFB;
  border-radius: 8px;
}

:deep(.final-words) {
  margin-top: 2rem;
}

:deep(.cta-box) {
  background: linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%);
  padding: 1.5rem;
  border-radius: 12px;
  margin: 1.5rem 0;
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

  .navigation-buttons {
    flex-direction: column;
  }

  .spacer {
    display: none;
  }
}
</style>
