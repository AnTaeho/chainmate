// localStorage 저장. 실패해도 게임은 돈다(사생활 창 · 막힌 저장소).
export const KEYS = { run: 'chainmate.run.v1', settings: 'chainmate.settings.v1', records: 'chainmate.records.v1', runs: 'chainmate.runs.v1' };
export const DEFAULT_SETTINGS = { volume: 0.6, music: 0.5, speed: 1, shake: true, big: false, lang: 'ko', coach: true, replay: true };

export function makeStore(storage) {
  const s = {
    get(key, fallback = null) {
      try {
        const raw = storage && storage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch { return fallback; }
    },
    set(key, value) {
      try { if (storage) storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    },
    del(key) { try { if (storage) storage.removeItem(key); } catch { /* 그대로 */ } },
  };
  return s;
}

export function loadSettings(store) {
  return { ...DEFAULT_SETTINGS, ...(store.get(KEYS.settings, {}) || {}) };
}
