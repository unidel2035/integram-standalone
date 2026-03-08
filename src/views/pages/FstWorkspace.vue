<template>
  <FstPageLayout>
    <!-- Header -->
    <template #header>
      <div class="header-content">
        <div class="title-section">
          <i class="pi pi-desktop" style="font-size: 2rem; color: var(--p-primary-color)"></i>
          <div>
            <h1>Рабочие пространства</h1>
            <p class="subtitle">Claude CLI, терминал и управление проектами</p>
          </div>
        </div>
      </div>
    </template>

    <!-- Workspace Cards -->
    <div class="workspace-grid">
      <!-- Claude CLI Terminal -->
      <Card class="workspace-card workspace-card--primary" @click="$router.push('/fst-terminal')">
        <template #content>
          <div class="wcard-icon">
            <i class="pi pi-code"></i>
          </div>
          <h3>Claude Code CLI</h3>
          <p>Интерактивный терминал с AI-ассистентом Claude. Полноценный TTY через WebSocket — редактирование кода, git, файловая система.</p>
          <div class="wcard-features">
            <Tag value="xterm.js" severity="info" rounded />
            <Tag value="WebSocket" severity="success" rounded />
            <Tag value="PTY" severity="warn" rounded />
          </div>
        </template>
      </Card>

      <!-- AI Chat (existing) -->
      <Card class="workspace-card" @click="openChat">
        <template #content>
          <div class="wcard-icon">
            <i class="pi pi-comments"></i>
          </div>
          <h3>ИИ-ассистент</h3>
          <p>Чат с AI-моделями: Claude, DeepSeek, GPT-4o, YandexGPT. Анализ документов, генерация кода, ответы на вопросы.</p>
          <div class="wcard-features">
            <Tag value="Мультимодель" severity="info" rounded />
            <Tag value="Стриминг" severity="success" rounded />
          </div>
        </template>
      </Card>

      <!-- Dev Guide -->
      <Card class="workspace-card" @click="$router.push('/fst-dev-guide')">
        <template #content>
          <div class="wcard-icon">
            <i class="pi pi-book"></i>
          </div>
          <h3>Путь обучения</h3>
          <p>5-дневный курс по VentureOS: архитектура, Integram API, PrimeVue, AI-интеграция, Claude CLI.</p>
          <div class="wcard-features">
            <Tag value="5 дней" severity="info" rounded />
            <Tag value="Практика" severity="success" rounded />
          </div>
        </template>
      </Card>

      <!-- Agent School -->
      <Card class="workspace-card" @click="$router.push('/fst-school')">
        <template #content>
          <div class="wcard-icon">
            <i class="pi pi-users"></i>
          </div>
          <h3>Школа агентов ИК</h3>
          <p>Обучение AI-агентов инвесткомитета на исторических данных. Калибровка весов и точности.</p>
          <div class="wcard-features">
            <Tag value="6 агентов" severity="info" rounded />
            <Tag value="AI обучение" severity="warn" rounded />
          </div>
        </template>
      </Card>

      <!-- Glossary -->
      <Card class="workspace-card" @click="$router.push('/fst-glossary')">
        <template #content>
          <div class="wcard-icon">
            <i class="pi pi-list"></i>
          </div>
          <h3>Глоссарий</h3>
          <p>Справочник венчурных терминов с пояснениями. TRL, MRL, IRR, NAV, Cap Table и другие.</p>
          <div class="wcard-features">
            <Tag value="Термины" severity="info" rounded />
          </div>
        </template>
      </Card>

      <!-- Quiz -->
      <Card class="workspace-card" @click="$router.push('/fst-quiz')">
        <template #content>
          <div class="wcard-icon">
            <i class="pi pi-question-circle"></i>
          </div>
          <h3>Мини-квизы</h3>
          <p>Интерактивные тесты для закрепления знаний по венчурным инвестициям и работе с платформой.</p>
          <div class="wcard-features">
            <Tag value="Тесты" severity="info" rounded />
          </div>
        </template>
      </Card>
    </div>
  </FstPageLayout>
</template>

<script setup>
function openChat() {
  // Open the chat panel via global event
  window.dispatchEvent(new CustomEvent('toggle-chat'))
}
</script>

<style scoped>
.fst-workspace-page {
  padding: 0;
}

.page-header {
  margin-bottom: 1.5rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.title-section h1 {
  margin: 0;
  font-size: 1rem;
  color: var(--p-text-color);
}

.subtitle {
  margin: 0.25rem 0 0;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.workspace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.workspace-card {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  border: 1px solid var(--p-content-border-color);
}

.workspace-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--p-text-color) 10%, transparent);
}

.workspace-card--primary {
  border-color: var(--p-primary-color);
  border-width: 2px;
}

.wcard-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.wcard-icon i {
  font-size: 1.25rem;
}

.workspace-card h3 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: var(--p-text-color);
}

.workspace-card p {
  margin: 0 0 0.75rem;
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
  line-height: 1.4;
}

.wcard-features {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .workspace-grid { grid-template-columns: 1fr !important; }
}
</style>
