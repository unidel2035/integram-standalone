<template>
  <Dialog
    v-model:visible="visible"
    modal
    :style="{ width: '900px' }"
    :breakpoints="{ '960px': '95vw' }"
  >
    <template #header>
      <div class="help-header">
        <i class="pi pi-question-circle"></i>
        <span>Справка по чатам</span>
      </div>
    </template>

    <div class="help-content">
      <TabView>
        <!-- ЧАТ ИИ -->
        <TabPanel header="Чат ИИ">
          <div class="tab-content">
            <!-- Основы -->
            <div class="help-section">
              <h3><i class="pi pi-prime"></i> Основы работы с ИИ-ассистентом</h3>
              <p>ИИ-ассистент помогает с различными задачами: ответы на вопросы, генерация кода, анализ данных и многое другое.</p>

              <h4>Основные возможности:</h4>
              <ul>
                <li><strong>Текстовые запросы</strong> — задавайте вопросы естественным языком</li>
                <li><strong>Работа с файлами</strong> — прикрепляйте документы, изображения, таблицы</li>
                <li><strong>Работа с данными</strong> — подключайте таблицы и отчёты из Integram</li>
                <li><strong>Голосовой ввод</strong> — используйте микрофон для диктовки</li>
                <li><strong>История чатов</strong> — сохраняйте и загружайте предыдущие разговоры</li>
                <li><strong>Редактирование сообщений</strong> — изменяйте свои сообщения кнопкой карандаша</li>
              </ul>
            </div>

            <!-- Быстрые промпты: Финмодель -->
            <div class="help-section">
              <h3><i class="pi pi-chart-line"></i> Быстрые промпты: Финмодель</h3>
              <p>
                Кнопка <strong class="badge-finmodel">Финмодель</strong> появляется в блочном редакторе документов
                (<code>/block-editor</code>). Открывает меню готовых запросов для работы с финансовой моделью дронов.
              </p>

              <div class="quick-prompts-grid">
                <div class="qp-item finmodel-qp">
                  <span class="qp-icon">📊</span>
                  <div>
                    <strong>Создай финмодель дронов</strong>
                    <p>Создаёт новую финансовую модель в редакторе</p>
                  </div>
                </div>
                <div class="qp-item finmodel-qp">
                  <span class="qp-icon">📋</span>
                  <div>
                    <strong>Покажи P&amp;L дронов</strong>
                    <p>Отчёт о прибылях и убытках</p>
                  </div>
                </div>
                <div class="qp-item finmodel-qp">
                  <span class="qp-icon">📈</span>
                  <div>
                    <strong>Сравни сценарии</strong>
                    <p>Сравнение финансовых сценариев</p>
                  </div>
                </div>
                <div class="qp-item finmodel-qp">
                  <span class="qp-icon">🌐</span>
                  <div>
                    <strong>Добавь Экосистему бизнесов</strong>
                    <p>Расширяет модель экосистемой</p>
                  </div>
                </div>
                <div class="qp-item finmodel-qp">
                  <span class="qp-icon">🔀</span>
                  <div>
                    <strong>Добавь Sankey-диаграмму</strong>
                    <p>Визуализация потоков данных</p>
                  </div>
                </div>
                <div class="qp-item finmodel-qp">
                  <span class="qp-icon">💰</span>
                  <div>
                    <strong>Увеличь выручку на 30%</strong>
                    <p>Оптимизация доходных показателей</p>
                  </div>
                </div>
              </div>

              <Message severity="info" :closable="false" class="mt-3">
                Кнопка <strong>Финмодель ✓</strong> (зелёный индикатор) означает, что финансовая модель активна
                и ИИ будет работать с её данными.
              </Message>
            </div>

            <!-- Быстрые промпты: Онтологии -->
            <div class="help-section">
              <h3><i class="pi pi-sitemap"></i> Быстрые промпты: Онтологии</h3>
              <p>
                Кнопка <strong class="badge-ontology">Онтологии</strong> появляется на страницах:
                <code>/event-ontology</code>, <code>/ontology</code>, <code>/drononomics</code>.
                Открывает меню готовых запросов для работы с событийной онтологией БАС.
              </p>

              <div class="quick-prompts-grid">
                <div class="qp-item ontology-qp">
                  <span class="qp-icon">🎯</span>
                  <div>
                    <strong>Покажи сценарии БАС</strong>
                    <p>Все сценарии применения беспилотных авиационных систем</p>
                  </div>
                </div>
                <div class="qp-item ontology-qp">
                  <span class="qp-icon">➕</span>
                  <div>
                    <strong>Создать сценарий</strong>
                    <p>Создать новый сценарий применения БАС</p>
                  </div>
                </div>
                <div class="qp-item ontology-qp">
                  <span class="qp-icon">📦</span>
                  <div>
                    <strong>Модели событий</strong>
                    <p>Список всех моделей событий в онтологии</p>
                  </div>
                </div>
                <div class="qp-item ontology-qp">
                  <span class="qp-icon">🔍</span>
                  <div>
                    <strong>Поиск концептов</strong>
                    <p>Поиск по концептам онтологии БПЛА</p>
                  </div>
                </div>
                <div class="qp-item ontology-qp">
                  <span class="qp-icon">🌳</span>
                  <div>
                    <strong>Иерархия концептов</strong>
                    <p>Иерархическое дерево концептов онтологии</p>
                  </div>
                </div>
                <div class="qp-item ontology-qp">
                  <span class="qp-icon">📊</span>
                  <div>
                    <strong>Статистика онтологии</strong>
                    <p>Количество концептов, акторов, моделей, индивидов</p>
                  </div>
                </div>
                <div class="qp-item ontology-qp">
                  <span class="qp-icon">👥</span>
                  <div>
                    <strong>Список акторов</strong>
                    <p>Все акторы событийной онтологии</p>
                  </div>
                </div>
                <div class="qp-item ontology-qp">
                  <span class="qp-icon">🔎</span>
                  <div>
                    <strong>BSL-запрос</strong>
                    <p>Составить запрос к событиям: $Actor, $BEFORE, $AFTER, $BETWEEN, $JOIN…</p>
                  </div>
                </div>
              </div>

              <Message severity="info" :closable="false" class="mt-3">
                Кнопки-чипы над полем ввода (Сценарии БАС, Статистика, Список акторов) доступны прямо
                в чате на страницах онтологий — без открытия меню.
              </Message>
            </div>

            <!-- Агенты и команды -->
            <div class="help-section">
              <h3><i class="pi pi-compass"></i> Агенты навигации и знаний</h3>
              <p>Специальные команды для получения информации о платформе:</p>

              <div class="command-list">
                <div class="command-item">
                  <code>/info [запрос]</code>
                  <span>Информация о платформе и доступных функциях</span>
                </div>
                <div class="command-item">
                  <code>/navigate [запрос]</code>
                  <span>Предложения для навигации по разделам сайта</span>
                </div>
                <div class="command-item">
                  <code>/search [запрос]</code>
                  <span>Поиск по маршрутам и агентам платформы</span>
                </div>
              </div>

              <Message severity="info" :closable="false" class="mt-3">
                <strong>Автоматическое обогащение:</strong> ИИ автоматически добавляет контекст о платформе
                при запросах, содержащих: "что ты умеешь", "какие функции", "куда перейти", "где находится", "help".
              </Message>
            </div>

            <!-- Режим агента -->
            <div class="help-section">
              <h3><i class="pi pi-code"></i> Режим агента (Agent Mode)</h3>
              <p>В режиме агента ИИ может выполнять сложные многошаговые задачи:</p>
              <ul>
                <li>Выполнять поиск в интернете</li>
                <li>Генерировать и запускать код</li>
                <li>Работать с Git-репозиториями в workspace</li>
                <li>Устанавливать зависимости и пакеты</li>
                <li>Работать с инструментами онтологии (<code>event_engine_*</code>, <code>ontology_*</code>)</li>
              </ul>

              <p class="text-sm text-gray-600 mt-2">
                <i class="pi pi-info-circle"></i>
                Включите режим агента в настройках модели (иконка шестерёнки).
              </p>
            </div>

            <!-- Настройки -->
            <div class="help-section">
              <h3><i class="pi pi-cog"></i> Настройки модели</h3>
              <p>Доступные параметры для тонкой настройки поведения ИИ:</p>
              <ul>
                <li><strong>Temperature (Температура)</strong> — креативность ответов (0–2)</li>
                <li><strong>Context Size</strong> — размер контекста промпта</li>
                <li><strong>Top P, Top K</strong> — параметры сэмплирования</li>
                <li><strong>Custom System Prompt</strong> — дополнительные инструкции для ИИ</li>
              </ul>
            </div>

            <!-- Работа с вложениями -->
            <div class="help-section">
              <h3><i class="pi pi-paperclip"></i> Прикрепление файлов и данных</h3>
              <p>Два способа прикрепления информации:</p>

              <h4>1. Файлы с устройства:</h4>
              <ul>
                <li>Текстовые документы (.txt, .pdf, .doc, .docx)</li>
                <li>Таблицы (.xls, .xlsx, .csv)</li>
                <li>Изображения (PNG, JPG и др.)</li>
                <li>Код и данные (.json и др.)</li>
              </ul>

              <h4>2. Данные из Integram:</h4>
              <ul>
                <li>Таблицы — подключите таблицу для анализа</li>
                <li>Отчёты — прикрепите результаты запросов</li>
                <li>Документы — добавьте справочный документ в контекст ИИ</li>
              </ul>
            </div>

            <!-- Советы -->
            <div class="help-section">
              <h3><i class="pi pi-lightbulb"></i> Советы по работе</h3>
              <ul>
                <li>Формулируйте запросы чётко и подробно</li>
                <li>Используйте контекст — ссылайтесь на предыдущие сообщения</li>
                <li>Сохраняйте важные чаты через кнопку "История"</li>
                <li>Редактируйте свои сообщения для уточнения (кнопка карандаша)</li>
                <li>Используйте "Отправить снова" для повторной генерации ответа</li>
                <li>На страницах онтологий используйте кнопку <strong class="badge-ontology">Онтологии</strong> для быстрых запросов</li>
                <li>В блочном редакторе используйте кнопку <strong class="badge-finmodel">Финмодель</strong> для работы с финансовыми моделями</li>
              </ul>
            </div>
          </div>
        </TabPanel>

        <!-- ОНТОЛОГИИ -->
        <TabPanel header="Онтологии (ИИ)">
          <div class="tab-content">
            <div class="help-section">
              <h3><i class="pi pi-sitemap"></i> Работа с событийной онтологией БАС</h3>
              <p>
                На страницах онтологий (<code>/event-ontology</code>, <code>/ontology</code>, <code>/drononomics</code>)
                ИИ-чат автоматически подключает инструменты для работы с событийной онтологией беспилотных авиационных систем (БАС).
              </p>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-bolt"></i> Кнопка "Онтологии" — быстрые промпты</h3>
              <p>Нажмите кнопку <strong class="badge-ontology">Онтологии</strong> в панели инструментов чата, чтобы открыть меню готовых запросов.</p>

              <h4>Группа: Сценарии БАС</h4>
              <div class="command-list">
                <div class="command-item">
                  <code>🎯 Покажи сценарии БАС</code>
                  <span>Все сценарии применения беспилотных авиационных систем (<code>event_engine_get_scenarios</code>)</span>
                </div>
                <div class="command-item">
                  <code>➕ Создать сценарий</code>
                  <span>Создать новый сценарий применения БАС (<code>event_engine_create_concept</code>)</span>
                </div>
                <div class="command-item">
                  <code>📦 Модели событий</code>
                  <span>Список всех моделей событий (<code>event_engine_list_models</code>)</span>
                </div>
              </div>

              <h4>Группа: Онтология</h4>
              <div class="command-list">
                <div class="command-item">
                  <code>🔍 Поиск концептов</code>
                  <span>Поиск по концептам онтологии БПЛА (<code>ontology_search_concepts</code>)</span>
                </div>
                <div class="command-item">
                  <code>🌳 Иерархия концептов</code>
                  <span>Иерархическое дерево концептов (<code>ontology_get_hierarchy</code>)</span>
                </div>
                <div class="command-item">
                  <code>📊 Статистика онтологии</code>
                  <span>Количество концептов, акторов, моделей, индивидов (<code>event_engine_get_stats</code>)</span>
                </div>
              </div>

              <h4>Группа: Акторы и запросы</h4>
              <div class="command-list">
                <div class="command-item">
                  <code>👥 Список акторов</code>
                  <span>Все акторы событийной онтологии (<code>event_engine_list_actors</code>)</span>
                </div>
                <div class="command-item">
                  <code>🔎 BSL-запрос</code>
                  <span>Составить запрос к событиям (фильтры: <code>$Actor</code>, <code>$BEFORE</code>, <code>$AFTER</code>, <code>$BETWEEN</code>, <code>$FIRST</code>, <code>$LAST</code>, <code>$JOIN</code>, <code>$PATTERN</code>)</span>
                </div>
              </div>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-tag"></i> Контекстные чипы</h3>
              <p>
                Над полем ввода на страницах онтологий отображаются кнопки-чипы для быстрого запуска
                наиболее частых действий без открытия меню:
              </p>
              <ul>
                <li><strong>Сценарии БАС</strong> — показать все сценарии</li>
                <li><strong>Статистика</strong> — статистика онтологии</li>
                <li><strong>Список акторов</strong> — все акторы</li>
                <li><strong>Создать сценарий</strong> (на странице <code>/event-ontology</code>) — создать новый сценарий</li>
                <li><strong>BSL-запрос</strong> (на странице <code>/event-ontology</code>) — запрос к событиям</li>
              </ul>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-wrench"></i> Инструменты онтологии (MCP-инструменты)</h3>
              <p>ИИ использует следующие инструменты при работе с онтологией:</p>

              <div class="command-list">
                <div class="command-item">
                  <code>event_engine_get_scenarios</code>
                  <span>Получить все сценарии применения БАС</span>
                </div>
                <div class="command-item">
                  <code>event_engine_get_stats</code>
                  <span>Статистика онтологии</span>
                </div>
                <div class="command-item">
                  <code>event_engine_list_actors</code>
                  <span>Список акторов</span>
                </div>
                <div class="command-item">
                  <code>event_engine_list_models</code>
                  <span>Список моделей событий</span>
                </div>
                <div class="command-item">
                  <code>event_engine_create_concept</code>
                  <span>Создать новый концепт / сценарий</span>
                </div>
                <div class="command-item">
                  <code>ontology_search_concepts</code>
                  <span>Поиск по концептам онтологии БПЛА</span>
                </div>
                <div class="command-item">
                  <code>ontology_get_hierarchy</code>
                  <span>Иерархия концептов</span>
                </div>
              </div>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-info-circle"></i> Placeholder поля ввода</h3>
              <p>
                На страницах онтологий поле ввода показывает подсказку:
                <em>"Спросите про онтологию, сценарии, миссии..."</em> —
                это означает, что ИИ уже готов отвечать на вопросы об онтологии.
              </p>
            </div>
          </div>
        </TabPanel>

        <!-- ОБЩИЙ ЧАТ -->
        <TabPanel header="Общий чат">
          <div class="tab-content">
            <div class="help-section">
              <h3><i class="pi pi-users"></i> О общем чате</h3>
              <p>Общий чат — это публичное пространство для общения между пользователями платформы в реальном времени.</p>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-send"></i> Отправка сообщений</h3>
              <ul>
                <li>Введите текст в поле ввода внизу чата</li>
                <li>Нажмите Enter или кнопку "Отправить"</li>
                <li>Ваше сообщение появится справа (голубым фоном)</li>
                <li>Сообщения других пользователей — слева</li>
              </ul>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-user"></i> Профили пользователей</h3>
              <p>Кликните на аватар или имя пользователя, чтобы открыть его профиль.</p>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-pencil"></i> Индикатор набора</h3>
              <p>Когда другой пользователь печатает сообщение, вы увидите индикатор "Пользователь печатает..."</p>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-trash"></i> Удаление сообщений</h3>
              <p>Вы можете удалить только свои сообщения:</p>
              <ul>
                <li>Наведите курсор на своё сообщение</li>
                <li>Нажмите кнопку корзины</li>
                <li>Сообщение будет удалено для всех пользователей</li>
              </ul>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-calendar"></i> Группировка по датам</h3>
              <p>Сообщения автоматически группируются по датам (Сегодня, Вчера, дата) для удобства навигации.</p>
            </div>
          </div>
        </TabPanel>

        <!-- КОМНАТЫ -->
        <TabPanel header="Комнаты">
          <div class="tab-content">
            <div class="help-section">
              <h3><i class="pi pi-comments"></i> О комнатах</h3>
              <p>Комнаты — это приватные или групповые чаты для обсуждения конкретных тем или проектов.</p>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-plus"></i> Создание комнаты</h3>
              <ol>
                <li>Нажмите кнопку "Новый чат" на вкладке "Общий чат" или в комнатах</li>
                <li>Или нажмите кнопку "+" в правом верхнем углу</li>
                <li>Введите название комнаты</li>
                <li>Добавьте описание (опционально)</li>
                <li>Нажмите "Создать"</li>
              </ol>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-users"></i> Управление участниками</h3>
              <p><strong>Создатель комнаты может:</strong></p>
              <ul>
                <li>Просматривать список участников</li>
                <li>Удалять участников из комнаты</li>
                <li>Закрывать комнату</li>
              </ul>

              <p class="mt-3"><strong>Участники могут:</strong></p>
              <ul>
                <li>Отправлять сообщения</li>
                <li>Просматривать список участников</li>
                <li>Покинуть комнату</li>
              </ul>

              <p class="text-sm text-gray-600 mt-2">
                <i class="pi pi-info-circle"></i>
                Кнопка "Участники" доступна в заголовке комнаты.
              </p>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-window-minimize"></i> Открытие и закрытие вкладок</h3>
              <ul>
                <li>Комнаты открываются как отдельные вкладки</li>
                <li>Можно открыть несколько комнат одновременно</li>
                <li>Закройте вкладку кнопкой "×" рядом с названием комнаты</li>
                <li>Переключайтесь между вкладками кликом на заголовок</li>
              </ul>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-sign-out"></i> Выход из комнаты</h3>
              <p>Чтобы покинуть комнату:</p>
              <ol>
                <li>Откройте комнату</li>
                <li>Нажмите кнопку "Участники"</li>
                <li>Найдите себя в списке</li>
                <li>Нажмите "Удалить" или "Покинуть"</li>
              </ol>
              <p class="text-sm text-gray-600 mt-2">
                <i class="pi pi-exclamation-triangle"></i>
                После выхода вы потеряете доступ к истории сообщений комнаты.
              </p>
            </div>

            <div class="help-section">
              <h3><i class="pi pi-info-circle"></i> Информация о комнате</h3>
              <p>В заголовке каждой комнаты отображается:</p>
              <ul>
                <li><strong>Название</strong> — имя комнаты</li>
                <li><strong>Описание</strong> — краткое описание темы</li>
                <li><strong>Участники</strong> — кнопка для просмотра списка участников</li>
              </ul>
            </div>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <template #footer>
      <div class="help-footer">
        <Button label="Закрыть" icon="pi pi-times" @click="closeDialog" autofocus />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const visible = ref(props.modelValue)

