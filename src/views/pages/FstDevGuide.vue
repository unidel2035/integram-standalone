<template>
  <div class="dev-guide">

    <div class="guide-hero">
      <div class="hero-badge">Курс для управляющих фондом</div>
      <h1>Вы — разработчик.<br>Серьёзно.</h1>
      <p class="hero-sub">
        За 4 дня вы пройдёте путь от «я не программист» до «я только что смержил pull request».
        Никакого кода вручную. Только задачи — Claude сделает остальное.
      </p>
      <div class="hero-days">
        <div v-for="day in days" :key="day.n" class="hero-day" :class="{ done: day.done }">
          <div class="day-n">День {{ day.n }}</div>
          <div class="day-title">{{ day.title }}</div>
        </div>
      </div>
    </div>

    <!-- ─── ДЕНЬ 1 ─── -->
    <section class="day-section" id="day1">
      <div class="day-label"><span class="day-badge">День 1</span> GitHub — ваш рабочий стол</div>

      <div class="lesson">
        <div class="lesson-num">1.1</div>
        <div class="lesson-body">
          <h3>Создайте аккаунт на GitHub</h3>
          <p>GitHub — это как Google Docs, только для кода. Там хранится весь проект, история изменений и задачи.</p>

          <div class="steps">
            <div class="step">
              <div class="step-circle">1</div>
              <div>Откройте <span class="link-fake">github.com</span> и нажмите <strong>Sign up</strong></div>
            </div>
            <div class="step">
              <div class="step-circle">2</div>
              <div>Введите email, придумайте логин (например <code>ivanov-fund</code>) и пароль</div>
            </div>
            <div class="step">
              <div class="step-circle">3</div>
              <div>Подтвердите email — придёт письмо</div>
            </div>
            <div class="step">
              <div class="step-circle">4</div>
              <div>Готово. Сообщите свой логин администратору — вас добавят в команду</div>
            </div>
          </div>

          <div class="screen-block">
            <div class="screen-bar browser-bar">
              <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
              <div class="address-bar"><i class="pi pi-lock"></i> github.com/join</div>
            </div>
            <div class="screen-body browser-ui">
              <div class="gh-signup">
                <div class="gh-logo">GitHub</div>
                <div class="gh-title">Create your account</div>
                <div class="gh-field"><span class="gh-label">Username</span><div class="gh-input">ivanov-fund<span class="cursor-blink">|</span></div></div>
                <div class="gh-field"><span class="gh-label">Email address</span><div class="gh-input">ivan@fund.ru</div></div>
                <div class="gh-field"><span class="gh-label">Password</span><div class="gh-input">••••••••••••</div></div>
                <div class="gh-btn">Continue</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="lesson">
        <div class="lesson-num">1.2</div>
        <div class="lesson-body">
          <h3>Найдите репозиторий проекта</h3>
          <p>Репозиторий — это папка с кодом на GitHub. Наш проект:</p>

          <div class="repo-links">
            <div class="repo-link-card">
              <div class="rl-icon fst"><i class="pi pi-briefcase"></i></div>
              <div>
                <div class="rl-name">ФСТ НТИ — инвест-платформа</div>
                <code class="rl-url">github.com/unidel2035/fund</code>
                <div class="rl-desc">Ветка для работы: <strong>main</strong></div>
              </div>
            </div>
          </div>

          <div class="callout info">
            <i class="pi pi-info-circle"></i>
            Зайдите в репозиторий и нажмите <strong>Star</strong> (звёздочка справа вверху) — так вы добавите его в закладки.
          </div>
        </div>
      </div>

      <div class="lesson">
        <div class="lesson-num">1.3</div>
        <div class="lesson-body">
          <h3>Создайте свою первую задачу (Issue)</h3>
          <p>Issue — это задача или баг. Создайте её — и Claude автоматически напишет код.</p>

          <div class="steps">
            <div class="step">
              <div class="step-circle">1</div>
              <div>Откройте репозиторий → вкладка <strong>Issues</strong> → кнопка <strong>New issue</strong></div>
            </div>
            <div class="step">
              <div class="step-circle">2</div>
              <div>Напишите <strong>название</strong> — коротко и ясно, что нужно сделать</div>
            </div>
            <div class="step">
              <div class="step-circle">3</div>
              <div>В <strong>описании</strong> — подробнее: что должно быть, что сейчас не так</div>
            </div>
            <div class="step">
              <div class="step-circle">4</div>
              <div>Нажмите <strong>Submit new issue</strong></div>
            </div>
          </div>

          <div class="screen-block">
            <div class="screen-bar browser-bar">
              <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
              <div class="address-bar"><i class="pi pi-lock"></i> github.com/unidel2035/fund/issues/new</div>
            </div>
            <div class="screen-body browser-ui">
              <div class="gh-issue-form">
                <div class="gif-label">Title</div>
                <div class="gif-input">На странице /fst-committee не показываются проекты из базы</div>
                <div class="gif-label" style="margin-top:0.75rem">Description</div>
                <div class="gif-textarea">
                  При открытии страницы http://173.249.2.184:5174/fst-committee<br>
                  список проектов пустой. Ожидаемо должны загрузиться 6 проектов<br>
                  из базы ai2o.ru/fst/1155.<br><br>
                  Консоль браузера показывает 401 Unauthorized.
                </div>
                <div class="gif-submit">Submit new issue</div>
              </div>
            </div>
          </div>

          <div class="callout success">
            <i class="pi pi-check-circle"></i>
            <strong>Пример хорошей задачи:</strong> «Добавить фильтр по субфонду на странице /fst-committee.
            Сейчас показываются все проекты. Нужно выпадающее меню: БАС / РОБО / МЭ / Все.»
          </div>
        </div>
      </div>

      <div class="day-result">
        <i class="pi pi-check-circle"></i>
        <span>Итог дня 1: у вас есть аккаунт GitHub, вы нашли репозиторий и создали первую задачу</span>
      </div>
    </section>

    <!-- ─── ДЕНЬ 2 ─── -->
    <section class="day-section" id="day2">
      <div class="day-label"><span class="day-badge day2">День 2</span> Telegram-бот решает задачи</div>

      <div class="lesson">
        <div class="lesson-num">2.1</div>
        <div class="lesson-body">
          <h3>Познакомьтесь с ботом</h3>
          <p>
            У нас есть Telegram-бот, который связан с Claude. Вы пишете боту номер задачи —
            бот отдаёт её Claude, который читает код, пишет исправление и создаёт Pull Request.
          </p>

          <div class="bot-flow">
            <div class="bf-step">
              <div class="bf-icon tg"><i class="pi pi-send"></i></div>
              <div class="bf-label">Вы пишете боту</div>
            </div>
            <div class="bf-arrow"><i class="pi pi-arrow-right"></i></div>
            <div class="bf-step">
              <div class="bf-icon ai"><i class="pi pi-microchip-ai"></i></div>
              <div class="bf-label">Claude читает код</div>
            </div>
            <div class="bf-arrow"><i class="pi pi-arrow-right"></i></div>
            <div class="bf-step">
              <div class="bf-icon gh"><i class="pi pi-code-branch"></i></div>
              <div class="bf-label">Создаётся PR</div>
            </div>
            <div class="bf-arrow"><i class="pi pi-arrow-right"></i></div>
            <div class="bf-step">
              <div class="bf-icon ok"><i class="pi pi-check"></i></div>
              <div class="bf-label">Вы мержите</div>
            </div>
          </div>
        </div>
      </div>

      <div class="lesson">
        <div class="lesson-num">2.2</div>
        <div class="lesson-body">
          <h3>Отправьте команду solve issue</h3>
          <p>Когда issue создан, скопируйте его номер (например <code>#142</code>) и напишите боту:</p>

          <div class="screen-block">
            <div class="screen-bar"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="screen-title">Telegram — @DronDocBot</span></div>
            <div class="screen-body tg-chat">
              <div class="tg-msg out">
                <div class="tg-bubble out">solve issue #142</div>
                <div class="tg-time">14:32</div>
              </div>
              <div class="tg-msg in">
                <div class="tg-bubble in">
                  Принял задачу #142<br>
                  Читаю код проекта...<br><br>
                  <span class="tg-code">Нашёл проблему: fstApi.js использует<br>
                  неверный эндпоинт _m_list вместо object/.<br>
                  Исправляю...</span>
                </div>
                <div class="tg-time">14:32</div>
              </div>
              <div class="tg-msg in">
                <div class="tg-bubble in">
                  Готово! Создан Pull Request:<br>
                  <span class="tg-link">github.com/.../pull/143</span><br><br>
                  Проверьте и смержите.
                </div>
                <div class="tg-time">14:34</div>
              </div>
            </div>
          </div>

          <div class="callout info">
            <i class="pi pi-info-circle"></i>
            Можно писать и свободным текстом: <em>«Почини загрузку проектов на странице инвест-комитета»</em> —
            бот сам найдёт подходящий issue или создаст новый.
          </div>
        </div>
      </div>

      <div class="day-result">
        <i class="pi pi-check-circle"></i>
        <span>Итог дня 2: вы отправили задачу боту и получили Pull Request от Claude</span>
      </div>
    </section>

    <!-- ─── ДЕНЬ 3 ─── -->
    <section class="day-section" id="day3">
      <div class="day-label"><span class="day-badge day3">День 3</span> Pull Request — смотрим и мержим</div>

      <div class="lesson">
        <div class="lesson-num">3.1</div>
        <div class="lesson-body">
          <h3>Что такое Pull Request?</h3>
          <p>
            Pull Request (PR) — это предложение изменить код. Claude написал исправление в отдельной ветке
            и просит вас его одобрить. Пока вы не нажмёте «Merge», код в продакшен не попадёт.
          </p>
          <div class="analogy-card">
            <div class="analogy-icon"><i class="pi pi-file-edit"></i></div>
            <div>
              <strong>Аналогия из финансов:</strong> PR — как инвестиционный меморандум на одобрение комитета.
              Claude — аналитик, который подготовил документ. Вы — комитет, который его утверждает.
            </div>
          </div>
        </div>
      </div>

      <div class="lesson">
        <div class="lesson-num">3.2</div>
        <div class="lesson-body">
          <h3>Просмотр изменений</h3>

          <div class="steps">
            <div class="step">
              <div class="step-circle">1</div>
              <div>Откройте репозиторий → вкладка <strong>Pull requests</strong></div>
            </div>
            <div class="step">
              <div class="step-circle">2</div>
              <div>Нажмите на PR от Claude (обычно помечен как <code>bot</code> или <code>claude-fix</code>)</div>
            </div>
            <div class="step">
              <div class="step-circle">3</div>
              <div>Вкладка <strong>Files changed</strong> — видите что именно изменилось:<br>
                <span class="code-diff add">+ зелёное = добавлено</span><br>
                <span class="code-diff remove">- красное = удалено</span>
              </div>
            </div>
            <div class="step">
              <div class="step-circle">4</div>
              <div>Вкладка <strong>Conversation</strong> — читаете описание от Claude, что он сделал и почему</div>
            </div>
          </div>

          <div class="screen-block">
            <div class="screen-bar browser-bar">
              <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
              <div class="address-bar"><i class="pi pi-lock"></i> github.com/unidel2035/fund/pull/143</div>
            </div>
            <div class="screen-body browser-ui">
              <div class="gh-pr">
                <div class="gh-pr-title">
                  <span class="pr-badge open">Open</span>
                  fix: починить загрузку проектов в /fst-committee
                </div>
                <div class="gh-pr-meta">claude-bot открыл · 2 минуты назад · 1 commit · 3 files changed</div>
                <div class="gh-pr-desc">
                  <strong>Проблема:</strong> fstApi.js использовал _m_list/1155 вместо object/1155.<br>
                  Сервер возвращал меню ролей вместо списка проектов.<br><br>
                  <strong>Исправлено:</strong> изменён эндпоинт + убран _xsrf из GET-запросов.
                </div>
                <div class="gh-pr-files">
                  <div class="pr-file"><i class="pi pi-file-edit"></i> src/services/fstApi.js <span class="pr-changes">+18 -8</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="lesson">
        <div class="lesson-num">3.3</div>
        <div class="lesson-body">
          <h3>Смержить PR</h3>

          <div class="steps">
            <div class="step">
              <div class="step-circle">1</div>
              <div>Прокрутите вниз до кнопки <strong style="color:#2ea043">Merge pull request</strong></div>
            </div>
            <div class="step">
              <div class="step-circle">2</div>
              <div>Нажмите её → подтвердите <strong>Confirm merge</strong></div>
            </div>
            <div class="step">
              <div class="step-circle">3</div>
              <div>Код автоматически деплоится на сервер (CI/CD)</div>
            </div>
            <div class="step">
              <div class="step-circle">4</div>
              <div>Откройте страницу в браузере и проверьте результат</div>
            </div>
          </div>

          <div class="screen-block">
            <div class="screen-bar browser-bar">
              <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
              <div class="address-bar"><i class="pi pi-lock"></i> github.com/.../pull/143</div>
            </div>
            <div class="screen-body browser-ui">
              <div class="gh-merge-block">
                <div class="merge-checks">
                  <span class="check-ok"><i class="pi pi-check-circle"></i> All checks passed</span>
                  <span class="check-ok"><i class="pi pi-check-circle"></i> No conflicts</span>
                </div>
                <div class="merge-btn">Merge pull request</div>
                <div class="merge-sub">Merges 1 commit into dev from fix/fst-projects</div>
              </div>
            </div>
          </div>

          <div class="callout warning">
            <i class="pi pi-exclamation-triangle"></i>
            Если видите красный крестик на проверках — напишите боту: <em>«PR #143 не проходит проверки, исправь»</em>.
            Claude посмотрит логи и пофиксит.
          </div>
        </div>
      </div>

      <div class="day-result">
        <i class="pi pi-check-circle"></i>
        <span>Итог дня 3: вы посмотрели PR, поняли что изменилось, и смержили его в продакшен</span>
      </div>
    </section>

    <!-- ─── ДЕНЬ 4 ─── -->
    <section class="day-section" id="day4">
      <div class="day-label"><span class="day-badge day4">День 4</span> Claude CLI — прямой разговор с кодом</div>

      <div class="lesson">
        <div class="lesson-num">4.1</div>
        <div class="lesson-body">
          <h3>Зайти на сервер через SSH</h3>
          <p>
            SSH — это защищённое подключение к серверу через терминал.
            Терминал — это текстовый интерфейс для управления компьютером.
          </p>

          <div class="callout info">
            <i class="pi pi-info-circle"></i>
            <strong>На Mac/Linux:</strong> откройте Terminal.app<br>
            <strong>На Windows:</strong> скачайте <strong>Windows Terminal</strong> из Microsoft Store (бесплатно)
          </div>

          <div class="screen-block">
            <div class="screen-bar"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="screen-title">Terminal</span></div>
            <div class="screen-body">
              <div class="cmd-line"><span class="prompt">$</span> ssh root@173.249.2.184</div>
              <div class="cmd-out gray"># Вводим пароль: 4Te4LmzwDil2rr4</div>
              <div class="cmd-out gray"># (пароль не отображается при вводе — это нормально)</div>
              <div class="cmd-out green">Welcome to Ubuntu 22.04.3 LTS</div>
              <div class="cmd-line"><span class="prompt">root@vps#</span> su - hive &amp;&amp; cd /home/hive/found-repo</div>
              <div class="cmd-line"><span class="prompt">root@vps:~/found-repo#</span> <span class="cmd-cursor">_</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="lesson">
        <div class="lesson-num">4.2</div>
        <div class="lesson-body">
          <h3>Запустить Claude и поговорить с кодом</h3>

          <div class="screen-block">
            <div class="screen-bar"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="screen-title">Terminal</span></div>
            <div class="screen-body">
              <div class="cmd-line"><span class="prompt">root@vps:~/found-repo#</span> claude</div>
              <div class="cmd-out green">╔════════════════════════════════════╗</div>
              <div class="cmd-out green">║     Claude Code  — ФСТ НТИ         ║</div>
              <div class="cmd-out green">╚════════════════════════════════════╝</div>
              <div class="cmd-out gray">Привет! Я вижу весь код проекта.</div>
              <div class="cmd-out gray">Что нужно сделать?</div>
              <div class="cmd-out white"><br>You: Добавь на страницу /fst-committee фильтр<br>по субфонду (БАС / РОБО / МЭ)</div>
              <div class="cmd-out gray"><br>Claude: Смотрю файл FstCommittee.vue...</div>
              <div class="cmd-out gray">Нашёл секцию с проектами. Добавляю<br>выпадающее меню с фильтрацией...</div>
              <div class="cmd-out green">✓ Готово! Изменил src/views/pages/FstCommittee.vue</div>
              <div class="cmd-out gray">Страница обновится автоматически.</div>
            </div>
          </div>

          <div class="examples-grid">
            <div class="eg-card" v-for="ex in claudeExamples" :key="ex.text">
              <div class="eg-icon"><i class="pi pi-send"></i></div>
              <div class="eg-body">
                <div class="eg-text">{{ ex.text }}</div>
                <div class="eg-tag">{{ ex.tag }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="lesson">
        <div class="lesson-num">4.3</div>
        <div class="lesson-body">
          <h3>Полезные команды Claude</h3>
          <div class="cmd-table">
            <div class="ct-row" v-for="cmd in claudeCmds" :key="cmd.cmd">
              <code class="ct-cmd">{{ cmd.cmd }}</code>
              <span class="ct-desc">{{ cmd.desc }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="day-result day4">
        <i class="pi pi-star-fill"></i>
        <div>
          <strong>Поздравляем!</strong> Вы прошли полный цикл разработки:
          GitHub → Issue → Telegram-бот → PR → Merge → Claude CLI.
          Теперь вы управляете кодом так же, как управляете портфелем.
        </div>
      </div>
    </section>

    <!-- ─── Шпаргалка ─── -->
    <section class="cheatsheet" id="cheatsheet">
      <h2><i class="pi pi-bookmark"></i> Шпаргалка</h2>
      <div class="cs-grid">
        <div class="cs-card" v-for="item in cheatsheet" :key="item.title">
          <div class="cs-icon" :style="{ background: item.color }"><i :class="item.icon"></i></div>
          <div class="cs-body">
            <div class="cs-title">{{ item.title }}</div>
            <div class="cs-items">
              <div v-for="line in item.lines" :key="line" class="cs-item">
                <i class="pi pi-angle-right"></i> {{ line }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
const days = [
  { n: 1, title: 'GitHub и первый Issue' },
  { n: 2, title: 'Бот решает задачи' },
  { n: 3, title: 'PR — смотрим и мержим' },
  { n: 4, title: 'Claude CLI' },
]

const claudeExamples = [
  { text: 'Покажи мне все проекты со статусом "На рассмотрении ИК"', tag: 'аналитика данных' },
  { text: 'Добавь экспорт таблицы проектов в Excel', tag: 'новая функция' },
  { text: 'Объясни как работает инвест-комитет в коде', tag: 'объяснение' },
  { text: 'Почему на странице /fst-committee пустой список? Консоль: 401', tag: 'отладка' },
  { text: 'Сделай кнопку "Отправить на ИК" у каждого проекта', tag: 'UI' },
  { text: 'Что изменилось за последнюю неделю в проекте?', tag: 'история' },
]

const claudeCmds = [
  { cmd: '/help',    desc: 'Показать все доступные команды' },
  { cmd: '/clear',   desc: 'Начать разговор заново (очистить память)' },
  { cmd: '/compact', desc: 'Сжать историю — если Claude начал "забывать"' },
  { cmd: '/cost',    desc: 'Сколько потрачено токенов за сессию' },
  { cmd: 'Ctrl+C',   desc: 'Остановить выполнение и задать новый вопрос' },
  { cmd: 'Ctrl+D',   desc: 'Выйти из Claude и вернуться в терминал' },
]

const cheatsheet = [
  {
    title: 'GitHub',
    icon: 'pi pi-github',
    color: '#24292e',
    lines: [
      'Issues → New issue → описать задачу → Submit',
      'Pull requests → выбрать PR → Files changed → Merge',
      'Репо ФСТ: github.com/unidel2035/fund (ветка main)',
    ]
  },
  {
    title: 'Telegram-бот',
    icon: 'pi pi-send',
    color: '#2ca5e0',
    lines: [
      'solve issue #N — решить задачу N',
      'status — статус текущих задач',
      'deploy — задеплоить последние изменения',
      'Можно писать свободным текстом на русском',
    ]
  },
  {
    title: 'Сервер SSH',
    icon: 'pi pi-server',
    color: '#6366f1',
    lines: [
      'ssh root@173.249.2.184',
      'Пароль: 4Te4LmzwDil2rr4',
      'cd /home/hive/found-repo',
      'Сайт: http://173.249.2.184:5174',
    ]
  },
  {
    title: 'Claude CLI',
    icon: 'pi pi-microchip-ai',
    color: '#d97706',
    lines: [
      'На сервере: команда claude',
      'Пишите задачи на русском — Claude понимает',
      'Чем точнее задача — тем лучше результат',
      'Можно просить объяснить код, найти баги, добавить фичи',
    ]
  },
]
</script>

<style scoped>
.dev-guide {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem;
  color: var(--p-text-color);
}

/* ── Hero ── */
.guide-hero {
  text-align: center;
  padding: 3rem 2rem;
  background: linear-gradient(135deg, var(--p-primary-100) 0%, var(--p-surface-100) 100%);
  border-radius: 1.25rem;
  margin-bottom: 3rem;
  border: 1px solid var(--p-surface-200);
}
.hero-badge {
  display: inline-block;
  background: var(--p-primary-color);
  color: white;
  padding: 0.3rem 1rem;
  border-radius: 2rem;
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.guide-hero h1 {
  font-size: 2.25rem;
  font-weight: 800;
  margin: 0 0 1rem;
  line-height: 1.2;
}
.hero-sub {
  font-size: 1.05rem;
  color: var(--p-text-muted-color);
  max-width: 580px;
  margin: 0 auto 2rem;
  line-height: 1.6;
}
.hero-days {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.hero-day {
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-300);
  border-radius: 0.75rem;
  padding: 0.75rem 1.25rem;
  text-align: center;
  min-width: 140px;
}
.day-n { font-size: 0.72rem; text-transform: uppercase; color: var(--p-primary-color); font-weight: 700; margin-bottom: 0.2rem; }
.day-title { font-size: 0.875rem; font-weight: 600; }

/* ── Day section ── */
.day-section {
  margin-bottom: 4rem;
}
.day-label {
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 1.75rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.day-badge {
  background: var(--p-primary-color);
  color: white;
  padding: 0.25rem 0.875rem;
  border-radius: 2rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
}
.day-badge.day2 { background: #2ca5e0; }
.day-badge.day3 { background: #16a34a; }
.day-badge.day4 { background: #d97706; }

/* ── Lesson ── */
.lesson {
  display: flex;
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}
.lesson-num {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--p-surface-200);
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 0.1rem;
}
.lesson-body { flex: 1; }
.lesson-body h3 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.lesson-body p { color: var(--p-text-muted-color); margin: 0 0 1rem; line-height: 1.6; font-size: 0.925rem; }

/* ── Steps ── */
.steps { display: flex; flex-direction: column; gap: 0.625rem; margin-bottom: 1.25rem; }
.step {
  display: flex;
  gap: 0.875rem;
  align-items: flex-start;
  padding: 0.625rem 0.875rem;
  background: var(--p-surface-50);
  border: 1px solid var(--p-surface-200);
  border-radius: 0.625rem;
  font-size: 0.9rem;
  line-height: 1.5;
}
.step-circle {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: white;
  font-size: 0.8rem;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
code { font-family: monospace; background: rgba(0,0,0,0.07); padding: 0.1em 0.4em; border-radius: 0.25rem; font-size: 0.875em; }

/* ── Screen blocks ── */
.screen-block {
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid var(--p-surface-300);
  margin-bottom: 1rem;
  background: #1a1a1a;
}
.screen-bar {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 0.875rem;
  background: #2d2d2d;
}
.screen-bar.browser-bar { background: var(--p-surface-200); }
.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot.red { background: #ff5f57; }
.dot.yellow { background: #febc2e; }
.dot.green { background: #28c840; }
.screen-title { margin-left: 0.5rem; font-size: 0.75rem; color: #888; }
.address-bar {
  flex: 1; background: var(--p-surface-0); border-radius: 2rem;
  padding: 0.2rem 0.875rem; font-size: 0.78rem; color: var(--p-text-muted-color);
  display: flex; align-items: center; gap: 0.4rem; border: 1px solid var(--p-surface-300);
}
.address-bar i { color: #22c55e; font-size: 0.7rem; }
.screen-body {
  padding: 1rem 1.25rem;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.7;
  color: #e0e0e0;
}
.screen-body.browser-ui {
  background: var(--p-surface-0);
  font-family: inherit;
  color: var(--p-text-color);
}
.cmd-line { display: flex; gap: 0.5rem; }
.prompt { color: #28c840; font-weight: bold; flex-shrink: 0; }
.cmd-out.gray { color: #888; }
.cmd-out.green { color: #28c840; }
.cmd-out.white { color: #e0e0e0; }
.cmd-cursor { animation: blink 1s step-end infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

/* ── GitHub UI mocks ── */
.gh-signup { max-width: 320px; margin: 0 auto; padding: 1.5rem; }
.gh-logo { font-size: 1.5rem; font-weight: 900; margin-bottom: 0.75rem; }
.gh-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; }
.gh-field { margin-bottom: 0.75rem; }
.gh-label { font-size: 0.78rem; font-weight: 600; margin-bottom: 0.2rem; display: block; }
.gh-input {
  border: 1px solid var(--p-surface-300);
  border-radius: 0.375rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
  background: var(--p-surface-50);
}
.gh-btn {
  background: #2ea043; color: white; border-radius: 0.375rem;
  padding: 0.45rem 1rem; font-size: 0.875rem; font-weight: 600;
  display: inline-block; margin-top: 0.25rem; cursor: default;
}
.cursor-blink { animation: blink 1s step-end infinite; }
.gh-issue-form { padding: 1.25rem; max-width: 500px; }
.gif-label { font-size: 0.78rem; font-weight: 700; margin-bottom: 0.3rem; }
.gif-input {
  border: 2px solid #0969da; border-radius: 0.375rem;
  padding: 0.4rem 0.75rem; font-size: 0.875rem;
  background: var(--p-surface-0);
}
.gif-textarea {
  border: 1px solid var(--p-surface-300); border-radius: 0.375rem;
  padding: 0.625rem 0.75rem; font-size: 0.8rem; line-height: 1.6;
  min-height: 80px; background: var(--p-surface-0); color: var(--p-text-muted-color);
}
.gif-submit {
  margin-top: 0.75rem; background: #2ea043; color: white;
  border-radius: 0.375rem; padding: 0.45rem 1rem;
  font-size: 0.875rem; font-weight: 600; display: inline-block; cursor: default;
}

/* ── Repo links ── */
.repo-links { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
.repo-link-card {
  display: flex; gap: 0.875rem; padding: 0.875rem 1rem;
  border-radius: 0.625rem; border: 1px solid var(--p-surface-200);
  background: var(--p-surface-50);
}
.rl-icon {
  width: 40px; height: 40px; border-radius: 0.5rem;
  background: #24292e; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.rl-icon.fst { background: #1d4ed8; }
.rl-icon i { color: white; font-size: 1.1rem; }
.rl-name { font-weight: 600; margin-bottom: 0.2rem; font-size: 0.9rem; }
.rl-url { font-family: monospace; font-size: 0.8rem; color: var(--p-primary-color); display: block; margin-bottom: 0.2rem; }
.rl-desc { font-size: 0.8rem; color: var(--p-text-muted-color); }

/* ── Callouts ── */
.callout {
  display: flex; gap: 0.75rem; align-items: flex-start;
  padding: 0.75rem 1rem; border-radius: 0.625rem; margin-bottom: 1rem;
  font-size: 0.875rem; line-height: 1.6;
}
.callout i { flex-shrink: 0; margin-top: 0.1rem; }
.callout.info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
.callout.info i { color: #3b82f6; }
.callout.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.callout.success i { color: #16a34a; }
.callout.warning { background: #fefce8; border: 1px solid #fef08a; color: #713f12; }
.callout.warning i { color: #ca8a04; }

/* ── Bot flow ── */
.bot-flow {
  display: flex; align-items: center; flex-wrap: wrap;
  gap: 0.5rem; margin-bottom: 1.25rem;
}
.bf-step { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
.bf-icon {
  width: 48px; height: 48px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--p-surface-200);
}
.bf-icon i { font-size: 1.2rem; }
.bf-icon.tg { background: #2ca5e0; }
.bf-icon.tg i { color: white; }
.bf-icon.ai { background: #d97706; }
.bf-icon.ai i { color: white; }
.bf-icon.gh { background: #24292e; }
.bf-icon.gh i { color: white; }
.bf-icon.ok { background: #16a34a; }
.bf-icon.ok i { color: white; }
.bf-label { font-size: 0.75rem; color: var(--p-text-muted-color); text-align: center; }
.bf-arrow { color: var(--p-text-muted-color); }

/* ── Telegram chat ── */
.screen-body.tg-chat {
  background: #0e0e0e;
  display: flex; flex-direction: column; gap: 0.625rem;
}
.tg-msg { display: flex; flex-direction: column; }
.tg-msg.out { align-items: flex-end; }
.tg-msg.in { align-items: flex-start; }
.tg-bubble {
  max-width: 75%; padding: 0.5rem 0.875rem;
  border-radius: 0.875rem; font-size: 0.82rem; line-height: 1.5;
}
.tg-bubble.out { background: #2b5278; color: #e0e0e0; border-bottom-right-radius: 0.2rem; }
.tg-bubble.in  { background: #1f2b38; color: #c8d6e3; border-bottom-left-radius: 0.2rem; }
.tg-code { font-family: monospace; font-size: 0.78rem; opacity: 0.85; }
.tg-link { color: #5fb8e0; }
.tg-time { font-size: 0.68rem; color: #555; margin-top: 0.15rem; padding: 0 0.3rem; }

/* ── Analogy card ── */
.analogy-card {
  display: flex; gap: 1rem; align-items: flex-start;
  padding: 1rem 1.25rem;
  background: var(--p-surface-100);
  border-radius: 0.75rem;
  border: 1px solid var(--p-surface-200);
  margin-bottom: 1.25rem;
  font-size: 0.9rem; line-height: 1.6;
}
.analogy-icon { font-size: 1.5rem; flex-shrink: 0; color: var(--p-primary-color); }

/* ── PR mock ── */
.gh-pr { padding: 1rem 1.25rem; }
.gh-pr-title { font-size: 1rem; font-weight: 700; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.5rem; }
.pr-badge { padding: 0.15rem 0.6rem; border-radius: 2rem; font-size: 0.72rem; font-weight: 600; }
.pr-badge.open { background: #2ea043; color: white; }
.gh-pr-meta { font-size: 0.78rem; color: var(--p-text-muted-color); margin-bottom: 0.75rem; }
.gh-pr-desc { font-size: 0.82rem; line-height: 1.6; padding: 0.75rem; background: var(--p-surface-50); border-radius: 0.5rem; border: 1px solid var(--p-surface-200); margin-bottom: 0.75rem; }
.gh-pr-files { display: flex; flex-direction: column; gap: 0.3rem; }
.pr-file { font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem; color: var(--p-text-muted-color); }
.pr-changes { color: #16a34a; font-family: monospace; margin-left: auto; }
.code-diff { font-family: monospace; font-size: 0.8rem; display: block; }
.code-diff.add { color: #16a34a; }
.code-diff.remove { color: #dc2626; }

/* ── Merge block ── */
.gh-merge-block { padding: 1.25rem; }
.merge-checks { display: flex; gap: 1rem; margin-bottom: 1rem; font-size: 0.82rem; }
.check-ok { display: flex; align-items: center; gap: 0.35rem; color: #16a34a; }
.merge-btn {
  display: inline-block; background: #2ea043; color: white;
  padding: 0.5rem 1.25rem; border-radius: 0.375rem;
  font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; cursor: default;
}
.merge-sub { font-size: 0.78rem; color: var(--p-text-muted-color); }

/* ── Examples grid ── */
.examples-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.625rem;
  margin-top: 1rem;
}
.eg-card {
  display: flex; gap: 0.75rem; padding: 0.75rem 0.875rem;
  border-radius: 0.625rem; border: 1px solid var(--p-surface-200);
  background: var(--p-surface-50);
}
.eg-icon { color: var(--p-primary-color); flex-shrink: 0; margin-top: 0.15rem; }
.eg-text { font-size: 0.82rem; line-height: 1.4; margin-bottom: 0.3rem; }
.eg-tag { font-size: 0.7rem; color: var(--p-primary-color); font-weight: 600; text-transform: uppercase; }

/* ── Command table ── */
.cmd-table { display: flex; flex-direction: column; border-radius: 0.625rem; overflow: hidden; border: 1px solid var(--p-surface-200); }
.ct-row {
  display: flex; align-items: center; gap: 1rem; padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--p-surface-200); font-size: 0.875rem;
}
.ct-row:last-child { border-bottom: none; }
.ct-row:nth-child(even) { background: var(--p-surface-50); }
.ct-cmd { font-family: monospace; font-size: 0.875rem; color: var(--p-primary-color); font-weight: 600; min-width: 80px; flex-shrink: 0; }
.ct-desc { color: var(--p-text-muted-color); }

/* ── Day result ── */
.day-result {
  display: flex; align-items: flex-start; gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 0.75rem;
  color: #166534;
  font-size: 0.9rem;
  line-height: 1.5;
  margin-top: 0.5rem;
}
.day-result i { color: #16a34a; flex-shrink: 0; margin-top: 0.1rem; font-size: 1.1rem; }
.day-result.day4 { background: #fefce8; border-color: #fef08a; color: #713f12; }
.day-result.day4 i { color: #ca8a04; }

/* ── Cheatsheet ── */
.cheatsheet {
  background: var(--p-surface-100);
  border-radius: 1rem;
  padding: 2rem;
  border: 1px solid var(--p-surface-200);
}
.cheatsheet h2 {
  margin: 0 0 1.5rem;
  font-size: 1.2rem;
  display: flex; align-items: center; gap: 0.625rem;
}
.cheatsheet h2 i { color: var(--p-primary-color); }
.cs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; }
.cs-card {
  display: flex; gap: 1rem; padding: 1rem 1.125rem;
  background: var(--p-surface-0);
  border-radius: 0.75rem;
  border: 1px solid var(--p-surface-200);
}
.cs-icon {
  width: 40px; height: 40px; border-radius: 0.5rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.cs-icon i { color: white; font-size: 1.1rem; }
.cs-title { font-weight: 700; margin-bottom: 0.5rem; font-size: 0.9rem; }
.cs-item { font-size: 0.8rem; color: var(--p-text-muted-color); display: flex; align-items: flex-start; gap: 0.3rem; line-height: 1.5; margin-bottom: 0.2rem; }
.cs-item i { color: var(--p-primary-color); font-size: 0.7rem; margin-top: 0.25rem; flex-shrink: 0; }

/* ── Link fake ── */
.link-fake { color: var(--p-primary-color); text-decoration: underline; cursor: default; }

@media (max-width: 640px) {
  .dev-guide { padding: 1rem; }
  .guide-hero h1 { font-size: 1.5rem; }
  .hero-days { gap: 0.5rem; }
  .hero-day { min-width: 110px; }
  .lesson { flex-direction: column; gap: 0.75rem; }
  .lesson-num { width: 36px; height: 36px; }
  .bot-flow { justify-content: center; }
  .cs-grid { grid-template-columns: 1fr; }
  .examples-grid { grid-template-columns: 1fr; }
}
</style>
