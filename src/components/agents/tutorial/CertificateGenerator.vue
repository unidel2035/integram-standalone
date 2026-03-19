<template>
  <div class="certificate-generator">
    <Card class="certificate-card">
      <template #title>
        <div class="certificate-title">
          <i class="pi pi-trophy"></i>
          <h2>Поздравляем с завершением курса!</h2>
        </div>
      </template>

      <template #content>
        <div class="certificate-content">
          <!-- Score Summary -->
          <div class="score-summary">
            <h3>🎉 Оценка проекта:</h3>
            <div class="score-breakdown">
              <div class="score-item">
                <span>✅ Использованы все типы агентов:</span>
                <strong>+20 баллов</strong>
              </div>
              <div class="score-item">
                <span>✅ Корректная валидация:</span>
                <strong>+20 баллов</strong>
              </div>
              <div class="score-item">
                <span>✅ Правильная фильтрация:</span>
                <strong>+20 баллов</strong>
              </div>
              <div class="score-item">
                <span>✅ Точные расчёты:</span>
                <strong>+20 баллов</strong>
              </div>
              <div class="score-item">
                <span>✅ Качественный отчёт:</span>
                <strong>+20 баллов</strong>
              </div>
              <div v-if="safeProjectData.score >= 110" class="score-item bonus">
                <span>⭐ Бонус: Параллельное выполнение:</span>
                <strong>+10 баллов</strong>
              </div>
            </div>
            <div class="total-score">
              <span>Итого:</span>
              <strong>{{ safeProjectData.score }} / 100 баллов</strong>
            </div>
            <div class="grade-display">
              <Tag
                :value="safeProjectData.grade"
                severity="success"
                class="grade-tag"
              />
            </div>
          </div>

          <!-- Certificate Preview -->
          <div class="certificate-preview">
            <div class="certificate" ref="certificateRef">
              <div class="certificate-border">
                <div class="certificate-header">
                  <div class="certificate-icon">🎓</div>
                  <h1>СЕРТИФИКАТ ОБ ОКОНЧАНИИ</h1>
                </div>

                <div class="certificate-body">
                  <div class="course-info">
                    <p class="course-label">Курс:</p>
                    <p class="course-name">{{ template.courseName }}</p>
                  </div>

                  <div class="recipient-info">
                    <p class="recipient-label">Выдан:</p>
                    <p class="recipient-name">{{ userName }}</p>
                  </div>

                  <div class="date-info">
                    <p class="date-label">Дата:</p>
                    <p class="date-value">{{ formattedDate }}</p>
                  </div>

                  <div class="stats-info">
                    <p class="stats-label">Пройдено уроков:</p>
                    <p class="stats-value">5/5</p>
                  </div>

                  <div class="grade-info">
                    <p class="grade-label">Финальная оценка:</p>
                    <p class="grade-value">{{ safeProjectData.grade }}</p>
                  </div>

                  <div class="skills-section">
                    <p class="skills-title">Получены навыки:</p>
                    <div class="skills-list">
                      <div
                        v-for="skill in template.achievements"
                        :key="skill"
                        class="skill-item"
                      >
                        ✅ {{ skill }}
                      </div>
                    </div>
                  </div>

                  <div class="achievements-section">
                    <div class="achievement-stat">
                      <span class="stat-icon">🏆</span>
                      <span>Бейджи: 5/5</span>
                    </div>
                    <div class="achievement-stat">
                      <span class="stat-icon">⭐</span>
                      <span>Общий XP: 400</span>
                    </div>
                  </div>
                </div>

                <div class="certificate-footer">
                  <div class="certificate-id">
                    ID: {{ certificateId }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Unlocked Features -->
          <div class="unlocked-features">
            <h3>🔓 Теперь тебе доступно:</h3>
            <div class="features-grid">
              <div
                v-for="feature in unlockedFeatures"
                :key="feature.text"
                class="feature-item"
              >
                <span class="feature-icon">{{ feature.icon }}</span>
                <span class="feature-text">{{ feature.text }}</span>
              </div>
            </div>

            <div class="bonuses-section">
              <h4>🎁 Бонусы:</h4>
              <div class="bonuses-list">
                <div v-for="bonus in bonuses" :key="bonus" class="bonus-item">
                  {{ bonus }}
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="certificate-actions">
            <Button
              label="Скачать PDF"
              icon="pi pi-download"
              size="large"
              @click="downloadPDF"
              :loading="isGenerating"
            />
            <Button
              label="Поделиться в соц. сетях"
              icon="pi pi-share-alt"
              size="large"
              outlined
              @click="share"
            />
          </div>

          <!-- Next Steps -->
          <div class="next-steps-section">
            <h3>🚀 Что дальше?</h3>
            <Accordion :multiple="true">
              <AccordionTab header="Практика">
                <div class="next-steps-content">
                  <router-link
                    v-for="item in nextSteps.practice.items"
                    :key="item.text"
                    :to="item.link"
                    class="next-step-link"
                  >
                    {{ item.text }}
                  </router-link>
                </div>
              </AccordionTab>

              <AccordionTab header="Углублённое изучение">
                <div class="next-steps-content">
                  <router-link
                    v-for="item in nextSteps.learning.items"
                    :key="item.text"
                    :to="item.link"
                    class="next-step-link"
                  >
                    {{ item.text }}
                  </router-link>
                </div>
              </AccordionTab>

              <AccordionTab header="Сообщество">
                <div class="next-steps-content">
                  <a
                    v-for="item in nextSteps.community.items"
                    :key="item.text"
                    :href="item.link"
                    class="next-step-link"
                    target="_blank"
                  >
                    {{ item.text }}
                  </a>
                </div>
              </AccordionTab>
            </Accordion>
          </div>

          <!-- Final Actions -->
          <div class="final-actions">
            <Button
              label="Перейти к конструктору"
              icon="pi pi-arrow-right"
              size="large"
              @click="goToBuilder"
            />
            <Button
              label="Начать курс заново"
              icon="pi pi-replay"
              size="large"
              outlined
              @click="restartCourse"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

import { useToast } from 'primevue/usetoast'

const props = defineProps({
  projectData: {
    type: Object,
    required: false,
    default: () => ({
      score: 0,
      grade: 'Не завершено'
    })
  },
  template: {
    type: Object,
    required: true
  },
  unlockedFeatures: {
    type: Array,
    required: true
  },
  bonuses: {
    type: Array,
    required: true
  },
  nextSteps: {
    type: Object,
    required: true
  },
  userName: {
    type: String,
    default: 'Пользователь'
  }
})

const router = useRouter()
const toast = useToast()

const certificateRef = ref(null)
const isGenerating = ref(false)
const certificateId = ref(generateCertificateId())

const safeProjectData = computed(() => {
  return {
    score: props.projectData?.score ?? 0,
    grade: props.projectData?.grade ?? 'Не завершено'
  }
})

const formattedDate = computed(() => {
  return new Date().toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

function generateCertificateId() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return `CERT-${timestamp}-${random}`.toUpperCase()
}

const downloadPDF = async () => {
  isGenerating.value = true

  try {
    // Simulate PDF generation
    await new Promise(resolve => setTimeout(resolve, 1500))

    toast.add({
      severity: 'success',
      summary: 'Успешно',
      detail: 'Сертификат скачан!',
      life: 3000
    })

    // In a real implementation, use jsPDF or html2canvas to generate the PDF
    // For now, just show success message
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось создать PDF',
      life: 3000
    })
  } finally {
    isGenerating.value = false
  }
}

