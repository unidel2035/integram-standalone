<template>
  <div class="fst-login-wrap">
    <div class="fst-login-card">
      <div class="fst-login-logo">
        <span class="fst-logo-icon">🏛️</span>
        <div>
          <div class="fst-logo-title">ФСТ НТИ</div>
          <div class="fst-logo-sub">Платформа AI-инвесткомитета</div>
        </div>
      </div>

      <form @submit.prevent="doLogin" class="fst-login-form">
        <div class="fst-field">
          <label>Логин</label>
          <InputText v-model="form.login" placeholder="Введите логин" :disabled="loading" autofocus />
        </div>
        <div class="fst-field">
          <label>Пароль</label>
          <Password v-model="form.password" placeholder="Введите пароль" :feedback="false"
            :disabled="loading" toggleMask />
        </div>

        <Message v-if="errorMsg" severity="error" :closable="false">{{ errorMsg }}</Message>

        <Button type="submit" label="Войти" icon="pi pi-sign-in"
          :loading="loading" class="fst-login-btn" />
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'

const router = useRouter()
const route  = useRoute()
const auth   = useAuthStore()

const form = ref({ login: '', password: '' })
const loading  = ref(false)
const errorMsg = ref('')

async function doLogin() {
  errorMsg.value = ''
  if (!form.value.login || !form.value.password) {
    errorMsg.value = 'Введите логин и пароль'
    return
  }
  loading.value = true
  try {
    await auth.login(form.value.login, form.value.password, 'api.ai2o.ru', 'fst')
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (e) {
    errorMsg.value = e.message || 'Неверный логин или пароль'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.fst-login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f1724 0%, #1a2744 100%);
}
.fst-login-card {
  background: var(--surface-card, #1e293b);
  border: 1px solid var(--surface-border, #334155);
  border-radius: 16px;
  padding: 2.5rem 2rem;
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.fst-login-logo {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.fst-logo-icon { font-size: 2.5rem; }
.fst-logo-title { font-size: 1.4rem; font-weight: 700; color: var(--text-color); }
.fst-logo-sub { font-size: 0.8rem; color: var(--text-color-secondary); }
.fst-login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.fst-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.fst-field label {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}
.fst-field :deep(.p-inputtext),
.fst-field :deep(.p-password input) {
  width: 100%;
}
.fst-field :deep(.p-password) { width: 100%; }
.fst-login-btn { width: 100%; margin-top: 0.5rem; }

/* ── Mobile ── */
@media (max-width: 480px) {
  .fst-login-wrap { padding: 1rem; }
  .fst-login-card {
    width: 100%;
    max-width: 100%;
    padding: 2rem 1.5rem;
    border-radius: 12px;
  }
  .fst-logo-icon { font-size: 2rem; }
  .fst-logo-title { font-size: 1.2rem; }
}
</style>
