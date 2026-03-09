// @ts-check
import { test, expect } from "@playwright/test"

const BASE = "http://173.249.2.184:5174"
const CREDS = { login: "unidel@yandex.ru", password: "Denver2035" }

test.describe("Chat Performance Profiling", () => {
  test.setTimeout(120_000)

  test.beforeEach(async ({ page }) => {
    // Set onboarding completed BEFORE navigating to any page
    await page.goto(BASE + "/login")
    await page.evaluate(() => {
      localStorage.setItem('onboarding_state', JSON.stringify({ onboardingCompleted: true }))
      localStorage.setItem('chat', 'false')
    })
    
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(500)
    
    await page.fill('input[placeholder*="логин"], input[type="text"]', CREDS.login)
    await page.fill('input[placeholder*="пароль"], input[type="password"]', CREDS.password)
    await page.click('button[type="submit"]')
    
    // Wait for redirect
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 })
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    
    // Safety: force-remove any leftover modals
    await page.evaluate(() => {
      document.querySelectorAll('.p-dialog-mask, .p-component-overlay').forEach(el => {
        el.style.display = 'none'
        el.remove()
      })
    })
  })

  test("measure chat open time", async ({ page }) => {
    const logs = []
    page.on("console", msg => {
      logs.push({ time: Date.now(), text: msg.text(), type: msg.type() })
    })

    const chatBtn = page.locator('.pi-comments').first()
    await expect(chatBtn).toBeVisible({ timeout: 10000 })

    const t0 = Date.now()
    await chatBtn.click({ force: true })
    
    await page.waitForSelector('.chat-container', { timeout: 30000 })
    const tVisible = Date.now()
    
    let tReady = tVisible
    try {
      await page.waitForSelector('.message', { timeout: 15000 })
      tReady = Date.now()
    } catch(e) {
      tReady = Date.now()
    }

    console.log('')
    console.log('=== CHAT OPEN TIME ===')
    console.log('Chat container visible: ' + (tVisible - t0) + 'ms')
    console.log('Messages rendered:      ' + (tReady - t0) + 'ms')

    console.log('')
    console.log('--- Console timeline ---')
    for (const log of logs) {
      const t = log.text
      if (t.includes('Chat') || t.includes('chat') || t.includes('Polza') || t.includes('polza') || t.includes('init') || t.includes('Integram') || t.includes('integram') || t.includes('Loading') || t.includes('Loaded') || t.includes('socket') || t.includes('auth')) {
        console.log('  +' + (log.time - t0) + 'ms [' + log.type + ']: ' + t.substring(0, 160))
      }
    }
  })

  test("profile init network waterfall", async ({ page }) => {
    const chatBtn = page.locator('.pi-comments').first()
    await expect(chatBtn).toBeVisible({ timeout: 10000 })

    const reqs = new Map()
    let reqId = 0
    page.on('request', req => {
      reqs.set(++reqId, { url: req.url(), start: Date.now(), method: req.method() })
    })
    page.on('response', resp => {
      for (const [, entry] of reqs) {
        if (entry.url === resp.url() && !entry.end) {
          entry.end = Date.now(); entry.status = resp.status()
          entry.size = resp.headers()['content-length'] || '?'
          break
        }
      }
    })

    const t0 = Date.now()
    await chatBtn.click({ force: true })
    await page.waitForSelector('.chat-container', { timeout: 30000 })
    await page.waitForTimeout(8000)
    const tEnd = Date.now()

    console.log('')
    console.log('=== NETWORK WATERFALL (' + (tEnd - t0) + 'ms total) ===')
    const entries = [...reqs.values()]
      .filter(r => {
        const u = r.url
        return !u.endsWith('.js') && !u.includes('.css') && !u.includes('.svg') 
          && !u.includes('.woff') && !u.includes('.png') && !u.includes('hot-update')
          && !u.includes('.ico') && !u.includes('favicon')
      })
      .map(r => ({ ...r, url: r.url.replace(BASE, '').substring(0, 110) }))
      .sort((a, b) => a.start - b.start)

    for (const r of entries) {
      const dur = r.end ? (r.end - r.start) + 'ms' : 'pending'
      console.log('  +' + (r.start - t0) + 'ms (' + dur + '): ' + r.method + ' ' + r.url + ' -> ' + (r.status || '...'))
    }
  })

  test("measure message send roundtrip", async ({ page }) => {
    const chatBtn = page.locator('.pi-comments').first()
    await expect(chatBtn).toBeVisible({ timeout: 10000 })
    await chatBtn.click({ force: true })
    await page.waitForSelector('.chat-container', { timeout: 30000 })
    await page.waitForTimeout(5000)

    const msgsBefore = await page.locator('.message').count()
    console.log('Messages before send: ' + msgsBefore)

    const apiCalls = []
    page.on('request', req => {
      const u = req.url()
      if (u.includes('/api/') || u.includes('ai2o.ru')) {
        apiCalls.push({ time: Date.now(), dir: 'REQ', method: req.method(), url: u.substring(0, 130) })
      }
    })
    page.on('response', resp => {
      const u = resp.url()
      if (u.includes('/api/') || u.includes('ai2o.ru')) {
        apiCalls.push({ time: Date.now(), dir: 'RES', status: resp.status(), url: u.substring(0, 130) })
      }
    })

    const input = page.locator('.chat-container textarea, .chat-container input[type="text"]').first()
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('test-perf: 2+2')

    const tSend = Date.now()
    await input.press('Enter')

    // Wait for user message
    try {
      await page.waitForFunction(
        (before) => document.querySelectorAll('.message').length > before,
        msgsBefore,
        { timeout: 10000, polling: 200 }
      )
      console.log('User message appeared: ' + (Date.now() - tSend) + 'ms')
    } catch(e) {
      console.log('User message did not appear in 10s')
    }

    // Wait for AI response
    let tFirstResponse = 0
    try {
      await page.waitForFunction(
        (before) => document.querySelectorAll('.message').length > before + 1,
        msgsBefore,
        { timeout: 90000, polling: 300 }
      )
      tFirstResponse = Date.now()
    } catch(e) {
      tFirstResponse = Date.now()
      console.log('Timeout waiting for AI response')
    }

    let tDone = tFirstResponse
    try {
      await page.waitForFunction(
        () => !document.querySelector('.p-progress-spinner, .ai-loading, .typing-indicator'),
        null,
        { timeout: 60000, polling: 500 }
      )
      tDone = Date.now()
    } catch(e) {}

    console.log('')
    console.log('=== MESSAGE ROUNDTRIP ===')
    console.log('First AI response: ' + (tFirstResponse - tSend) + 'ms')
    console.log('Response complete:  ' + (tDone - tSend) + 'ms')

    console.log('')
    console.log('--- API calls timeline ---')
    for (const c of apiCalls.sort((a, b) => a.time - b.time)) {
      const delta = c.time - tSend
      if (c.dir === 'REQ') console.log('  +' + delta + 'ms: -> ' + c.method + ' ' + c.url)
      else console.log('  +' + delta + 'ms: <- ' + c.status + ' ' + c.url)
    }
  })

  test("chat DOM complexity", async ({ page }) => {
    const chatBtn = page.locator('.pi-comments').first()
    await expect(chatBtn).toBeVisible({ timeout: 10000 })
    await chatBtn.click({ force: true })
    await page.waitForSelector('.chat-container', { timeout: 30000 })
    await page.waitForTimeout(5000)

    const stats = await page.evaluate(() => {
      const chat = document.querySelector('.layout-chat')
      if (!chat) return { error: 'no .layout-chat element found' }
      const all = chat.querySelectorAll('*')
      
      const heavyEls = []
      for (const el of all) {
        if (el.children.length > 20) {
          heavyEls.push({
            tag: el.tagName,
            class: el.className?.toString().substring(0, 60) || '',
            children: el.children.length
          })
        }
      }
      heavyEls.sort((a, b) => b.children - a.children)
      
      return {
        totalDOMNodes: all.length,
        buttons: chat.querySelectorAll('button').length,
        inputs: chat.querySelectorAll('input, textarea').length,
        svgIcons: chat.querySelectorAll('svg').length,
        messages: chat.querySelectorAll('.message').length,
        chatHTML_KB: Math.round(chat.innerHTML.length / 1024),
        heaviestElements: heavyEls.slice(0, 10)
      }
    })

    console.log('')
    console.log('=== DOM COMPLEXITY ===')
    for (const [k, v] of Object.entries(stats)) {
      if (k === 'heaviestElements') {
        console.log('  --- Heaviest elements ---')
        for (const el of v) {
          console.log('    <' + el.tag + ' class="' + el.class + '"> — ' + el.children + ' children')
        }
      } else {
        console.log('  ' + k + ': ' + v)
      }
    }
  })
})
