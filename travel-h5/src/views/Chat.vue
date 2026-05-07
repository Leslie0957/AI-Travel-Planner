<template>
  <div class="page-container chat-page">
    <van-nav-bar title="AI 旅游咨询" />

    <div class="context-bar">
      <div class="context-main">
        <van-popover v-model:show="showSessionPicker" placement="bottom-start">
          <template #reference>
            <button class="session-button" type="button" :disabled="loading">
              <span>{{ sessionTitle(activeSession) }}</span>
              <van-icon name="arrow-down" />
            </button>
          </template>

          <div class="session-menu">
            <button class="session-create" type="button" :disabled="loading" @click="createNewChat">
              <van-icon name="plus" />
              <span>创建新对话</span>
            </button>
            <button
              v-for="session in sessionOptions"
              :key="session.id"
              class="session-option"
              :class="{ active: session.id === activeSessionId }"
              type="button"
              @click="selectSession(session)"
            >
              <span class="session-option-title">{{ sessionTitle(session) }}</span>
              <span class="session-option-meta">{{ sessionMeta(session) }}</span>
            </button>
          </div>
        </van-popover>
        <p>{{ sessionHint }}</p>
      </div>
    </div>

    <div ref="messageListRef" class="chat-container" @scroll="handleScroll">
      <div v-if="messages.length === 0" class="chat-empty">
        <van-empty image="search" description="可以围绕行程继续追问" />

        <div class="quick-questions">
          <div class="quick-title">推荐问题</div>
          <div class="tag-row">
            <van-tag
              v-for="question in suggestedQuestions"
              :key="question"
              plain
              round
              type="primary"
              size="medium"
              @click="sendQuestion(question)"
            >
              {{ question }}
            </van-tag>
          </div>
        </div>
      </div>

      <div v-else class="message-list">
        <ChatBubble v-for="message in messages" :key="message.id" :message="message" />

        <div v-if="!loading" class="follow-up-questions">
          <div class="quick-title">可以继续问</div>
          <div class="tag-row">
            <van-tag
              v-for="question in suggestedQuestions"
              :key="question"
              plain
              round
              type="primary"
              size="medium"
              @click="sendQuestion(question)"
            >
              {{ question }}
            </van-tag>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input-area">
      <van-field
        v-model="input"
        rows="1"
        autosize
        type="textarea"
        maxlength="300"
        placeholder="问问美食、路线、预算或注意事项"
        :disabled="loading"
        @keyup.enter.prevent="sendQuestion(input)"
      >
        <template #button>
          <van-button size="small" type="primary" :loading="loading" :disabled="!canSend" @click="sendQuestion(input)">
            发送
          </van-button>
        </template>
      </van-field>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { showToast } from 'vant'
import ChatBubble from '../components/ChatBubble.vue'
import { streamChat } from '../api/travel'
import { createSuggestedQuestions } from '../utils/questionSuggest'
import {
  createGeneralChatSession,
  readChatMessages,
  readChatScrollTop,
  readPlanSessions,
  readActivePlanSessionId,
  saveChatMessages,
  saveChatScrollTop,
  setActivePlanSessionId
} from '../utils/storage'

const input = ref('')
const loading = ref(false)
const messageListRef = ref(null)
const showSessionPicker = ref(false)
const planSessions = ref(readPlanSessions())
const activeSessionId = ref(readActivePlanSessionId())
const defaultSession = {
  id: 'general',
  type: 'general',
  city: '新对话',
  days: 0,
  totalBudget: 0,
  summary: '新对话',
  plan: null
}
const sessionOptions = computed(() => (planSessions.value.length ? planSessions.value : [defaultSession]))
const activeSession = computed(
  () => sessionOptions.value.find((session) => session.id === activeSessionId.value) || sessionOptions.value[0]
)
const currentPlan = computed(() => activeSession.value?.plan || null)
const chatScopeKey = computed(() => activeSession.value?.id || 'general')
const messages = ref(readChatMessages(chatScopeKey.value))
let restoreTimer = null

const canSend = computed(() => Boolean(input.value.trim()) && !loading.value)
const suggestedQuestions = computed(() => createSuggestedQuestions(currentPlan.value, messages.value))
const sessionHint = computed(() =>
  currentPlan.value ? 'AI 会参考当前行程回答，切换对话即可更换上下文。' : '这是不关联行程的新对话，适合咨询通用旅行问题。'
)

onMounted(async () => {
  loadActiveSessionMessages()
  await nextTick()
  restoreScrollTop()
})

onBeforeUnmount(() => {
  if (restoreTimer) clearTimeout(restoreTimer)
  persistScrollTop()
})

