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
import { ref, computed, onMounted, onBeforeUnmount, onErrorCaptured } from 'vue'
import { useRouter } from 'vue-router'

import ProgressBar from './ProgressBar.vue'
import { lesson11Data } from '@/data/tutorial/lesson11Data'

const router = useRouter()
const currentStep = ref(1)
const lessonData = lesson11Data

// Error handler for component and dynamically rendered content
onErrorCaptured((err, instance, info) => {
  console.error('Error captured in Lesson11Container:', err, info)
  // Return false to prevent error from propagating
  return false
})

// Handle errors from dynamically rendered HTML content (images, links, etc.)
let handleResourceError = null

onMounted(() => {
  // Add global error listener for resources loaded by v-html
  handleResourceError = (event) => {
    // Check if error is from an element within this component
    if (event.target && (event.target.tagName === 'IMG' || event.target.tagName === 'IFRAME' || event.target.tagName === 'LINK')) {
      console.warn('Resource loading error in Lesson11:', event.target.src || event.target.href)
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  }

  window.addEventListener('error', handleResourceError, true)
})

// Cleanup on unmount
onBeforeUnmount(() => {
  if (handleResourceError) {
    window.removeEventListener('error', handleResourceError, true)
  }
})

const stepLabels = computed(() => {
  return lessonData.steps.map((step) => step.title)
})

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

const renderStepContent = (step) => {
  const content = step.content
  let html = ''

  // Step 1: Introduction
  if (step.id === 1) {
    html += `<div class="quote-box story"><i class="pi pi-book quote-icon"></i><p class="story-text">${content.story}</p></div>`

    if (content.whatIsPrototyping) {
      html += `<h3 class="section-title">${content.whatIsPrototyping.title}</h3>`
      html += `<p class="intro-text">${content.whatIsPrototyping.definition}</p>`
      html += `<ul class="benefits-list">`
      content.whatIsPrototyping.benefits.forEach(benefit => {
        html += `<li>${benefit}</li>`
      })
      html += `</ul>`
    }

    if (content.aiRole) {
      html += `<h3 class="section-title">${content.aiRole.title}</h3>`
      html += `<p class="intro-text">${content.aiRole.description}</p>`
      html += `<ul class="benefits-list">`
      content.aiRole.roles.forEach(role => {
        html += `<li>${role}</li>`
      })
      html += `</ul>`
    }

    if (content.realWorldExample) {
      html += `
        <div class="case-study success">
          <i class="pi pi-trophy"></i>
          <div class="case-content">
            <h4>${content.realWorldExample.title}</h4>
            <p><strong>Сценарий:</strong> ${content.realWorldExample.scenario}</p>
            <div class="comparison-grid">
              <div class="traditional-box">
                <h5>❌ Традиционный подход:</h5>
                <p>${content.realWorldExample.traditional}</p>
              </div>
              <div class="ai-box">
                <h5>✅ С использованием ИИ:</h5>
                <p>${content.realWorldExample.withAI}</p>
              </div>
            </div>
            <p class="savings"><strong>💰 ${content.realWorldExample.savings}</strong></p>
          </div>
        </div>`
    }
  }

  // Step 2: Stages
  if (step.id === 2) {
    html += `<p class="intro-text">${content.intro}</p>`

    content.stages.forEach(stage => {
      html += `
        <div class="stage-card">
          <div class="stage-number">Этап ${stage.number}</div>
          <div class="stage-content">
            <h4>${stage.name}</h4>
            <p class="description">${stage.description}</p>
            <div class="ai-help-box">
              <i class="pi pi-sparkles"></i>
              <div>
                <strong>Помощь ИИ:</strong> ${stage.aiHelp}
              </div>
            </div>
            <div class="example-prompt-box">
              <strong>📝 Пример запроса:</strong>
              <code>${escapeHtml(stage.example)}</code>
            </div>
            <div class="output-box">
              <strong>✨ Результат:</strong> ${stage.output}
            </div>
          </div>
        </div>`
    })

    if (content.timeline) {
      html += `
        <div class="timeline-section">
          <h3 class="section-title">${content.timeline.title}</h3>
          <div class="timeline-grid">`
      content.timeline.phases.forEach(phase => {
        html += `
            <div class="timeline-item">
              <div class="timeline-phase">${phase.phase}</div>
              <div class="timeline-tasks">${phase.tasks}</div>
            </div>`
      })
      html += `
          </div>
        </div>`
    }
  }

  // Step 3: Tools
  if (step.id === 3) {
    html += `<p class="intro-text">${content.intro}</p>`

    content.categories.forEach(category => {
      html += `<h3 class="section-title">${category.name}</h3>`
      category.tools.forEach(tool => {
        html += `
          <div class="tool-card">
            <h4>${tool.name}</h4>
            <p class="tool-description">${tool.description}</p>
            <p><strong>Применение:</strong> ${tool.useCases}</p>
            <p><strong>Стоимость:</strong> ${tool.cost}</p>
            ${tool.link ? `<a href="${tool.link}" target="_blank" class="tool-link">Перейти на сайт →</a>` : ''}
          </div>`
      })
    })

    if (content.recommendation) {
      html += `
        <div class="recommendation-box">
          <h3 class="section-title">${content.recommendation.title}</h3>
          <p><strong>Бюджет:</strong> ${content.recommendation.budget}</p>
          <ul class="stack-list">`
      content.recommendation.stack.forEach(item => {
        html += `<li>${item}</li>`
      })
      html += `
          </ul>
          <p class="total-cost"><strong>💰 ${content.recommendation.totalCost}</strong></p>
        </div>`
    }
  }

  // Step 4: Practical Case
  if (step.id === 4) {
    html += `<p class="intro-text">${content.intro}</p>`

    if (content.systemRequirements) {
      html += `<h3 class="section-title">${content.systemRequirements.title}</h3>`
      html += `<ul class="requirements-list">`
      content.systemRequirements.features.forEach(feature => {
        html += `<li>✅ ${feature}</li>`
      })
      html += `</ul>`
    }

    if (content.step1) {
      const s1 = content.step1
      html += `
        <div class="implementation-step">
          <h3 class="section-title">${s1.title}</h3>
          <div class="prompt-box">
            <strong>💬 Запрос к ИИ:</strong>
            <p>${s1.prompt}</p>
          </div>
          <div class="ai-response-box">
            <strong>🤖 Ответ ИИ:</strong>
            <pre class="code-block"><code>${escapeHtml(s1.aiResponse)}</code></pre>
          </div>
          <p class="explanation">${s1.explanation}</p>
        </div>`
    }

    if (content.step2) {
      const s2 = content.step2
      html += `
        <div class="implementation-step">
          <h3 class="section-title">${s2.title}</h3>
          <div class="prompt-box">
            <strong>💬 Запрос к ИИ:</strong>
            <p>${s2.prompt}</p>
          </div>
          <div class="ai-response-box">
            <strong>🤖 Ответ ИИ:</strong>
            <pre class="code-block"><code>${escapeHtml(s2.aiResponse)}</code></pre>
          </div>
          <p class="explanation">${s2.explanation}</p>
        </div>`
    }

    if (content.step3) {
      const s3 = content.step3
      html += `
        <div class="implementation-step">
          <h3 class="section-title">${s3.title}</h3>
          <div class="prompt-box">
            <strong>💬 Запрос к ИИ:</strong>
            <p>${s3.prompt}</p>
          </div>
          <p class="code-preview">${s3.codePreview}</p>
          <h4>Основные функции:</h4>
          <ul class="features-list">`
      s3.features.forEach(feature => {
        html += `<li>${feature}</li>`
      })
      html += `
          </ul>
        </div>`
    }

    if (content.step4) {
      const s4 = content.step4
      html += `
        <div class="implementation-step">
          <h3 class="section-title">${s4.title}</h3>
          <div class="prompt-box">
            <strong>💬 Запрос к ИИ:</strong>
            <p>${s4.prompt}</p>
          </div>
          <h4>Ключевые функции API:</h4>
          <ul class="features-list">`
      s4.features.forEach(feature => {
        html += `<li>${feature}</li>`
      })
      html += `
          </ul>
        </div>`
    }

    if (content.result) {
      html += `
        <div class="result-section">
          <h3 class="section-title">${content.result.title}</h3>
          <p><strong>${content.result.achievement}</strong></p>
          <ul class="deliverables-list">`
      content.result.deliverables.forEach(item => {
        html += `<li>${item}</li>`
      })
      html += `
          </ul>
          <p class="next-steps"><strong>Дальше:</strong> ${content.result.nextSteps}</p>
        </div>`
    }
  }

  // Step 5: Best Practices
  if (step.id === 5) {
    html += `<p class="intro-text">${content.intro}</p>`

    content.practices.forEach((practice, index) => {
      html += `
        <div class="practice-card">
          <h4>${practice.title}</h4>`

      if (practice.bad && practice.good) {
        html += `
          <div class="comparison-examples">
            <div class="bad-example">${practice.bad}</div>
            <div class="good-example">${practice.good}</div>
          </div>
          <p class="why"><strong>Почему:</strong> ${practice.why}</p>`
      }

      if (practice.description) {
        html += `<p>${practice.description}</p>`
      }

      if (practice.examples) {
        html += `<ul class="examples-list">`
        practice.examples.forEach(ex => {
          html += `<li>${ex}</li>`
        })
        html += `</ul>`
      }

      if (practice.benefit) {
        html += `<p class="benefit">💡 <strong>Преимущество:</strong> ${practice.benefit}</p>`
      }

      if (practice.approach || practice.strategy || practice.tip || practice.goodPractice) {
        const text = practice.approach || practice.strategy || practice.tip || practice.goodPractice
        html += `<p class="approach">${text}</p>`
      }

      if (practice.example) {
        if (Array.isArray(practice.example)) {
          html += `<div class="example-workflow">`
          practice.example.forEach(ex => {
            html += `<div class="workflow-step">${ex}</div>`
          })
          html += `</div>`
        } else {
          html += `<div class="example-box">${practice.example}</div>`
        }
      }

      if (practice.workflow) {
        html += `<ol class="workflow-list">`
        practice.workflow.forEach(step => {
          html += `<li>${step}</li>`
        })
        html += `</ol>`
      }

      if (practice.why) {
        html += `<p class="why-note">❓ ${practice.why}</p>`
      }

      html += `</div>`
    })

    if (content.commonMistakes) {
      html += `<h3 class="section-title">${content.commonMistakes.title}</h3>`
      content.commonMistakes.mistakes.forEach(item => {
        html += `
          <div class="mistake-card">
            <div class="mistake">❌ <strong>Ошибка:</strong> ${item.mistake}</div>
            <div class="solution">✅ <strong>Решение:</strong> ${item.solution}</div>
          </div>`
      })
    }
  }

  // Step 6: Summary and Exercises
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
            <span class="impact badge-${point.impact.toLowerCase().replace(' ', '-')}">${point.impact}</span>
          </div>`
      })
    }

    if (content.practicalExercises) {
      html += `<h3 class="section-title">${content.practicalExercises.title}</h3>`
      content.practicalExercises.exercises.forEach(exercise => {
        html += `
          <div class="exercise-card">
            <div class="exercise-header">
              <span class="level-badge">${exercise.level}</span>
              <h4>${exercise.task}</h4>
            </div>
            <p class="exercise-description">${exercise.description}</p>
            <h5>Шаги выполнения:</h5>
            <ol class="steps-list">`
        exercise.steps.forEach(step => {
          html += `<li>${step}</li>`
        })
        html += `
            </ol>
            <div class="exercise-meta">
              <span><i class="pi pi-clock"></i> ${exercise.time}</span>
              <span><i class="pi pi-check-circle"></i> Результат: ${exercise.outcome}</span>
            </div>
          </div>`
      })
    }

    if (content.resources) {
      html += `<h3 class="section-title">${content.resources.title}</h3>`

      Object.entries(content.resources).forEach(([key, section]) => {
        if (key !== 'title') {
          html += `<h4>${section.title}</h4><ul class="resource-list">`
          section.items.forEach(item => {
            html += `<li><strong>${item.name}</strong> - ${item.description} ${item.url ? `(<a href="${item.url}" target="_blank">ссылка</a>)` : ''}</li>`
          })
          html += `</ul>`
        }
      })
    }

    if (content.finalChallenge) {
      const challenge = content.finalChallenge
      html += `
        <div class="final-challenge">
          <h3 class="section-title">${challenge.title}</h3>
          <p class="challenge-description">${challenge.description}</p>
          <p><strong>${challenge.challenge}</strong></p>
          <ol class="challenge-steps">`
      challenge.steps.forEach(step => {
        html += `<li>${step}</li>`
      })
      html += `
          </ol>
          <p class="expected-result"><strong>Ожидаемый результат:</strong> ${challenge.expectedResult}</p>
          <p class="share-work">${challenge.shareYourWork}</p>
        </div>`
    }

    if (content.conclusion) {
      html += `
        <div class="conclusion-section">
          <h3 class="section-title">${content.conclusion.title}</h3>
          <p class="conclusion-message">${content.conclusion.message}</p>
          <div class="quote-box final-quote">
            <i class="pi pi-quote-right"></i>
            <p class="quote-text">"${content.conclusion.quote.text}"</p>
            <p class="quote-author">— ${content.conclusion.quote.author}</p>
          </div>
          <p class="next-lesson"><strong>${content.conclusion.nextLesson}</strong></p>
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
  localStorage.setItem('tutorial_lesson11_completed', 'true')
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
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
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
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  border-radius: 12px;
  border-left: 4px solid #10B981;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

:deep(.quote-icon) {
  font-size: 1.5rem;
  color: #10B981;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

:deep(.story-text) {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #065F46;
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
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  border: 2px solid #10B981;
}

:deep(.case-study i) {
  font-size: 2rem;
  color: #10B981;
  flex-shrink: 0;
}

:deep(.comparison-grid) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 1rem 0;
}

:deep(.traditional-box), :deep(.ai-box) {
  padding: 1rem;
  border-radius: 8px;
}

:deep(.traditional-box) {
  background: #FEF2F2;
  border-left: 3px solid #EF4444;
}

:deep(.ai-box) {
  background: #F0FDF4;
  border-left: 3px solid #10B981;
}

:deep(.savings) {
  margin-top: 1rem;
  padding: 1rem;
  background: #FEF3C7;
  border-radius: 8px;
  font-size: 1.1rem;
}

:deep(.stage-card) {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  border: 2px solid #E5E7EB;
}

:deep(.stage-number) {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
}

:deep(.stage-content h4) {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
}

:deep(.ai-help-box) {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: #F0FDF4;
  border-radius: 8px;
  margin: 1rem 0;
}

:deep(.ai-help-box i) {
  color: #10B981;
  font-size: 1.25rem;
}

:deep(.example-prompt-box) {
  padding: 1rem;
  background: #FEF3C7;
  border-radius: 8px;
  margin: 0.5rem 0;
  border-left: 4px solid #F59E0B;
}

:deep(.example-prompt-box code) {
  display: block;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

:deep(.output-box) {
  padding: 1rem;
  background: #EFF6FF;
  border-radius: 8px;
  margin: 0.5rem 0;
}

:deep(.timeline-section) {
  margin: 2rem 0;
}

:deep(.timeline-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

:deep(.timeline-item) {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  border: 2px solid #E5E7EB;
}

:deep(.timeline-phase) {
  font-weight: 600;
  color: #10B981;
  margin-bottom: 0.5rem;
}

:deep(.tool-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 2px solid #E5E7EB;
}

:deep(.tool-card h4) {
  margin: 0 0 0.75rem 0;
  color: #1f2937;
}

:deep(.tool-link) {
  display: inline-block;
  margin-top: 0.75rem;
  color: #10B981;
  font-weight: 500;
  text-decoration: none;
}

:deep(.tool-link:hover) {
  text-decoration: underline;
}

:deep(.recommendation-box) {
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  padding: 2rem;
  border-radius: 12px;
  margin: 2rem 0;
  border: 2px solid #10B981;
}

:deep(.stack-list) {
  list-style: none;
  padding-left: 0;
}

:deep(.stack-list li) {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(16, 185, 129, 0.2);
}

:deep(.total-cost) {
  margin-top: 1rem;
  font-size: 1.1rem;
  color: #065F46;
}

:deep(.requirements-list) {
  list-style: none;
  padding-left: 0;
}

:deep(.requirements-list li) {
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  background: #F0FDF4;
  border-radius: 4px;
}

:deep(.implementation-step) {
  margin: 2rem 0;
}

:deep(.prompt-box) {
  padding: 1.5rem;
  background: #FEF3C7;
  border-radius: 12px;
  margin: 1rem 0;
  border-left: 4px solid #F59E0B;
}

:deep(.ai-response-box) {
  margin: 1rem 0;
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
  max-height: 400px;
  overflow-y: auto;
}

:deep(.explanation), :deep(.code-preview) {
  padding: 1rem;
  background: #EFF6FF;
  border-radius: 8px;
  margin: 1rem 0;
  color: #1E40AF;
}

:deep(.features-list), :deep(.deliverables-list) {
  list-style: none;
  padding-left: 0;
}

:deep(.features-list li), :deep(.deliverables-list li) {
  padding: 0.5rem 0;
  border-bottom: 1px solid #E5E7EB;
}

:deep(.result-section) {
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  padding: 2rem;
  border-radius: 12px;
  margin: 2rem 0;
}

:deep(.next-steps) {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
}

:deep(.practice-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 2px solid #E5E7EB;
}

:deep(.comparison-examples) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 1rem 0;
}

:deep(.bad-example), :deep(.good-example) {
  padding: 1rem;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

:deep(.bad-example) {
  background: #FEF2F2;
  border-left: 3px solid #EF4444;
}

:deep(.good-example) {
  background: #F0FDF4;
  border-left: 3px solid #10B981;
}

:deep(.why), :deep(.benefit), :deep(.approach) {
  padding: 0.75rem;
  background: #EFF6FF;
  border-radius: 6px;
  margin-top: 1rem;
}

:deep(.examples-list), :deep(.workflow-list) {
  margin: 1rem 0;
}

:deep(.example-workflow) {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1rem 0;
}

:deep(.workflow-step) {
  padding: 0.75rem;
  background: #F9FAFB;
  border-radius: 6px;
  border-left: 3px solid #10B981;
}

:deep(.mistake-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 2px solid #E5E7EB;
}

:deep(.mistake) {
  padding: 0.75rem;
  background: #FEF2F2;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

:deep(.solution) {
  padding: 0.75rem;
  background: #F0FDF4;
  border-radius: 6px;
}

:deep(.takeaway-item) {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 2px solid #E5E7EB;
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
  background: #FEE2E2;
  color: #991B1B;
}

:deep(.badge-очень-важно) {
  background: #FED7AA;
  color: #9A3412;
}

:deep(.badge-важно) {
  background: #FEF3C7;
  color: #78350F;
}

:deep(.exercise-card) {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 2px solid #10B981;
}

:deep(.exercise-header) {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

:deep(.level-badge) {
  padding: 0.25rem 0.75rem;
  background: #10B981;
  color: white;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

:deep(.exercise-meta) {
  display: flex;
  gap: 1.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #E5E7EB;
  color: #6B7280;
}

:deep(.steps-list) {
  margin: 1rem 0;
  padding-left: 1.5rem;
}

:deep(.resource-list) {
  margin: 1rem 0;
}

:deep(.final-challenge) {
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  padding: 2rem;
  border-radius: 12px;
  margin: 2rem 0;
  border: 2px solid #F59E0B;
}

:deep(.challenge-steps) {
  margin: 1rem 0;
  padding-left: 1.5rem;
}

:deep(.share-work) {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  font-weight: 500;
}

:deep(.conclusion-section) {
  margin-top: 2rem;
}

:deep(.conclusion-message) {
  font-size: 1.05rem;
  line-height: 1.7;
  color: #4B5563;
}

:deep(.final-quote) {
  margin: 2rem 0;
}

:deep(.quote-text) {
  font-size: 1.1rem;
  font-style: italic;
  margin: 0.5rem 0;
}

:deep(.quote-author) {
  text-align: right;
  color: #065F46;
  font-weight: 500;
}

:deep(.next-lesson) {
  padding: 1.5rem;
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  border-radius: 12px;
  text-align: center;
  font-size: 1.1rem;
  color: #065F46;
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

  :deep(.comparison-grid),
  :deep(.comparison-examples) {
    grid-template-columns: 1fr;
  }

  :deep(.timeline-grid) {
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
