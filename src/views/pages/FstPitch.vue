<template>
  <FstPageLayout>
    <template #header>
      <div style="display:flex;align-items:center;gap:12px">
        <i class="pi pi-building" style="color:#42a5f5;font-size:18px"></i>
        <span style="font-weight:600">ai2fund · <b style="color:#42a5f5">VentureOS</b></span>
        <Tag value="Seed Round 2026" severity="info" style="font-size:11px" />
        <Tag value="30M ₽" style="background:#42a5f5;color:#fff;font-size:11px" />
      </div>
      <div style="display:flex;gap:8px">
        <Button icon="pi pi-share-alt" label="Поделиться" size="small" severity="secondary" @click="share" />
        <Button icon="pi pi-envelope" label="Связаться" size="small" severity="success" @click="showContact = true" />
      </div>
    </template>

    <div class="pitch-wrap">

      <!-- ═══ HERO ═══ -->
      <div class="pitch-hero">
        <div class="pitch-hero-badge">Инвестиционное предложение · Seed · Март 2026</div>
        <h1 class="pitch-hero-title">
          <span style="color:#42a5f5">ai2fund</span> — VentureOS
        </h1>
        <p class="pitch-hero-sub">
          AI-платформа полного цикла управления венчурным фондом.<br>
          От заявки до выхода — всё автоматизировано.
        </p>
        <div class="pitch-kpi-row">
          <div class="pitch-kpi" v-for="k in heroKpis" :key="k.label">
            <div class="pitch-kpi-val" :style="{ color: k.color }">{{ k.val }}</div>
            <div class="pitch-kpi-label">{{ k.label }}</div>
          </div>
        </div>
        <div class="pitch-hero-cta">
          <Button icon="pi pi-play" label="Открыть демо" size="large" @click="openDemo" />
          <Button icon="pi pi-file-pdf" label="Term Sheet" size="large" severity="secondary" @click="showTerm = true" />
        </div>
      </div>

      <!-- ═══ PROBLEM / SOLUTION ═══ -->
      <div class="pitch-section">
        <div class="pitch-section-title"><i class="pi pi-exclamation-circle" style="color:#ef5350"></i> Проблема</div>
        <div class="pitch-two-col">
          <div class="pitch-problem-card" v-for="p in problems" :key="p.text">
            <i :class="p.icon" :style="{ color: p.color, fontSize:'24px' }"></i>
            <div>
              <div class="pitch-problem-title">{{ p.title }}</div>
              <div class="pitch-problem-text">{{ p.text }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="pitch-section">
        <div class="pitch-section-title"><i class="pi pi-check-circle" style="color:#66bb6a"></i> Решение — VentureOS</div>
        <div class="pitch-solution-grid">
          <div class="pitch-module" v-for="m in modules" :key="m.name">
            <div class="pitch-module-icon" :style="{ background: m.bg }">
              <i :class="m.icon" style="color:#fff;font-size:20px"></i>
            </div>
            <div class="pitch-module-name">{{ m.name }}</div>
            <div class="pitch-module-desc">{{ m.desc }}</div>
          </div>
        </div>
      </div>

      <!-- ═══ TRACTION / DEMO ═══ -->
      <div class="pitch-section pitch-section-dark">
        <div class="pitch-section-title" style="color:#fff"><i class="pi pi-bolt" style="color:#ffa726"></i> Traction & Demo</div>
        <div class="pitch-traction-row">
          <div class="pitch-traction-item" v-for="t in traction" :key="t.label">
            <div class="pitch-traction-val" :style="{ color: t.color }">{{ t.val }}</div>
            <div class="pitch-traction-label">{{ t.label }}</div>
          </div>
        </div>
        <div class="pitch-demo-link" @click="openDemo">
          <i class="pi pi-external-link"></i>
          <span>ai2fund.ru — живой демо-стенд</span>
        </div>
      </div>

      <!-- ═══ MARKET ═══ -->
      <div class="pitch-section">
        <div class="pitch-section-title"><i class="pi pi-chart-pie" style="color:#7e57c2"></i> Рынок</div>
        <div class="pitch-market-grid">
          <div class="pitch-market-box" v-for="m in market" :key="m.label">
            <div class="pitch-market-val" :style="{ color: m.color }">{{ m.val }}</div>
            <div class="pitch-market-label">{{ m.label }}</div>
            <div class="pitch-market-note">{{ m.note }}</div>
          </div>
        </div>
        <div class="pitch-competitors">
          <div class="pitch-comp-title">Конкурентная карта</div>
          <table class="pitch-comp-table">
            <thead>
              <tr>
                <th>Игрок</th>
                <th>AI-ИК</th>
                <th>Digital Twin</th>
                <th>Доступность в РФ</th>
                <th>Цена</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in competitors" :key="c.name" :class="{ 'pitch-comp-us': c.us }">
                <td><b>{{ c.name }}</b></td>
                <td><i :class="c.ai ? 'pi pi-check' : 'pi pi-times'" :style="{ color: c.ai ? '#66bb6a' : '#ef5350' }"></i></td>
                <td><i :class="c.twin ? 'pi pi-check' : 'pi pi-times'" :style="{ color: c.twin ? '#66bb6a' : '#ef5350' }"></i></td>
                <td>{{ c.avail }}</td>
                <td>{{ c.price }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ═══ FINANCIALS ═══ -->
      <div class="pitch-section">
        <div class="pitch-section-title"><i class="pi pi-chart-line" style="color:#66bb6a"></i> Финансовая модель</div>
        <div class="pitch-fin-grid">
          <div class="pitch-fin-kpi" v-for="f in finKpis" :key="f.label">
            <div class="pitch-fin-val" :style="{ color: f.color }">{{ f.val }}</div>
            <div class="pitch-fin-label">{{ f.label }}</div>
          </div>
        </div>
        <div class="pitch-cashflow">
          <div class="pitch-cf-title">Денежные потоки, млн ₽</div>
          <div class="pitch-cf-bars">
            <div v-for="(y, i) in cashflow" :key="y.year" class="pitch-cf-bar-wrap">
              <div class="pitch-cf-year">{{ y.year }}</div>
              <div class="pitch-cf-bar-container">
                <div class="pitch-cf-bar"
                  :style="{
                    height: Math.abs(y.val) * 2 + 'px',
                    background: y.val >= 0 ? '#66bb6a' : '#ef5350',
                    marginTop: y.val >= 0 ? (230 - Math.abs(y.val)*2) + 'px' : '0',
                    marginBottom: y.val < 0 ? (230 - Math.abs(y.val)*2) + 'px' : '0'
                  }">
                </div>
              </div>
              <div class="pitch-cf-val" :style="{ color: y.val >= 0 ? '#66bb6a' : '#ef5350' }">
                {{ y.val > 0 ? '+' : '' }}{{ y.val }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ IC RESULTS ═══ -->
      <div class="pitch-section pitch-section-dark">
        <div class="pitch-section-title" style="color:#fff">
          <i class="pi pi-users" style="color:#42a5f5"></i> AI-инвесткомитет: результат голосования
        </div>
        <div class="pitch-ic-subtitle">Платформа оценила сама себя. 6 AI-агентов проголосовали 09.03.2026</div>
        <div class="pitch-ic-verdict">
          <div class="pitch-ic-verdict-badge">✅ ОДОБРИТЬ С УСЛОВИЯМИ</div>
          <div class="pitch-ic-votes">
            <span class="v-yes">3 за</span> · <span class="v-work">2 доработка</span> · <span class="v-no">1 против</span>
          </div>
        </div>
        <div class="pitch-agents">
          <div class="pitch-agent" v-for="a in icAgents" :key="a.name">
            <div class="pitch-agent-emoji">{{ a.emoji }}</div>
            <div class="pitch-agent-name">{{ a.name }}</div>
            <div class="pitch-agent-vote" :style="{ color: a.voteColor }">{{ a.vote }}</div>
            <div class="pitch-agent-note">{{ a.note }}</div>
          </div>
        </div>
      </div>

      <!-- ═══ TERM SHEET ═══ -->
      <div class="pitch-section">
        <div class="pitch-section-title"><i class="pi pi-file-edit" style="color:#ffa726"></i> Term Sheet (краткое)</div>
        <div class="pitch-term-grid">
          <div class="pitch-term-item" v-for="t in termSheet" :key="t.label">
            <div class="pitch-term-label">{{ t.label }}</div>
            <div class="pitch-term-val">{{ t.val }}</div>
          </div>
        </div>
        <div class="pitch-tranches">
          <div class="pitch-tranche" v-for="(tr, i) in tranches" :key="i">
            <div class="pitch-tranche-num">Транш {{ i+1 }}</div>
            <div class="pitch-tranche-amount">{{ tr.amount }}</div>
            <div class="pitch-tranche-kpi">{{ tr.kpi }}</div>
            <div class="pitch-tranche-date">{{ tr.date }}</div>
          </div>
        </div>
      </div>

      <!-- ═══ TEAM ═══ -->
      <div class="pitch-section">
        <div class="pitch-section-title"><i class="pi pi-users" style="color:#42a5f5"></i> Команда</div>
        <div class="pitch-team-grid">
          <div class="pitch-team-member" v-for="m in team" :key="m.name">
            <div class="pitch-team-avatar">{{ m.emoji }}</div>
            <div class="pitch-team-name">{{ m.name }}</div>
            <div class="pitch-team-role">{{ m.role }}</div>
            <div class="pitch-team-note">{{ m.note }}</div>
          </div>
        </div>
      </div>

      <!-- ═══ SOVEREIGNTY ═══ -->
      <div class="pitch-section">
        <div class="pitch-section-title"><i class="pi pi-shield" style="color:#ffa726"></i> Суверенность 7.5/10</div>
        <div class="pitch-sov-grid">
          <div class="pitch-sov-item" v-for="s in sovereignty" :key="s.label">
            <div class="pitch-sov-label">{{ s.label }}</div>
            <ProgressBar :value="s.val * 10" :showValue="false"
              :style="{ height:'6px', '--p-progressbar-value-background': s.color }" />
            <div class="pitch-sov-val" :style="{ color: s.color }">{{ s.val }}/10</div>
          </div>
        </div>
      </div>

      <!-- ═══ CTA ═══ -->
      <div class="pitch-cta-section">
        <h2 class="pitch-cta-title">Готовы обсудить условия?</h2>
        <p class="pitch-cta-sub">Запрашивается <b>30M ₽</b> за <b>15% equity</b>. Pre-money 170M ₽. Seed раунд, март 2026.</p>
        <div class="pitch-cta-btns">
          <Button icon="pi pi-envelope" label="Написать основателю" size="large" @click="showContact = true" />
          <Button icon="pi pi-chart-bar" label="Открыть ИК в системе" size="large" severity="secondary" @click="openIC" />
          <Button icon="pi pi-external-link" label="ai2fund.ru" size="large" severity="secondary" @click="openDemo" />
        </div>
      </div>

    </div>

    <!-- Contact Dialog -->
    <Dialog v-model:visible="showContact" header="Связаться" :style="{ width: '420px' }" modal>
      <div style="display:flex;flex-direction:column;gap:12px;padding:8px 0">
        <div><b>Telegram:</b> <a href="https://t.me/ai2fund" target="_blank">@ai2fund</a></div>
        <div><b>Email:</b> invest@ai2fund.ru</div>
        <div><b>Demo:</b> <a href="https://ai2fund.ru" target="_blank">ai2fund.ru</a></div>
        <div><b>ИК-протокол (ID 7466):</b> в системе /fst-committee</div>
      </div>
    </Dialog>

    <!-- Term Sheet Dialog -->
    <Dialog v-model:visible="showTerm" header="Term Sheet — ai2fund Seed 2026" :style="{ width: '600px' }" modal>
      <div class="pitch-term-full">
        <div v-for="t in termFull" :key="t.label" class="pitch-term-full-row">
          <span class="ptf-label">{{ t.label }}</span>
          <span class="ptf-val">{{ t.val }}</span>
        </div>
      </div>
    </Dialog>

  </FstPageLayout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

const router = useRouter()
const showContact = ref(false)
const showTerm = ref(false)

const heroKpis = [
  { val: '30M ₽', label: 'Запрашивается', color: '#42a5f5' },
  { val: '15%', label: 'Equity', color: '#ffa726' },
  { val: '170M ₽', label: 'Pre-money', color: '#66bb6a' },
  { val: '85%', label: 'IRR прогноз', color: '#ab47bc' },
  { val: '8x', label: 'MOIC цель', color: '#ef5350' },
  { val: 'TRL 7', label: 'Зрелость', color: '#42a5f5' },
]

const problems = [
  { icon: 'pi pi-clock', color: '#ef5350', title: 'Потеря времени', text: 'Управляющие тратят 70% времени на рутину: Excel, Telegram, ручные отчёты LP, подготовка к ИК.' },
  { icon: 'pi pi-eye-slash', color: '#ffa726', title: 'Слепые зоны', text: 'Нет единого взгляда на портфель в реальном времени — риски обнаруживаются поздно.' },
  { icon: 'pi pi-ban', color: '#7e57c2', title: 'Нет AI-инструментов', text: 'Конкуренты (Allvue, iLEVEL) недоступны в РФ. Отечественного аналога с AI — нет.' },
  { icon: 'pi pi-chart-line', color: '#ef5350', title: 'Потери на выходе', text: 'Без цифрового двойника и финмоделирования фонды недооценивают портфель на 20-40%.' },
]

const modules = [
  { icon: 'pi pi-users', bg: '#42a5f5', name: 'AI-инвесткомитет', desc: '6 агентов: технолог, финансист, суверенность, риск, портфель, скептик. VETO и ревизия.' },
  { icon: 'pi pi-filter', bg: '#66bb6a', name: 'Deal Flow', desc: 'AI-сорсинг, автоматический скоринг заявок, воронка, форма подачи.' },
  { icon: 'pi pi-chart-scatter', bg: '#7e57c2', name: 'Digital Twin', desc: 'Цифровой двойник фонда и каждой компании: NAV, IRR, tick-engine симуляция.' },
  { icon: 'pi pi-brain', bg: '#ffa726', name: 'KAG', desc: 'Гибридная база знаний: 1100+ концептов, vector+graph поиск, онтология.' },
  { icon: 'pi pi-link', bg: '#26c6da', name: 'MCP-протокол', desc: '60+ инструментов для AI-агентов: интеграция с БД Integram, аналитика, схемы.' },
  { icon: 'pi pi-shield', bg: '#ef5350', name: 'LP-прозрачность', desc: 'Santiago Principles, ILPA отчётность, публичная витрина, ESG-скоринг.' },
]

const traction = [
  { val: 'Live', label: 'Продукт', color: '#66bb6a' },
  { val: '14+', label: 'Модулей', color: '#42a5f5' },
  { val: '60+', label: 'MCP-инструментов', color: '#ffa726' },
  { val: '1100+', label: 'KAG концептов', color: '#ab47bc' },
  { val: '3', label: 'Переговора с фондами', color: '#66bb6a' },
  { val: 'ИК', label: 'Оценил сам себя', color: '#ef5350' },
]

const market = [
  { val: '45 млрд ₽', label: 'TAM', note: 'Рынок VC-инфраструктуры РФ к 2030', color: '#42a5f5' },
  { val: '6 млрд ₽', label: 'SAM', note: '200+ фондов × LTV ~30M', color: '#ffa726' },
  { val: '1.2 млрд ₽', label: 'SOM Y3', note: 'Реалистичный max ARR при 35 клиентах', color: '#66bb6a' },
  { val: '35%', label: 'CAGR', note: 'Рост сегмента AI-автоматизации фондов', color: '#ab47bc' },
]

const competitors = [
  { name: 'ai2fund (мы)', ai: true, twin: true, avail: '✅ РФ', price: '150-500K/мес', us: true },
  { name: '1С:Инвестиции', ai: false, twin: false, avail: '✅ РФ', price: 'от 200K/мес' },
  { name: 'Allvue Systems', ai: false, twin: false, avail: '❌ недоступен', price: '$2000+/мес' },
  { name: 'iLEVEL (SS&C)', ai: false, twin: false, avail: '❌ недоступен', price: '$3000+/мес' },
  { name: 'Excel + Telegram', ai: false, twin: false, avail: '✅ РФ', price: 'бесплатно' },
]

const cashflow = [
  { year: '2026', val: -18 },
  { year: '2027', val: -5 },
  { year: '2028', val: 12 },
  { year: '2029', val: 32 },
  { year: '2030', val: 68 },
  { year: '2031', val: 115 },
]

const finKpis = [
  { val: '85%', label: 'IRR прогноз', color: '#66bb6a' },
  { val: '8x', label: 'MOIC цель', color: '#42a5f5' },
  { val: '2.8 лет', label: 'DPP', color: '#ffa726' },
  { val: '124M ₽', label: 'NPV (ставка 25%)', color: '#ab47bc' },
  { val: '300K/мес', label: 'Burn rate', color: '#ef5350' },
  { val: '10 мес', label: 'Runway без инвестиций', color: '#78909c' },
]

const icAgents = [
  { emoji: '🔬', name: 'Технический', vote: 'С УСЛОВИЯМИ', voteColor: '#ffa726', note: 'TRL 7 подтверждён, нужен план IP и пилот' },
  { emoji: '📊', name: 'Финансовый', vote: 'ОТКЛОНИТЬ', voteColor: '#ef5350', note: 'Pre-money завышена, пересмотреть до 80-120M' },
  { emoji: '🛡️', name: 'Суверенность', vote: 'НА ДОРАБОТКУ', voteColor: '#ff7043', note: 'DeepSeek/Anthropic → YandexGPT/GigaChat' },
  { emoji: '⚠️', name: 'Риск-менеджер', vote: 'С УСЛОВИЯМИ', voteColor: '#ffa726', note: '8 рисков, критичный: нет юрлица, vesting 4 года' },
  { emoji: '🎯', name: 'Стратег', vote: 'С УСЛОВИЯМИ', voteColor: '#ffa726', note: 'Синергия с портфелем, новая AI/Tech вертикаль' },
  { emoji: '🔍', name: 'Критический', vote: 'НА ДОРАБОТКУ', voteColor: '#ff7043', note: 'TAM завышен, нет валидации спроса, exit 1.6M нереален' },
]

const termSheet = [
  { label: 'Сумма', val: '30 000 000 ₽' },
  { label: 'Тип', val: 'Equity' },
  { label: 'Доля', val: '15% (post-money)' },
  { label: 'Pre-money', val: '170 000 000 ₽' },
  { label: 'Post-money', val: '200 000 000 ₽' },
  { label: 'Lock-up', val: '24 месяца' },
  { label: 'Liq. preference', val: '1x non-participating' },
  { label: 'ESOP pool', val: '10%' },
]

const termFull = [
  ...termSheet,
  { label: 'Pro-rata права', val: 'На Round A' },
  { label: 'Board seat', val: 'Observer' },
  { label: 'Anti-dilution', val: 'Broad-based weighted average' },
  { label: 'Tag-along', val: 'Да' },
  { label: 'Drag-along', val: 'Да' },
  { label: 'Information rights', val: 'Ежеквартальные отчёты' },
]

const tranches = [
  { amount: '15M ₽', kpi: 'Регистрация ООО + подписание SHA', date: 'май 2026' },
  { amount: '10M ₽', kpi: '3 платящих клиента, MRR 400K+', date: 'сен 2026' },
  { amount: '5M ₽', kpi: 'ARR 10M+ (подтверждён аудитором)', date: 'мар 2027' },
]

const team = [
  { emoji: '👨‍💻', name: 'Основатель', role: 'CEO & CTO', note: '10+ лет разработки, опыт управления фондом, архитектор платформы' },
  { emoji: '🤖', name: 'AI/ML инженер', role: 'Lead AI', note: 'KAG, агентные системы, LLM-роутинг' },
  { emoji: '🎨', name: 'Full-stack #1', role: 'Frontend', note: 'Vue 3, PrimeVue, финмодели HyperFormula' },
  { emoji: '⚙️', name: 'Full-stack #2', role: 'Backend', note: 'Node.js ESM, MCP-протокол, Integram' },
  { emoji: '📋', name: 'Продукт', role: 'CPO', note: 'Венчурная экспертиза, customer development' },
]

const sovereignty = [
  { label: 'Хостинг данных', val: 9, color: '#66bb6a' },
  { label: 'База данных (Integram)', val: 9, color: '#66bb6a' },
  { label: 'Команда (граждане РФ)', val: 10, color: '#66bb6a' },
  { label: 'AI-модели', val: 5, color: '#ffa726' },
  { label: 'Репозиторий кода', val: 4, color: '#ef5350' },
  { label: 'Сертификация ФСТЭК', val: 1, color: '#ef5350' },
]

function openDemo() { window.open('https://ai2fund.ru', '_blank') }
function openIC() { router.push('/fst-committee') }
function share() { navigator.clipboard?.writeText(window.location.href) }
</script>

<style scoped>
.pitch-wrap { max-width: 1200px; margin: 0 auto; padding: 0 0 60px 0; }

/* HERO */
.pitch-hero {
  background: linear-gradient(135deg, var(--p-surface-card) 0%, color-mix(in srgb, #42a5f5 8%, var(--p-surface-card)) 100%);
  border-radius: 16px; border: 1px solid var(--p-content-border-color);
  padding: 48px 40px; margin-bottom: 32px; text-align: center;
}
.pitch-hero-badge {
  display: inline-block; background: color-mix(in srgb, #42a5f5 15%, transparent);
  color: #42a5f5; border: 1px solid color-mix(in srgb, #42a5f5 30%, transparent);
  border-radius: 20px; padding: 4px 16px; font-size: 12px; font-weight: 600;
  letter-spacing: 0.5px; margin-bottom: 20px;
}
.pitch-hero-title {
  font-size: 48px; font-weight: 800; margin: 0 0 12px 0;
  color: var(--p-text-color); line-height: 1.1;
}
.pitch-hero-sub {
  font-size: 18px; color: var(--p-text-muted-color); margin: 0 0 32px 0; line-height: 1.6;
}
.pitch-kpi-row {
  display: flex; justify-content: center; gap: 32px; flex-wrap: wrap; margin-bottom: 32px;
}
.pitch-kpi { text-align: center; }
.pitch-kpi-val { font-size: 28px; font-weight: 800; line-height: 1; }
.pitch-kpi-label { font-size: 12px; color: var(--p-text-muted-color); margin-top: 4px; }
.pitch-hero-cta { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }

/* SECTIONS */
.pitch-section {
  background: var(--p-surface-card); border-radius: 12px;
  border: 1px solid var(--p-content-border-color);
  padding: 32px; margin-bottom: 20px;
}
.pitch-section-dark {
  background: color-mix(in srgb, #42a5f5 8%, var(--p-surface-card));
  border-color: color-mix(in srgb, #42a5f5 20%, transparent);
}
.pitch-section-title {
  font-size: 18px; font-weight: 700; margin-bottom: 24px;
  display: flex; align-items: center; gap: 8px; color: var(--p-text-color);
}

/* PROBLEM */
.pitch-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.pitch-problem-card {
  display: flex; gap: 16px; align-items: flex-start;
  padding: 16px; background: var(--p-surface-ground); border-radius: 8px;
}
.pitch-problem-title { font-weight: 600; margin-bottom: 4px; color: var(--p-text-color); }
.pitch-problem-text { font-size: 13px; color: var(--p-text-muted-color); line-height: 1.5; }

/* MODULES */
.pitch-solution-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.pitch-module { text-align: center; padding: 20px 16px; }
.pitch-module-icon {
  width: 52px; height: 52px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;
}
.pitch-module-name { font-weight: 600; margin-bottom: 6px; color: var(--p-text-color); }
.pitch-module-desc { font-size: 12px; color: var(--p-text-muted-color); line-height: 1.4; }

/* TRACTION */
.pitch-traction-row { display: flex; justify-content: space-around; flex-wrap: wrap; gap: 24px; margin-bottom: 20px; }
.pitch-traction-item { text-align: center; }
.pitch-traction-val { font-size: 32px; font-weight: 800; }
.pitch-traction-label { font-size: 12px; color: var(--p-text-muted-color); margin-top: 4px; }
.pitch-demo-link {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  color: #42a5f5; cursor: pointer; font-weight: 600; font-size: 15px;
  padding: 12px; border-radius: 8px;
  background: color-mix(in srgb, #42a5f5 10%, transparent);
  border: 1px solid color-mix(in srgb, #42a5f5 25%, transparent);
  transition: background 0.2s;
}
.pitch-demo-link:hover { background: color-mix(in srgb, #42a5f5 18%, transparent); }

/* MARKET */
.pitch-market-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.pitch-market-box {
  text-align: center; padding: 20px 12px;
  background: var(--p-surface-ground); border-radius: 8px;
}
.pitch-market-val { font-size: 24px; font-weight: 800; }
.pitch-market-label { font-size: 12px; font-weight: 700; color: var(--p-text-color); margin: 4px 0; }
.pitch-market-note { font-size: 11px; color: var(--p-text-muted-color); line-height: 1.3; }
.pitch-comp-title { font-weight: 600; margin-bottom: 12px; color: var(--p-text-color); }
.pitch-comp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pitch-comp-table th {
  text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 600;
  color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-content-border-color);
}
.pitch-comp-table td { padding: 10px 12px; border-bottom: 1px solid var(--p-content-border-color); }
.pitch-comp-us { background: color-mix(in srgb, #42a5f5 8%, transparent); }

/* FINANCIALS */
.pitch-fin-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 28px; }
.pitch-fin-kpi { text-align: center; padding: 16px 8px; background: var(--p-surface-ground); border-radius: 8px; }
.pitch-fin-val { font-size: 20px; font-weight: 800; }
.pitch-fin-label { font-size: 11px; color: var(--p-text-muted-color); margin-top: 4px; line-height: 1.3; }
.pitch-cashflow {}
.pitch-cf-title { font-size: 13px; color: var(--p-text-muted-color); margin-bottom: 12px; }
.pitch-cf-bars { display: flex; justify-content: space-around; align-items: flex-end; height: 260px; gap: 8px; }
.pitch-cf-bar-wrap { display: flex; flex-direction: column; align-items: center; flex: 1; }
.pitch-cf-year { font-size: 12px; color: var(--p-text-muted-color); margin-bottom: 4px; }
.pitch-cf-bar-container { flex: 1; display: flex; align-items: center; width: 100%; }
.pitch-cf-bar { width: 100%; border-radius: 4px; min-height: 8px; transition: height 0.3s; }
.pitch-cf-val { font-size: 12px; font-weight: 700; margin-top: 4px; }

/* IC */
.pitch-ic-subtitle { color: var(--p-text-muted-color); font-size: 13px; margin-bottom: 20px; }
.pitch-ic-verdict { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.pitch-ic-verdict-badge {
  background: color-mix(in srgb, #ffa726 15%, transparent);
  color: #ffa726; border: 1px solid color-mix(in srgb, #ffa726 30%, transparent);
  border-radius: 8px; padding: 8px 20px; font-weight: 700; font-size: 16px;
}
.pitch-ic-votes { font-size: 14px; }
.v-yes { color: #66bb6a; font-weight: 700; }
.v-work { color: #ffa726; font-weight: 700; }
.v-no { color: #ef5350; font-weight: 700; }
.pitch-agents { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.pitch-agent {
  background: var(--p-surface-card); border-radius: 10px; padding: 16px 12px; text-align: center;
  border: 1px solid var(--p-content-border-color);
}
.pitch-agent-emoji { font-size: 28px; margin-bottom: 6px; }
.pitch-agent-name { font-size: 12px; font-weight: 600; color: var(--p-text-color); margin-bottom: 4px; }
.pitch-agent-vote { font-size: 11px; font-weight: 700; margin-bottom: 6px; }
.pitch-agent-note { font-size: 10px; color: var(--p-text-muted-color); line-height: 1.4; }

/* TERM SHEET */
.pitch-term-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.pitch-term-item { padding: 14px; background: var(--p-surface-ground); border-radius: 8px; }
.pitch-term-label { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 4px; }
.pitch-term-val { font-size: 15px; font-weight: 700; color: var(--p-text-color); }
.pitch-tranches { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.pitch-tranche {
  padding: 20px; border-radius: 10px; text-align: center;
  background: color-mix(in srgb, #42a5f5 8%, var(--p-surface-ground));
  border: 1px solid color-mix(in srgb, #42a5f5 20%, transparent);
}
.pitch-tranche-num { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 6px; }
.pitch-tranche-amount { font-size: 26px; font-weight: 800; color: #42a5f5; margin-bottom: 8px; }
.pitch-tranche-kpi { font-size: 12px; color: var(--p-text-color); margin-bottom: 6px; line-height: 1.4; }
.pitch-tranche-date { font-size: 11px; color: var(--p-text-muted-color); }

/* TEAM */
.pitch-team-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
.pitch-team-member { text-align: center; padding: 20px 12px; background: var(--p-surface-ground); border-radius: 10px; }
.pitch-team-avatar { font-size: 40px; margin-bottom: 10px; }
.pitch-team-name { font-weight: 700; margin-bottom: 2px; color: var(--p-text-color); }
.pitch-team-role { font-size: 12px; color: #42a5f5; margin-bottom: 6px; font-weight: 600; }
.pitch-team-note { font-size: 11px; color: var(--p-text-muted-color); line-height: 1.4; }

/* SOVEREIGNTY */
.pitch-sov-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.pitch-sov-item { display: flex; align-items: center; gap: 12px; }
.pitch-sov-label { width: 200px; font-size: 13px; color: var(--p-text-color); flex-shrink: 0; }
.pitch-sov-val { width: 40px; font-size: 12px; font-weight: 700; text-align: right; }

/* CTA */
.pitch-cta-section {
  background: linear-gradient(135deg, color-mix(in srgb, #42a5f5 12%, var(--p-surface-card)), var(--p-surface-card));
  border-radius: 16px; border: 1px solid color-mix(in srgb, #42a5f5 25%, transparent);
  padding: 48px; text-align: center; margin-bottom: 0;
}
.pitch-cta-title { font-size: 32px; font-weight: 800; margin: 0 0 12px 0; color: var(--p-text-color); }
.pitch-cta-sub { font-size: 16px; color: var(--p-text-muted-color); margin: 0 0 28px 0; }
.pitch-cta-btns { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }

/* Term dialog */
.pitch-term-full { display: flex; flex-direction: column; gap: 8px; }
.pitch-term-full-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--p-content-border-color); }
.ptf-label { color: var(--p-text-muted-color); font-size: 13px; }
.ptf-val { font-weight: 600; font-size: 13px; }

@media (max-width: 768px) {
  .pitch-hero-title { font-size: 28px; }
  .pitch-kpi-row { gap: 16px; }
  .pitch-solution-grid, .pitch-agents { grid-template-columns: repeat(2, 1fr); }
  .pitch-market-grid, .pitch-fin-grid { grid-template-columns: repeat(2, 1fr); }
  .pitch-team-grid { grid-template-columns: repeat(2, 1fr); }
  .pitch-two-col, .pitch-sov-grid { grid-template-columns: 1fr; }
  .pitch-term-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
