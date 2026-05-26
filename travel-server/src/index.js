import express from 'express'
import fs from 'fs'
import path from 'path'

loadEnvFile()

const app = express()
const port = Number(process.env.PORT || 3300)

app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }

  next()
})

app.get('/heartbeat', (req, res) => {
  res.json({
    message: 'ok',
    timestamp: new Date().toISOString()
  })
})

app.post('/api/travel/plan', async (req, res) => {
  const input = normalizePlanInput(req.body)
  const error = validatePlanInput(input)

  startSse(res)

  if (error) {
    sendSse(res, { type: 'error', message: error })
    endSse(res)
    return
  }

  try {
    sendSse(res, { type: 'start', message: '开始生成旅行计划' })

    if (!hasModelConfig()) {
      await streamMockPlan(res, input)
      return
    }

    let rawText = ''
    let tokenCount = 0
    const prompt = createTravelPlanPrompt(input)

    sendSse(res, { type: 'chunk', content: `正在分析${input.city}的景点、路线和预算约束。` })

    await streamModel({
      messages: [
        {
          role: 'system',
          content: '你是一名严谨的中文旅游规划师。请优先保证路线合理、预算可信、输出结构稳定。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      onToken(token) {
        rawText += token
        tokenCount += 1

        if (tokenCount === 30) {
          sendSse(res, { type: 'chunk', content: '正在生成每日行程安排。' })
        }

        if (tokenCount === 90) {
          sendSse(res, { type: 'chunk', content: '正在整理预算明细和旅行提示。' })
        }
      }
    })

    sendSse(res, { type: 'chunk', content: '正在解析结构化行程结果。' })
    const plan = parsePlanFromModel(rawText, input)
    sendSse(res, { type: 'final', plan, raw: rawText })
    endSse(res)
  } catch (err) {
    sendSse(res, {
      type: 'error',
      message: '生成旅行计划失败，请稍后重试。',
      detail: err.message
    })
    endSse(res)
  }
})

app.post('/api/chat', async (req, res) => {
  const message = String(req.body?.message || '').trim()
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : []
  const planContext = req.body?.planContext ? JSON.stringify(req.body.planContext).slice(0, 3000) : ''

  startSse(res)

  if (!message) {
    sendSse(res, { type: 'error', message: '请输入想咨询的问题。' })
    endSse(res)
    return
  }

  try {
    sendSse(res, { type: 'start', message: 'AI 正在思考' })

    if (!hasModelConfig()) {
      await streamMockChat(res, message)
      return
    }

    let answer = ''
    const messages = [
      {
        role: 'system',
        content:
          '你是一名中文 AI 旅游助手。回答要具体、实用、简洁。遇到票价、开放时间等实时信息时，要提醒用户以官方信息为准。'
      }
    ]

    if (planContext) {
      messages.push({
        role: 'system',
        content: `用户当前正在咨询的行程上下文如下。回答必须优先围绕这份当前行程，不要引用历史消息中其他目的地或其他天数的计划；如果用户问题表达含糊，也默认是在问这份当前行程：${planContext}`
      })
    }

    for (const item of history) {
      if (item?.role === 'user' || item?.role === 'assistant') {
        messages.push({
          role: item.role,
          content: String(item.content || '').slice(0, 1200)
        })
      }
    }

    messages.push({ role: 'user', content: message })

    await streamModel({
      messages,
      onToken(token) {
        answer += token
        sendSse(res, { type: 'chunk', content: token })
      }
    })

    sendSse(res, { type: 'final', message: answer })
    endSse(res)
  } catch (err) {
    sendSse(res, {
      type: 'error',
      message: 'AI 对话失败，请稍后重试。',
      detail: err.message
    })
    endSse(res)
  }
})

app.listen(port, () => {
  console.log(`travel-server is running at http://localhost:${port}`)
})

function normalizePlanInput(body) {
  return {
    city: String(body?.city || '').trim(),
    budget: Number(body?.budget),
    days: Number(body?.days)
  }
}

function validatePlanInput(input) {
  if (!input.city) return '请选择或输入目的地。'
  if (!Number.isFinite(input.budget) || input.budget <= 0) return '预算必须大于 0。'
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 10) return '旅行天数需要在 1 到 10 天之间。'
  return ''
}

