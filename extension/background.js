// Tempo extension background service worker.
// Sends { url, title, timestamp } to the Tempo app (localhost) on:
// - tab activation / URL change / window focus change (immediate)
// - a 3s heartbeat while browser windows are focused

const HEARTBEAT_MS = 3000

const TAB_ENDPOINT = (port) => `http://127.0.0.1:${port}/tab`

// In-memory port (set in options page); token in chrome.storage.local
let apiPort = 47321
chrome.storage.local.get(['port']).then(({ port }) => {
  if (port) apiPort = port
})

// ---- state ----
let currentTab = null // { url, title, incognito }
let browserFocused = false

// ---- helpers ----
async function postToTempo() {
  if (!currentTab || currentTab.incognito || !browserFocused) return

  // Only report web pages
  if (!currentTab.url.startsWith('http://') && !currentTab.url.startsWith('https://')) return

  const { token } = await chrome.storage.local.get(['token'])
  if (!token) return // not paired yet

  try {
    const res = await fetch(TAB_ENDPOINT(apiPort), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        url: currentTab.url,
        title: currentTab.title,
        timestamp: Date.now()
      })
    })
    if (res.status === 401) {
      // Token mismatch - clear locally so the options page shows "not paired"
      console.warn('[tempo] unauthorized - check the pairing token')
    }
  } catch {
    // Tempo app not running - ignore; heartbeat will retry
  }
}

async function updateCurrentTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId)
    currentTab = { url: tab.url ?? '', title: tab.title ?? '', incognito: tab.incognito }
    // Immediate report on tab change (staleness window in the app is ~10s)
    postToTempo()
  } catch {
    currentTab = null
  }
}

// ---- events ----
chrome.tabs.onActivated.addListener(({ tabId }) => updateCurrentTab(tabId))

chrome.tabs.onUpdated.addListener(
  (tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.title) {
      chrome.tabs.get(tabId).then((tab) => {
        // Only update if this tab is still the active one in a focused window
        if (tab.active) {
          currentTab = { url: tab.url ?? '', title: tab.title ?? '', incognito: tab.incognito }
          postToTempo()
        }
      })
    }
  }
)

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  browserFocused = windowId !== chrome.windows.WINDOW_ID_NONE
  if (browserFocused) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (tab) {
      currentTab = { url: tab.url ?? '', title: tab.title ?? '', incognito: tab.incognito }
      postToTempo()
    }
  }
})

chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => {
    if (tab) updateCurrentTab(tab.id)
  })
})

// ---- heartbeat ----
// MV3 service workers die ~30s after their last event/API call, which kills
// setInterval - and watching a static tab produces no tab events at all
// (long YouTube videos would go unattributed). Two defenses:
// 1. A self-scheduling async loop that reports every 3s while alive (every
//    chrome.* call resets the idle timer).
// 2. A chrome.alarms keepalive: fires every 30s regardless, re-syncs the
//    active tab, and keeps the worker from dying permanently. Alarms are
//    min-resolution-bound (Chrome >= 120 allows 0.5min; clamped otherwise).
const KEEPALIVE_ALARM = 'tempo-keepalive'
const ALARM_PERIOD_MIN = 0.5

async function syncActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (tab) {
      currentTab = { url: tab.url ?? '', title: tab.title ?? '', incognito: tab.incognito }
    }
    postToTempo()
  } catch {
    currentTab = null
  }
}

chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: ALARM_PERIOD_MIN })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) syncActiveTab()
})

async function heartbeatLoop() {
  for (;;) {
    await postToTempo()
    await sleep(HEARTBEAT_MS)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// The loop never blocks event handling (genuinely async); exceptions inside
// are caught in postToTempo. Even if the environment kills the SW anyway,
// the alarm wakes it within ~30-60s and attribution resumes.
heartbeatLoop()
