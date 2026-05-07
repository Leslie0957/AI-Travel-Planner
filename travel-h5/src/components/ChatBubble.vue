<template>
  <div class="chat-bubble" :class="messageClass">
    <div class="bubble-content">
      <div class="message-rendered" v-html="renderedContent"></div>
      <span v-if="message.streaming" class="streaming-cursor"></span>
    </div>
    <div v-if="timeText" class="message-time">{{ timeText }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  message: {
    type: Object,
    required: true
  }
})

const messageClass = computed(() => (props.message.role === 'user' ? 'user-message' : 'assistant-message'))

const renderedContent = computed(() => {
  const content = props.message.content || ''
  if (props.message.role === 'user') return renderPlainText(content)
  return renderMarkdown(content)
})

const timeText = computed(() => {
  if (!props.message.timestamp) return ''

  const date = new Date(props.message.timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
})

function renderPlainText(text) {
  return escapeHtml(text).replace(/\n/g, '<br>')
}

function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let html = ''
  let paragraph = []
  let list = []
  let orderedList = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    html += `<p>${paragraph.map(renderInline).join('<br>')}</p>`
    paragraph = []
  }

  const flushList = () => {
    if (list.length) {
      html += `<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`
      list = []
    }

    if (orderedList.length) {
      html += `<ol>${orderedList.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ol>`
      orderedList = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = trimmed.match(/^#{1,4}\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      html += `<p class="md-heading">${renderInline(heading[1])}</p>`
      continue
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/)
    if (unordered) {
      flushParagraph()
      orderedList = []
      list.push(unordered[1])
      continue
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/)
    if (ordered) {
      flushParagraph()
      list = []
      orderedList.push(ordered[1])
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }

  flushParagraph()
  flushList()

  return html || ''
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
</script>

<style scoped>
.chat-bubble {
  display: flex;
  flex-direction: column;
  max-width: 82%;
}

.user-message {
  align-self: flex-end;
  align-items: flex-end;
}

.assistant-message {
  align-self: flex-start;
  align-items: flex-start;
}

.bubble-content {
  padding: 11px 14px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
}

.message-rendered {
  display: inline;
}

.bubble-content :deep(p) {
  margin: 0 0 8px;
}

.bubble-content :deep(p:last-child) {
  margin-bottom: 0;
}

.bubble-content :deep(.md-heading) {
  color: #1f2933;
  font-weight: 700;
}

.bubble-content :deep(ul),
.bubble-content :deep(ol) {
  margin: 6px 0 8px;
  padding-left: 20px;
}

.bubble-content :deep(li) {
  margin: 4px 0;
}

.bubble-content :deep(strong) {
  font-weight: 700;
}

.bubble-content :deep(code) {
  padding: 1px 5px;
  color: #1989fa;
  background: #eef6ff;
  border-radius: 4px;
  font-family: Consolas, "SFMono-Regular", monospace;
  font-size: 13px;
}

.user-message .bubble-content {
  color: #fff;
  background: #1989fa;
  border-bottom-right-radius: 5px;
}

.assistant-message .bubble-content {
  color: #323233;
  background: #fff;
  border: 1px solid #edf0f5;
  border-bottom-left-radius: 5px;
}

.message-time {
  margin-top: 4px;
  padding: 0 4px;
  color: #969799;
  font-size: 11px;
}
</style>
