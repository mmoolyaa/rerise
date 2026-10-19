const tokenInput = document.getElementById('token')
const portInput = document.getElementById('port')
const statusDiv = document.getElementById('status')

chrome.storage.local.get(['token', 'port']).then(({ token, port }) => {
  tokenInput.value = token ?? ''
  portInput.value = port ? String(port) : '47321'
})

document.getElementById('save').addEventListener('click', async () => {
  const token = tokenInput.value.trim()
  const port = parseInt(portInput.value.trim(), 10)

  if (!token) {
    statusDiv.textContent = 'Token is required.'
    statusDiv.style.color = 'red'
    return
  }
  if (!(port > 0 && port < 65536)) {
    statusDiv.textContent = 'Port must be a valid number.'
    statusDiv.style.color = 'red'
    return
  }

  await chrome.storage.local.set({ token, port })
  statusDiv.textContent = 'Saved. Use "Test connection" to verify.'
  statusDiv.style.color = 'green'
})

document.getElementById('test').addEventListener('click', async () => {
  const token = tokenInput.value.trim()
  const port = parseInt(portInput.value.trim(), 10)
  if (!token || !(port > 0 && port < 65536)) {
    statusDiv.textContent = 'Enter a token and port first.'
    statusDiv.style.color = 'red'
    return
  }

  try {
    const res = await fetch(`http://127.0.0.1:${port}/tab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: 'https://tempo.local/test', title: 'Connection test', timestamp: Date.now() })
    })
    if (res.ok) {
      statusDiv.textContent = 'Connected to Tempo!'
      statusDiv.style.color = 'green'
    } else if (res.status === 401) {
      statusDiv.textContent = 'Tempo rejected the token (mismatch).'
      statusDiv.style.color = 'red'
    } else {
      statusDiv.textContent = `Unexpected response: ${res.status}`
      statusDiv.style.color = 'orange'
    }
  } catch {
    statusDiv.textContent = 'Could not reach Tempo. Is the app running?'
    statusDiv.style.color = 'red'
  }
})
