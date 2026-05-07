const PLAN_KEY = 'travel.currentPlan'
const FORM_KEY = 'travel.homeForm'
const PLAN_SESSIONS_KEY = 'travel.planSessions'
const ACTIVE_SESSION_KEY = 'travel.activeSessionId'
const CHAT_KEY_PREFIX = 'travel.chatMessages.'
const CHAT_SCROLL_KEY_PREFIX = 'travel.chatScrollTop.'

export function saveCurrentPlan(plan) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan))
  upsertPlanSession(plan)
}

export function readCurrentPlan() {
  const activeSession = readActivePlanSession()
  //等价于 if (activeSession != null && activeSession.plan)
  if (activeSession?.plan) return activeSession.plan

  return readJson(PLAN_KEY, null)
}

export function hasCurrentPlan() {
  return Boolean(readCurrentPlan())
}

export function upsertPlanSession(plan) {
  if (!plan) return null

  const id = getPlanScopeKey(plan)
  const sessions = readPlanSessions().filter((session) => session.id !== id)
  const session = {
    id,
    city: plan.city || '未知目的地',
    days: Number(plan.days || 0),
    totalBudget: Number(plan.totalBudget || 0),
    summary: plan.summary || `${plan.city || '旅行'}计划`,
    createdAt: Date.now(),
    plan
  }

  localStorage.setItem(PLAN_SESSIONS_KEY, JSON.stringify([session, ...sessions]))
  setActivePlanSessionId(id)
  return session
}

export function createGeneralChatSession() {
  const id = `general-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const createdAt = Date.now()
  const session = {
    id,
    type: 'general',
    city: '新对话',
    days: 0,
    totalBudget: 0,
    summary: `新对话 ${formatTime(createdAt)}`,
    createdAt,
    plan: null
  }

  localStorage.setItem(PLAN_SESSIONS_KEY, JSON.stringify([session, ...readPlanSessions()]))
  setActivePlanSessionId(id)
  return session
}

export function readPlanSessions() {
  const sessions = readJson(PLAN_SESSIONS_KEY, [])
  if (sessions.length) return sessions

  const legacyPlan = readJson(PLAN_KEY, null)
  if (!legacyPlan) return []

  const session = {
    id: getPlanScopeKey(legacyPlan),
    city: legacyPlan.city || '未知目的地',
    days: Number(legacyPlan.days || 0),
    totalBudget: Number(legacyPlan.totalBudget || 0),
    summary: legacyPlan.summary || `${legacyPlan.city || '旅行'}计划`,
    createdAt: Date.now(),
    plan: legacyPlan
  }

  localStorage.setItem(PLAN_SESSIONS_KEY, JSON.stringify([session]))
  return [session]
}

export function readActivePlanSessionId() {
  const activeId = localStorage.getItem(ACTIVE_SESSION_KEY)
  const sessions = readPlanSessions()

  if (activeId && sessions.some((session) => session.id === activeId)) {
    return activeId
  }

  if (activeId === 'general' && sessions.length === 0) {
    return activeId
  }

  return sessions[0]?.id || ''
}

export function setActivePlanSessionId(id) {
  if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id)
}

export function readActivePlanSession() {
  const activeId = readActivePlanSessionId()
  return readPlanSessions().find((session) => session.id === activeId) || null
}

export function saveChatMessages(messages, scopeKey = getCurrentPlanScopeKey()) {
  localStorage.setItem(`${CHAT_KEY_PREFIX}${scopeKey}`, JSON.stringify(messages))
}

export function readChatMessages(scopeKey = getCurrentPlanScopeKey()) {
  return readJson(`${CHAT_KEY_PREFIX}${scopeKey}`, [])
}

export function saveHomeForm(form) {
  localStorage.setItem(FORM_KEY, JSON.stringify(form))
}

export function readHomeForm() {
  return readJson(FORM_KEY, {
    city: '北京',
    budget: 3000,
    days: 3
  })
}

export function saveChatScrollTop(scrollTop, scopeKey = getCurrentPlanScopeKey()) {
  localStorage.setItem(`${CHAT_SCROLL_KEY_PREFIX}${scopeKey}`, String(Math.max(0, Number(scrollTop) || 0)))
}

export function readChatScrollTop(scopeKey = getCurrentPlanScopeKey()) {
  return Number(localStorage.getItem(`${CHAT_SCROLL_KEY_PREFIX}${scopeKey}`) || 0)
}

export function clearTravelStorage() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('travel.'))
    .forEach((key) => localStorage.removeItem(key))
}

export function getCurrentPlanScopeKey() {
  return readActivePlanSessionId() || getPlanScopeKey(readCurrentPlan())
}

export function getPlanScopeKey(plan) {
  if (!plan) return 'general'

  return hashString(
    JSON.stringify({
      city: plan.city,
      days: plan.days,
      totalBudget: plan.totalBudget,
      summary: plan.summary
    })
  )
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function hashString(value) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash).toString(36)
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}
