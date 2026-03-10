/**
 * GR Sound Engine — игровые звуки через Web Audio API
 * Без внешних зависимостей, работает в браузере
 */

let _ctx = null

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  return _ctx
}

function tone(freq, duration, type = 'sine', volume = 0.15, startAt = 0) {
  try {
    const c   = ctx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, c.currentTime + startAt)
    gain.gain.setValueAtTime(volume, c.currentTime + startAt)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startAt + duration)
    osc.start(c.currentTime + startAt)
    osc.stop(c.currentTime + startAt + duration)
  } catch {}
}

/** Удар по боссу — низкий глухой удар */
export function playHit(damage = 100) {
  const pitch = Math.max(80, 200 - damage * 0.3)
  tone(pitch, 0.18, 'sawtooth', 0.2)
  tone(pitch * 0.5, 0.25, 'sine', 0.1, 0.05)
}

/** Критический удар — более мощный звук */
export function playCrit() {
  tone(300, 0.08, 'square', 0.25)
  tone(150, 0.3,  'sawtooth', 0.2, 0.05)
  tone(75,  0.4,  'sine', 0.1, 0.1)
}

/** Победа над боссом — фанфара */
export function playVictory() {
  const notes = [523, 659, 784, 1047, 1319] // C5 E5 G5 C6 E6
  notes.forEach((f, i) => tone(f, 0.35, 'sine', 0.18, i * 0.12))
  // барабан
  tone(60, 0.2, 'sawtooth', 0.3, 0.0)
  tone(60, 0.2, 'sawtooth', 0.3, 0.48)
}

/** Level Up — восходящая арпеджия */
export function playLevelUp() {
  [392, 494, 587, 784].forEach((f, i) => tone(f, 0.2, 'sine', 0.15, i * 0.08))
}

/** Ачивка разблокирована */
export function playAchievement() {
  tone(880, 0.1, 'sine', 0.15)
  tone(1108, 0.15, 'sine', 0.12, 0.1)
  tone(1320, 0.25, 'sine', 0.1, 0.2)
}

/** Спавн босса — угрожающий низкий звук */
export function playBossSpawn() {
  tone(55, 0.8, 'sawtooth', 0.2)
  tone(110, 0.6, 'sawtooth', 0.1, 0.1)
}