function startSse(res) {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
}

function sendSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function endSse(res) {
  sendSse(res, { type: 'done' })
  res.end()
}

function hasModelConfig() {
  return Boolean(getModelApiKey())
}

function getModelApiKey() {
  return (
    process.env.AI_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.SILICONFLOW_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ''
  )
}

function getModelEndpoint() {
  if (process.env.AI_API_ENDPOINT) return process.env.AI_API_ENDPOINT

  const baseUrl = process.env.AI_API_BASE_URL || 'https://api.deepseek.com'
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`
}

async function streamModel({ messages, onToken }) {
  const response = await fetch(getModelEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getModelApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'deepseek-chat',
      messages,
      temperature: Number(process.env.AI_TEMPERATURE || 0.7),
      stream: true
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`model api error ${response.status}: ${errorText.slice(0, 300)}`)
  }

  if (!response.body) {
    const json = await response.json()
    onToken(json?.choices?.[0]?.message?.content || '')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''

    for (const part of parts) {
      for (const line of part.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (!data || data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          const token = json?.choices?.[0]?.delta?.content || ''
          if (token) onToken(token)
        } catch {
          // Some providers may send heartbeat lines. They can be ignored.
        }
      }
    }
  }
}

function createTravelPlanPrompt({ city, budget, days }) {
  return `请为用户生成一份${city}${days}天旅游计划，预算上限为${budget}元。

要求：
1. 只返回 JSON，不要返回 Markdown，不要返回解释文字。
2. 每天必须包含 morning、afternoon、evening 三个时间段。
3. 每个时间段至少包含 spot、duration、ticket、transportation、description 字段。
4. 预算拆分必须包含 accommodation、food、transportation、tickets、other。
5. 行程强度适中，避免跨区域频繁折返。
6. 票价和开放时间不确定时，在 tips 或 warnings 中提醒以官方信息为准。

JSON 结构如下：
{
  "city": "${city}",
  "days": ${days},
  "totalBudget": ${budget},
  "summary": "一句话总结",
  "dailyItinerary": [
    {
      "day": 1,
      "title": "第1天主题",
      "morning": { "spot": "景点名称", "duration": "2小时", "ticket": "约50元", "transportation": "地铁/公交/步行", "description": "景点介绍" },
      "afternoon": { "spot": "景点名称", "duration": "3小时", "ticket": "约80元", "transportation": "打车/地铁", "description": "景点介绍" },
      "evening": { "spot": "街区/夜游/美食", "duration": "2小时", "ticket": "免费", "transportation": "步行", "description": "安排介绍" }
    }
  ],
  "budgetBreakdown": {
    "accommodation": 0,
    "food": 0,
    "transportation": 0,
    "tickets": 0,
    "other": 0
  },
  "tips": ["提示1", "提示2"],
  "warnings": ["注意事项1"]
}`
}

function parsePlanFromModel(rawText, input) {
  try {
    return normalizePlan(JSON.parse(extractJsonText(rawText)), input)
  } catch {
    return {
      ...buildMockPlan(input),
      summary: '模型已返回内容，但 JSON 解析失败。当前展示兜底行程，原始内容保留在接口 raw 字段中。'
    }
  }
}

function extractJsonText(text) {
  const cleaned = text.replace(/```json|```/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found')
  }

  return cleaned.slice(start, end + 1)
}

function normalizePlan(plan, input) {
  return {
    city: plan.city || input.city,
    days: Number(plan.days || input.days),
    totalBudget: Number(plan.totalBudget || input.budget),
    summary: plan.summary || `${input.city}${input.days}天旅行计划`,
    dailyItinerary: Array.isArray(plan.dailyItinerary) ? plan.dailyItinerary : [],
    budgetBreakdown: plan.budgetBreakdown || {},
    tips: Array.isArray(plan.tips) ? plan.tips : [],
    warnings: Array.isArray(plan.warnings) ? plan.warnings : []
  }
}

async function streamMockPlan(res, input) {
  const plan = buildMockPlan(input)
  const chunks = [
    `正在分析${input.city}的热门景点与交通动线。\n`,
    `正在按${input.days}天行程拆分上午、下午和晚上安排。\n`,
    `正在根据${input.budget}元预算估算住宿、餐饮、交通和门票。\n`,
    '行程生成完成，正在整理结构化结果。'
  ]

  for (const chunk of chunks) {
    sendSse(res, { type: 'chunk', content: chunk })
    await delay(500)
  }

  sendSse(res, { type: 'final', plan, raw: JSON.stringify(plan) })
  endSse(res)
}

async function streamMockChat(res, message) {
  const answer = createMockChatAnswer(message)
  const chunks = answer.match(/.{1,12}/g) || [answer]

  for (const chunk of chunks) {
    sendSse(res, { type: 'chunk', content: chunk })
    await delay(80)
  }

  sendSse(res, { type: 'final', message: answer })
  endSse(res)
}

function buildMockPlan({ city, budget, days }) {
  const dayThemes = ['城市初印象', '经典景点深度游', '文化街区与美食', '自然休闲路线', '返程前轻松补漏']
  const dailyItinerary = Array.from({ length: days }, (_, index) => {
    const day = index + 1
    return {
      day,
      title: `${city}${dayThemes[index % dayThemes.length]}`,
      morning: {
        spot: `${city}代表性景点 ${day}`,
        duration: '2-3小时',
        ticket: day % 2 === 0 ? '约50-100元' : '免费或低价',
        transportation: '优先选择地铁或公交',
        description: `上午安排${city}辨识度较高的景点，适合快速建立对城市的整体印象。`
      },
      afternoon: {
        spot: `${city}博物馆/历史街区 ${day}`,
        duration: '2小时',
        ticket: '约0-80元',
        transportation: '地铁转步行',
        description: '下午节奏放慢，选择文化类或街区类地点，减少路途折返。'
      },
      evening: {
        spot: `${city}夜市/滨水步道 ${day}`,
        duration: '1.5-2小时',
        ticket: '免费',
        transportation: '步行或短途打车',
        description: '晚上以美食和轻松散步为主，适合恢复体力并体验当地生活氛围。'
      }
    }
  })

  const accommodation = Math.round(budget * 0.36)
  const food = Math.round(budget * 0.24)
  const transportation = Math.round(budget * 0.16)
  const tickets = Math.round(budget * 0.16)
  const other = Math.max(0, budget - accommodation - food - transportation - tickets)

  return {
    city,
    days,
    totalBudget: budget,
    summary: `这是一份偏稳妥的${city}${days}天旅行计划，重点平衡经典景点、交通效率和预算控制。`,
    dailyItinerary,
    budgetBreakdown: {
      accommodation,
      food,
      transportation,
      tickets,
      other
    },
    tips: [
      '热门景点建议提前预约，尤其是节假日和周末。',
      '每天保留一段机动时间，避免行程被交通或排队打乱。',
      '预算较紧时优先选择公共交通和本地小吃。'
    ],
    warnings: ['门票、开放时间和交通信息可能变化，出发前请以官方平台为准。']
  }
}

function createMockChatAnswer(message) {
  if (message.includes('美食')) {
    return '可以优先找当地老街、夜市和居民区附近的小店。建议把正餐预算留给最有代表性的地方菜，小吃作为补充，这样体验更完整，也更容易控制预算。'
  }

  if (message.includes('交通') || message.includes('路线')) {
    return '路线上建议按区域聚合景点，上午和下午尽量不要跨太远的城区。市内优先地铁和公交，晚间或携带行李时再考虑短途打车。'
  }

  if (message.includes('预算')) {
    return '预算可以按住宿 35%、餐饮 25%、交通 15%、门票 15%、备用 10% 粗略分配。真正执行时，建议先锁定住宿和大交通，再调整景点门票和餐饮档位。'
  }

  return '这个问题可以从时间、预算、交通和兴趣偏好四个角度来判断。建议先确定每天的核心区域，再围绕核心景点安排餐饮和休息点，这样路线会更顺。'
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '')

    if (key && !process.env[key]) {
      process.env[key] = value
    }
  }
}
