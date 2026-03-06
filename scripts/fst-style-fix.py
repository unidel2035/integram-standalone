#!/usr/bin/env python3
"""
FST Style Fix — единообразие, крупный шрифт, поддержка light/dark темы
"""
import re, os

SRC = '/home/hive/found-repo/src'

# ── 1. Создать shared CSS ─────────────────────────────────────────────────────
FST_CSS = '''\
/* ═══════════════════════════════════════════════════════════════
   FST Design System — единые стили для всех страниц ФСТ НТИ
   Адаптация: светлая / тёмная тема через var(--p-*)
   ═══════════════════════════════════════════════════════════════ */

/* ── Glass-морфизм переменные (меняются при смене темы) ── */
:root {
  --fst-glass-xs:        rgba(0, 0, 0, 0.03);
  --fst-glass-sm:        rgba(0, 0, 0, 0.05);
  --fst-glass-md:        rgba(0, 0, 0, 0.08);
  --fst-glass-lg:        rgba(0, 0, 0, 0.14);
  --fst-glass-xl:        rgba(0, 0, 0, 0.20);
  --fst-border-subtle:   rgba(0, 0, 0, 0.08);
  --fst-border-glass:    rgba(0, 0, 0, 0.12);
  --fst-separator:       rgba(0, 0, 0, 0.12);
  --fst-dim-text:        rgba(0, 0, 0, 0.45);
  --fst-nav-backdrop:    color-mix(in srgb, var(--p-surface-ground) 90%, transparent);
  --fst-brand:           #ffa726;
  --fst-brand-glow:      rgba(255, 167, 38, 0.25);
}

.p-dark {
  --fst-glass-xs:        rgba(255, 255, 255, 0.04);
  --fst-glass-sm:        rgba(255, 255, 255, 0.06);
  --fst-glass-md:        rgba(255, 255, 255, 0.09);
  --fst-glass-lg:        rgba(255, 255, 255, 0.15);
  --fst-glass-xl:        rgba(255, 255, 255, 0.22);
  --fst-border-subtle:   rgba(255, 255, 255, 0.07);
  --fst-border-glass:    rgba(255, 255, 255, 0.12);
  --fst-separator:       rgba(255, 255, 255, 0.10);
  --fst-dim-text:        rgba(255, 255, 255, 0.45);
  --fst-nav-backdrop:    color-mix(in srgb, var(--p-surface-ground) 88%, transparent);
}

/* ── Типографика ── */
/* Заголовок страницы */
.fst-page-h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin: 0;
  color: var(--p-text-color);
  line-height: 1.2;
  letter-spacing: -0.02em;
}
/* Подзаголовок */
.fst-page-sub {
  font-size: 0.9375rem;
  color: var(--p-text-muted-color);
  margin: 0;
  line-height: 1.5;
}
/* Заголовок секции */
.fst-section-h2 {
  font-size: 1.0625rem;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 8px;
}
/* KPI — крупное число */
.fst-kpi-val {
  font-size: 2.125rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
}
/* KPI — подпись */
.fst-kpi-label {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 5px;
  font-weight: 600;
}
/* Мелкий мета-текст */
.fst-meta {
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
}

/* ── Корень страницы ── */
.fst-page-root {
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100vh;
  background: var(--p-surface-ground);
}

/* ── Карточка ── */
.fst-card {
  background: var(--p-content-background);
  border: 1px solid var(--p-surface-border);
  border-radius: 14px;
  padding: 20px;
}

/* ── Кнопки ── */
.fst-btn {
  padding: 9px 18px;
  border-radius: 9px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  transition: opacity .15s, transform .1s;
  white-space: nowrap;
}
.fst-btn:hover { opacity: 0.88; transform: translateY(-1px); }
.fst-btn:active { transform: translateY(0); }
.fst-btn.primary   { background: var(--p-primary-color); color: #fff; }
.fst-btn.secondary { background: var(--p-surface-card); color: var(--p-text-color); border: 1px solid var(--p-surface-border); }
.fst-btn.danger    { background: #ef5350; color: #fff; }
.fst-btn.success   { background: #43a047; color: #fff; }

/* ── Select ── */
.fst-select {
  padding: 8px 11px;
  border-radius: 9px;
  border: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
  color: var(--p-text-color);
  font-size: 0.875rem;
  outline: none;
  transition: border-color .15s;
}
.fst-select:focus { border-color: var(--p-primary-color); }

/* ── Нормализация размеров заголовков в inner-страницах ── */
/* Охватываем распространённые паттерны именования header h1 */
[class*="-header"] h1,
[class*="-hero"] h1 {
  font-size: 1.75rem !important;
  font-weight: 700 !important;
  letter-spacing: -0.02em !important;
}
[class*="-subtitle"],
[class*="-sub"]:not(button):not(span):not(div[class*="-subfund"]):not(div[class*="-subf"]) {
  font-size: 0.9375rem !important;
}
/* KPI значения */
[class*="-kpi-val"],
[class*="-val"]:where(.kpi-val, .gs-val, .nav-val) {
  font-size: 2rem !important;
}
'''

