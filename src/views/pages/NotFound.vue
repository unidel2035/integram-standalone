<template>
  <div class="not-found">
    <div class="not-found-content">
      <div class="not-found-code">404</div>
      <h1>Страница не найдена</h1>
      <p>Запрашиваемая страница не существует или была перемещена.</p>
      <router-link to="/" class="not-found-link">
        <i class="pi pi-arrow-left"></i> На главную
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  text-align: center;
}
.not-found-code {
  font-size: 6rem;
  font-weight: 800;
  color: var(--p-primary-color);
  line-height: 1;
  opacity: 0.3;
}
.not-found h1 {
  margin: 0.5rem 0;
  color: var(--p-text-color);
}
.not-found p {
  color: var(--p-text-muted-color);
  margin-bottom: 1.5rem;
}
.not-found-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--p-primary-color);
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.2s;
}
.not-found-link:hover { opacity: 0.85; }
</style>