const share = () => {
  const shareData = {
    title: 'Сертификат об окончании курса "Система AI-агентов ДронДок"',
    text: `Я успешно завершил курс по AI-агентам с оценкой "${safeProjectData.value.grade}"!`,
    url: window.location.href
  }

  if (navigator.share) {
    navigator.share(shareData)
  } else {
    // Fallback - copy to clipboard
    navigator.clipboard.writeText(shareData.text + ' ' + shareData.url)
    toast.add({
      severity: 'info',
      summary: 'Скопировано',
      detail: 'Ссылка скопирована в буфер обмена',
      life: 3000
    })
  }
}

const goToBuilder = () => {
  router.push('/agents/workflow-builder')
}

const restartCourse = () => {
  router.push('/agents/tutorial/lesson-1')
}
</script>

<style scoped lang="scss">
.certificate-generator {
  .certificate-card {
    .certificate-title {
      display: flex;
      align-items: center;
      gap: 1rem;

      i {
        font-size: 2rem;
        color: var(--orange-500);
      }

      h2 {
        margin: 0;
        font-size: 1.75rem;
      }
    }

    .certificate-content {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .score-summary {
      h3 {
        margin: 0 0 1rem 0;
      }

      .score-breakdown {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;

        .score-item {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem;
          background: var(--p-surface-card);
          border-radius: 6px;

          &.bonus {
            background: rgba(245, 158, 11, 0.1);
            border-left: 3px solid var(--orange-500);
          }

          strong {
            color: var(--primary-color);
          }
        }
      }

      .total-score {
        display: flex;
        justify-content: space-between;
        padding: 1rem;
        background: var(--primary-color);
        color: white;
        border-radius: 6px;
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 1rem;
      }

      .grade-display {
        text-align: center;

        .grade-tag {
          font-size: 1.5rem;
          padding: 0.75rem 1.5rem;
        }
      }
    }

    .certificate-preview {
      display: flex;
      justify-content: center;
      padding: 2rem 0;

      .certificate {
        width: 100%;
        max-width: 800px;
        background: linear-gradient(135deg, #f0f4ff, #e0e7ff);
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);

        .certificate-border {
          border: 4px solid var(--primary-color);
          border-radius: 8px;
          padding: 2rem;
          background: white;

          .certificate-header {
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid var(--surface-border);

            .certificate-icon {
              font-size: 3rem;
              margin-bottom: 0.5rem;
            }

            h1 {
              margin: 0;
              font-size: 1.75rem;
              font-weight: 700;
              color: var(--primary-color);
            }
          }

          .certificate-body {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;

            .course-info,
            .recipient-info,
            .date-info,
            .stats-info,
            .grade-info {
              text-align: center;

              p {
                margin: 0.25rem 0;
              }

              .course-label,
              .recipient-label,
              .date-label,
              .stats-label,
              .grade-label {
                font-size: 0.875rem;
                color: var(--text-color-secondary);
              }

              .course-name {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--primary-color);
              }

              .recipient-name {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text-color);
              }

              .date-value,
              .stats-value,
              .grade-value {
                font-size: 1.1rem;
                font-weight: 500;
              }
            }

            .skills-section {
              margin-top: 1rem;
              padding-top: 1rem;
              border-top: 1px solid var(--surface-border);

              .skills-title {
                margin: 0 0 1rem 0;
                font-weight: 600;
                text-align: center;
              }

              .skills-list {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 0.5rem;

                .skill-item {
                  padding: 0.5rem;
                  background: var(--p-surface-card);
                  border-radius: 4px;
                  font-size: 0.9rem;
                }
              }
            }

            .achievements-section {
              display: flex;
              justify-content: center;
              gap: 2rem;
              padding: 1rem;
              background: var(--p-surface-card);
              border-radius: 6px;

              .achievement-stat {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-weight: 600;

                .stat-icon {
                  font-size: 1.5rem;
                }
              }
            }
          }

          .certificate-footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid var(--surface-border);
            text-align: center;

            .certificate-id {
              font-size: 0.75rem;
              color: var(--text-color-secondary);
              font-family: 'Courier New', monospace;
            }
          }
        }
      }
    }

    .unlocked-features {
      padding: 1.5rem;
      background: var(--p-surface-card);
      border-radius: 8px;

      h3 {
        margin: 0 0 1rem 0;
      }

      .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1.5rem;

        .feature-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: white;
          border-radius: 6px;

          .feature-icon {
            font-size: 1.25rem;
          }

          .feature-text {
            flex: 1;
          }
        }
      }

      .bonuses-section {
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--surface-border);

        h4 {
          margin: 0 0 0.75rem 0;
        }

        .bonuses-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;

          .bonus-item {
            padding: 0.5rem;
            background: rgba(245, 158, 11, 0.1);
            border-radius: 4px;
            border-left: 3px solid var(--orange-500);
          }
        }
      }
    }

    .certificate-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;

      button {
        min-width: 200px;
      }
    }

    .next-steps-section {
      h3 {
        margin: 0 0 1rem 0;
      }

      .next-steps-content {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;

        .next-step-link {
          padding: 0.75rem;
          background: var(--p-surface-card);
          border-radius: 6px;
          text-decoration: none;
          color: var(--text-color);
          transition: all 0.2s;

          &:hover {
            background: var(--primary-color);
            color: white;
            transform: translateX(4px);
          }
        }
      }
    }

    .final-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-border);

      button {
        min-width: 250px;
      }
    }
  }
}

@media (max-width: 768px) {
  .certificate-actions,
  .final-actions {
    flex-direction: column;

    button {
      width: 100%;
    }
  }

  .certificate-preview .certificate {
    padding: 1rem;

    .certificate-border {
      padding: 1rem;
    }
  }
}
</style>
