import { reactive, watch } from 'vue'

/**
 * Prototype-only "future options" flags. A single shared reactive object so the
 * top-bar toggle and any consuming component (e.g. the gallery header) stay in
 * sync. Persisted to localStorage so a flag survives reloads while we demo it.
 */
const STORAGE_KEY = 'media-assets-experiments'

type Experiments = {
  /** Surface the Layout segmented control directly on the gallery header
   *  (instead of only inside the Views menu). */
  headerLayoutSwitcher: boolean
}

const defaults: Experiments = {
  headerLayoutSwitcher: false,
}

function load(): Experiments {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults }
  } catch {
    return { ...defaults }
  }
}

const state = reactive<Experiments>(load())

watch(
  state,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
    } catch {
      /* ignore quota / privacy-mode failures */
    }
  },
  { deep: true },
)

export function useExperiments() {
  return state
}