# ── 2. Записать fst.css ────────────────────────────────────────────────────────
css_path = os.path.join(SRC, 'assets/fst.css')
with open(css_path, 'w') as f:
    f.write(FST_CSS)
print(f'✓ Created {css_path}')

# ── 3. Добавить импорт в styles.scss ──────────────────────────────────────────
scss_path = os.path.join(SRC, 'assets/styles.scss')
with open(scss_path, 'r') as f:
    scss = f.read()

if 'fst.css' not in scss:
    scss = scss.replace(
        "@use '@/assets/layout/layout.scss';",
        "@use '@/assets/layout/layout.scss';\n@use '@/assets/fst.css';"
    )
    with open(scss_path, 'w') as f:
        f.write(scss)
    print('✓ Added fst.css import to styles.scss')

# ── 4. Фикс Hub и Landing: хардкод цвета → CSS vars ─────────────────────────
def fix_dark_page(path, root_class):
    with open(path, 'r') as f:
        t = f.read()

    # Фоны
    t = t.replace('background: #03060f;', 'background: var(--p-surface-ground);')
    t = t.replace('background: #05080f;', 'background: var(--p-surface-ground);')
    t = t.replace("background: #03060f,", "background: var(--p-surface-ground),")
    t = t.replace('background: rgba(3, 6, 15, 0.85)',
                  'background: var(--fst-nav-backdrop)')
    t = t.replace("background: rgba(3,6,15,0.85)",
                  "background: var(--fst-nav-backdrop)")

    # Основной текст
    t = re.sub(r'\bcolor: #e2e8f0\b', 'color: var(--p-text-color)', t)
    t = re.sub(r'\bcolor: #f1f5f9\b', 'color: var(--p-text-color)', t)
    t = re.sub(r'\bcolor: #cbd5e1\b', 'color: var(--p-text-color)', t)

    # Приглушённый текст
    t = re.sub(r'\bcolor: #94a3b8\b', 'color: var(--p-text-muted-color)', t)
    t = re.sub(r'\bcolor: #64748b\b', 'color: var(--p-text-muted-color)', t)
    t = re.sub(r'\bcolor: #475569\b', 'color: var(--p-text-muted-color)', t)
    t = re.sub(r'\bcolor: #334155\b', 'color: var(--p-text-muted-color)', t)
    t = re.sub(r'color: rgba\(148,163,184,0\.[89]\)', 'color: var(--p-text-muted-color)', t)
    t = re.sub(r'color: rgba\(148, 163, 184, 0\.[89]\)', 'color: var(--p-text-muted-color)', t)

    # Glass overlays (белые rgba → CSS vars)
    t = re.sub(r'rgba\(255,255,255,0\.0[1-3]\)', 'var(--fst-glass-xs)', t)
    t = re.sub(r'rgba\(255,255,255,0\.0[45]\)', 'var(--fst-glass-xs)', t)
    t = re.sub(r'rgba\(255,255,255,0\.0[67]\)', 'var(--fst-glass-sm)', t)
    t = re.sub(r'rgba\(255,255,255,0\.0[89]\)', 'var(--fst-glass-md)', t)
    t = re.sub(r'rgba\(255,255,255,0\.1[0-3]?\)', 'var(--fst-glass-md)', t)
    t = re.sub(r'rgba\(255,255,255,0\.1[456]?\)', 'var(--fst-glass-lg)', t)
    t = re.sub(r'rgba\(255,255,255,0\.[2-3]\)', 'var(--fst-glass-xl)', t)
    t = re.sub(r'rgba\(255,\s*255,\s*255,\s*0\.0[45]\)', 'var(--fst-glass-xs)', t)
    t = re.sub(r'rgba\(255,\s*255,\s*255,\s*0\.0[67]\)', 'var(--fst-glass-sm)', t)
    t = re.sub(r'rgba\(255,\s*255,\s*255,\s*0\.0[89]\)', 'var(--fst-glass-md)', t)
    t = re.sub(r'rgba\(255,\s*255,\s*255,\s*0\.1[5]?\)', 'var(--fst-glass-lg)', t)
    t = re.sub(r'rgba\(255,\s*255,\s*255,\s*0\.2\)', 'var(--fst-glass-xl)', t)

    # Разделители (белые линии)
    t = re.sub(r'rgba\(255,255,255,0\.1[2-5]\)', 'var(--fst-separator)', t)
    t = re.sub(r'rgba\(255,\s*255,\s*255,\s*0\.1[2-5]\)', 'var(--fst-separator)', t)

    # Dim text
    t = re.sub(r'color:rgba\(255,255,255,0\.4\)', 'color:var(--fst-dim-text)', t)
    t = re.sub(r'color: rgba\(255,255,255,0\.4\)', 'color: var(--fst-dim-text)', t)
    t = re.sub(r'color:rgba\(255,255,255,0\.5\)', 'color:var(--fst-dim-text)', t)
    t = re.sub(r'color: rgba\(255,255,255,0\.5\)', 'color: var(--fst-dim-text)', t)

    # Инлайн style="color:#fff" → var(--p-text-color) только для текстовых элементов
    # (НЕ меняем для иконок / badge-ов где #fff явно нужен на цветном фоне)
    # Только в корне страницы без фона
    # Статичный class="land-section-h2" — убираем инлайн style="color:#fff"
    t = re.sub(
        r'(class="land-section-h2") style="color:#fff"',
        r'\1',
        t
    )

    with open(path, 'w') as f:
        f.write(t)
    print(f'✓ Fixed dark page: {path}')

