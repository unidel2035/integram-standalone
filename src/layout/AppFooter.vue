<template>
    <div class="layout-footer">
        <span class="footer-copy">&copy; 2026 ФСТ НТИ &middot; <a href="https://ai2fund.ru" target="_blank" rel="noopener noreferrer">VentureOS Platform</a></span>
        <span class="footer-sep">&middot;</span>
        <nav class="footer-links">
            <router-link to="/legal/terms-of-service">Условия</router-link>
            <router-link to="/legal/privacy-policy">Конфиденциальность</router-link>
            <router-link to="/legal/cookie-policy">Cookies</router-link>
        </nav>
    </div>
</template>

<style scoped>
.footer-copy {
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
  white-space: nowrap;
}

.footer-copy a {
  color: var(--p-text-muted-color);
  text-decoration: none;
  transition: color 0.15s;
}

.footer-copy a:hover {
  color: var(--p-primary-color);
}

.footer-sep {
  color: var(--p-text-muted-color);
  opacity: 0.4;
  font-size: 0.75rem;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.footer-links a {
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
  text-decoration: none;
  transition: color 0.15s;
  white-space: nowrap;
}

.footer-links a:hover {
  color: var(--p-primary-color);
}
</style>