function closeDialog() {
  visible.value = false
  emit('update:modelValue', false)
}

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
})

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})
</script>

<style scoped>
.help-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.help-header i {
  color: var(--primary-color);
  font-size: 1.5rem;
}

.help-content {
  max-height: 70vh;
  overflow-y: auto;
}

.tab-content {
  padding: 1rem 0;
}

.help-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--surface-border);
}

.help-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.help-section h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  color: var(--text-color);
  font-size: 1.1rem;
}

.help-section h3 i {
  color: var(--primary-color);
}

.help-section h4 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  color: var(--text-color);
  font-size: 1rem;
}

.help-section ul,
.help-section ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  line-height: 1.8;
}

.help-section li {
  margin: 0.25rem 0;
}

.help-section p {
  line-height: 1.6;
  margin: 0.5rem 0;
}

/* Badge-style labels for buttons */
.badge-finmodel {
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 12px;
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
  font-size: 0.85rem;
}

.badge-ontology {
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 12px;
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
  font-size: 0.85rem;
}

/* Quick prompts grid */
.quick-prompts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.qp-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--surface-border);
  background: var(--surface-ground);
}

.qp-item .qp-icon {
  font-size: 1.4rem;
  line-height: 1;
  flex-shrink: 0;
}

.qp-item div strong {
  display: block;
  font-size: 0.9rem;
  color: var(--text-color);
  margin-bottom: 0.2rem;
}

.qp-item div p {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  margin: 0;
  line-height: 1.4;
}

.finmodel-qp {
  border-left: 3px solid #4caf50;
}

.ontology-qp {
  border-left: 3px solid #66bb6a;
}

/* Command list */
.command-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.command-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--surface-ground);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}

.command-item code {
  min-width: 180px;
  padding: 0.4rem 0.6rem;
  background: var(--surface-card);
  border-radius: 4px;
  font-family: monospace;
  color: var(--primary-color);
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
}

.command-item span {
  color: var(--text-color-secondary);
  line-height: 1.5;
  flex: 1;
}

.help-footer {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

:deep(.p-tabview-nav) {
  background: var(--surface-card);
  border-bottom: 2px solid var(--surface-border);
}

:deep(.p-tabview-nav-link) {
  font-weight: 500;
  color: var(--text-color-secondary);
}

:deep(.p-tabview-nav-link:hover) {
  color: var(--text-color);
}

:deep(.p-highlight .p-tabview-nav-link) {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

@media (max-width: 768px) {
  .command-item {
    flex-direction: column;
    gap: 0.5rem;
  }

  .command-item code {
    min-width: auto;
    white-space: normal;
  }

  .quick-prompts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