fix_dark_page(os.path.join(SRC, 'views/pages/FstHub.vue'), 'hub-root')
fix_dark_page(os.path.join(SRC, 'views/pages/FstLanding.vue'), 'land-root')

# ── 5. Нормализация шрифтов в inner-pages ─────────────────────────────────────
# Паттерн: все .xxx-header h1 { font-size: 1.5rem } → 1.75rem
INNER_PAGES = [
    'FstApply.vue', 'FstBenchmark.vue', 'FstCaptable.vue', 'FstCompliance.vue',
    'FstDeal.vue', 'FstDealflow.vue', 'FstDuediligence.vue', 'FstEsg.vue',
    'FstExecution.vue', 'FstExit.vue', 'FstGov.vue', 'FstGrants.vue',
    'FstIlpa.vue', 'FstLegal.vue', 'FstLp.vue', 'FstMemo.vue',
    'FstNatproject.vue', 'FstProtocol.vue', 'FstRegistry.vue',
    'FstSourcing.vue', 'FstSovereignty.vue', 'FstSyndication.vue',
    'FstWaterfall.vue', 'FstCommittee.vue', 'FstDigitalTwin.vue',
    'FstFundTwin.vue', 'FstPortfolio.vue',
]

def normalize_fonts(path):
    with open(path, 'r') as f:
        t = f.read()

    # h1 размеры: 1.5rem → 1.75rem
    t = re.sub(r'(font-size:\s*)1\.5rem(\s*;[^\n]*\n[^\n]*color: var\(--p-text-color\))',
               r'\g<1>1.75rem\2', t)
    # Более простой паттерн для header h1
    t = re.sub(r'(h1\s*\{[^}]*font-size:\s*)1\.5rem', r'\g<1>1.75rem', t)
    # Subtitle 0.85rem → 0.9375rem (нет — слишком агрессивно, делаем 0.9rem)
    t = re.sub(r'((?:subtitle|sub)\s*\{[^}]*font-size:\s*)0\.85rem', r'\g<1>0.9375rem', t)
    t = re.sub(r'((?:subtitle|sub)\s*\{[^}]*font-size:\s*)0\.95rem', r'\g<1>0.9375rem', t)
    # Button font-size 0.83rem → 0.875rem
    t = re.sub(r'(btn[^}]*font-size:\s*)0\.83rem', r'\g<1>0.875rem', t)
    # kpi-val, kpi значения
    t = re.sub(r'((?:kpi[_-]val|kpi-value)[^}]*font-size:\s*)1\.[56]rem', r'\g<1>2rem', t)
    # border-radius унификация: 8px → 10px для карточек, 7px → 8px для select
    t = re.sub(r'(border-radius:\s*)7px', r'\g<1>8px', t)

    with open(path, 'w') as f:
        f.write(t)

pages_dir = os.path.join(SRC, 'views/pages')
fixed = 0
for name in INNER_PAGES:
    p = os.path.join(pages_dir, name)
    if os.path.exists(p):
        normalize_fonts(p)
        fixed += 1
print(f'✓ Normalized fonts in {fixed} inner pages')

print('\n✅ Done! All FST pages updated.')