async function sendQuestion(text) {
  const question = String(text || '').trim()
  if (!question || loading.value) return

  input.value = ''
  loading.value = true

  messages.value.push(createMessage('user', question))
  messages.value.push(createMessage('assistant', '', true))
  persistMessages()
  const assistantIndex = messages.value.length - 1
  await scrollToBottom()

  try {
    await streamChat(
      {
        message: question,
        history: messages.value
          .filter((item) => item.content && !item.streaming)
          .map((item) => ({
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: item.content
          })),
        planContext: currentPlan.value || null
      },
      {
        async onChunk(chunk) {
          appendAssistantContent(assistantIndex, chunk)
          await scrollToBottom()
        },
        onFinal(payload) {
          updateAssistantMessage(assistantIndex, {
            content: payload.message || messages.value[assistantIndex]?.content || '',
            streaming: false
          })
        },
        onError(payload) {
          updateAssistantMessage(assistantIndex, {
            content: payload.message || '对话失败，请稍后重试。',
            streaming: false
          })
        }
      }
    )
  } catch (error) {
    updateAssistantMessage(assistantIndex, {
      content: error.message || '请求失败，请检查后端服务。',
      streaming: false
    })
    showToast('请求失败')
  } finally {
    updateAssistantMessage(assistantIndex, { streaming: false })
    loading.value = false
    await scrollToBottom()
  }
}

async function selectSession(session) {
  if (loading.value) return

  persistScrollTop()
  activeSessionId.value = session.id
  setActivePlanSessionId(session.id)
  showSessionPicker.value = false
  loadActiveSessionMessages()
  await nextTick()
  restoreScrollTop()
}

async function createNewChat() {
  if (loading.value) return

  persistScrollTop()
  const session = createGeneralChatSession()
  planSessions.value = readPlanSessions()
  activeSessionId.value = session.id
  showSessionPicker.value = false
  loadActiveSessionMessages()
  await nextTick()
  restoreScrollTop()
}

function loadActiveSessionMessages() {
  messages.value = readChatMessages(chatScopeKey.value)
}

function sessionTitle(session) {
  if (!session?.plan) return session?.summary || '新对话'

  return `${session.city} · ${session.days}天行程`
}

function sessionMeta(session) {
  if (!session?.plan) return '不关联行程'

  return `¥${Number(session.totalBudget || 0).toLocaleString('zh-CN')}`
}

function createMessage(role, content, streaming = false) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    streaming,
    timestamp: Date.now()
  }
}

function appendAssistantContent(index, chunk) {
  const current = messages.value[index]
  if (!current) return

  updateAssistantMessage(index, {
    content: `${current.content || ''}${chunk}`
  })
}

function updateAssistantMessage(index, patch) {
  const current = messages.value[index]
  if (!current) return

  messages.value[index] = {
    ...current,
    ...patch
  }
  persistMessages()
}

function persistMessages() {
  saveChatMessages(
    messages.value.map((message) => ({
      ...message,
      streaming: false
    })),
    chatScopeKey.value
  )
}

function handleScroll() {
  persistScrollTop()
}

function persistScrollTop() {
  const el = messageListRef.value
  if (el) {
    saveChatScrollTop(el.scrollTop, chatScopeKey.value)
  }
}

function restoreScrollTop() {
  const el = messageListRef.value
  if (!el) return

  const scrollTop = readChatScrollTop(chatScopeKey.value)
  el.scrollTop = scrollTop

  restoreTimer = setTimeout(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = scrollTop
    }
  }, 80)
}

async function scrollToBottom() {
  await nextTick()
  const el = messageListRef.value
  if (el) {
    el.scrollTop = el.scrollHeight
    persistScrollTop()
  }
}
</script>

<style scoped>
.chat-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 0;
}

.chat-container {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
}

.context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: #eef6ff;
  border-bottom: 1px solid #dbeafe;
}

.context-main {
  min-width: 0;
}

.session-button {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 4px;
  padding: 0;
  color: #1f2933;
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 700;
  text-align: left;
}

.session-button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-menu {
  width: 230px;
  padding: 6px;
}

.session-create {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  padding: 10px;
  color: #1989fa;
  background: #eef6ff;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  text-align: left;
}

.session-option {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  color: #323233;
  background: #fff;
  border: none;
  border-radius: 8px;
  text-align: left;
}

.session-option.active {
  color: #1989fa;
  background: #eef6ff;
  font-weight: 700;
}

.session-option-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-option-meta {
  flex: 0 0 auto;
  color: #969799;
  font-size: 12px;
}

.context-bar p {
  margin: 3px 0 0;
  color: #5f6c7b;
  font-size: 12px;
  line-height: 1.4;
}

.chat-empty {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.quick-questions {
  width: 100%;
  margin-top: 10px;
  padding: 0 8px;
}

.follow-up-questions {
  align-self: stretch;
  padding: 6px 0 2px;
}

.quick-title {
  margin-bottom: 12px;
  color: #7b8794;
  text-align: center;
  font-size: 13px;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chat-input-area {
  flex: 0 0 auto;
  z-index: 30;
  padding: 9px 12px;
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid #edf0f5;
  box-shadow: 0 -8px 24px rgba(31, 41, 55, 0.08);
}

.chat-input-area :deep(.van-field) {
  align-items: flex-end;
  background: #f2f6fb;
  border-radius: 20px;
}
</style>
