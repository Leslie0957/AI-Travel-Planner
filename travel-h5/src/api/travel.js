const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3300'

export async function streamTravelPlan(payload, handlers = {}) {
  return streamPost('/api/travel/plan', payload, handlers)
}

export async function streamChat(payload, handlers = {}) {
  return streamPost('/api/chat', payload, handlers)
}

async function streamPost(path, payload, handlers) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  if (!response.body) {
    throw new Error('当前浏览器不支持流式读取。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const event of events) {
      const lines = event.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (!data) continue

        try {
          const payload = JSON.parse(data)
          handlers.onEvent?.(payload)

          if (payload.type === 'chunk') handlers.onChunk?.(payload.content || '')
          if (payload.type === 'final') handlers.onFinal?.(payload)
          if (payload.type === 'error') handlers.onError?.(payload)
        } catch (error) {
          handlers.onError?.({
            type: 'error',
            message: '流式数据解析失败。',
            detail: error.message
          })
        }
      }
    }
  }
}
