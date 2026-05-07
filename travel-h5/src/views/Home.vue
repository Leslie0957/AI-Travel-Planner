<template>
  <div class="page-container">
    <section class="hero-card">
      <p class="eyebrow">AI Travel Planner</p>
      <h1 class="hero-title">智能旅游规划助手</h1>
      <p class="hero-subtitle">输入目的地、预算和天数，生成可展示、可追问的结构化行程。</p>
    </section>

    <section class="page-content">
      <div class="card form-card">
        <h2 class="section-title">生成行程</h2>

        <van-field
          v-model="form.city"
          label="目的地"
          placeholder="例如：北京、杭州、成都"
          clearable
          :disabled="travelPlanTask.loading"
        />
        <van-field
          v-model.number="form.budget"
          label="预算"
          type="number"
          placeholder="例如：3000"
          :disabled="travelPlanTask.loading"
        >
          <template #right-icon>元</template>
        </van-field>
        <van-field label="天数" :disabled="travelPlanTask.loading">
          <template #input>
            <van-stepper
              v-model="form.days"
              :min="MIN_DAYS"
              :max="MAX_DAYS"
              integer
              :disabled="travelPlanTask.loading"
              @overlimit="showDaysLimitToast"
            />
          </template>
        </van-field>

        <div class="hot-cities">
          <div class="hot-title">热门目的地</div>
          <div class="tag-row">
            <van-tag
              v-for="city in hotCities"
              :key="city"
              plain
              round
              type="primary"
              size="medium"
              @click="selectCity(city)"
            >
              {{ city }}
            </van-tag>
          </div>
        </div>

        <van-button
          type="primary"
          class="primary-button"
          :loading="travelPlanTask.loading"
          loading-text="生成中"
          @click="handleGenerate"
        >
          生成旅行计划
        </van-button>
      </div>

      <div v-if="travelPlanTask.progressText || travelPlanTask.loading" class="card stream-card">
        <div class="stream-title">
          <van-loading v-if="travelPlanTask.loading" type="spinner" size="18" color="#1989fa" />
          <van-icon v-else name="guide-o" />
          <span>正在规划</span>
        </div>
        <p class="progress-text">{{ travelPlanTask.progressText }}</p>
        <van-progress :percentage="travelPlanTask.progressPercent" stroke-width="6" :show-pivot="false" />
      </div>

      <div class="card feature-card">
        <div v-for="item in features" :key="item.title" class="feature-item">
          <van-icon :name="item.icon" />
          <div>
            <strong>{{ item.title }}</strong>
            <p>{{ item.desc }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { readHomeForm, saveHomeForm } from '../utils/storage'
import { clearTravelPlanTaskResult, startTravelPlanTask, travelPlanTask } from '../stores/travelPlanTask'

const router = useRouter()
const MIN_DAYS = 1
const MAX_DAYS = 10

const form = reactive(readHomeForm())
form.days = clampDays(form.days)

watch(
  form,
  (value) => {
    const nextDays = clampDays(value.days)
    if (value.days !== nextDays) {
      showDaysLimitToast(value.days)
      value.days = nextDays
      return
    }

    saveHomeForm({
      city: value.city,
      budget: Number(value.budget) || 0,
      days: nextDays
    })
  },
  { deep: true }
)

const hotCities = ['北京', '上海', '杭州', '成都', '重庆', '西安', '厦门', '南京']

const features = [
  {
    icon: 'orders-o',
    title: '结构化行程',
    desc: '按天展示上午、下午、晚上安排，适合面试讲 JSON 渲染。'
  },
  {
    icon: 'exchange',
    title: 'SSE 流式返回',
    desc: '后端分块写出内容，前端边接收边展示。'
  },
  {
    icon: 'chat-o',
    title: '旅游问答',
    desc: '生成后可以继续围绕美食、交通、预算追问。'
  }
]

async function handleGenerate() {
  if (travelPlanTask.loading) return

  if (!form.city.trim()) {
    showToast('请输入目的地')
    return
  }

  if (!Number(form.budget) || Number(form.budget) <= 0) {
    showToast('预算必须大于 0')
    return
  }

  const days = clampDays(form.days)
  if (Number(form.days) !== days) {
    form.days = days
    showToast('旅行天数需要在 1 到 10 天之间')
    return
  }

  clearTravelPlanTaskResult()

  const task = startTravelPlanTask({
    city: form.city.trim(),
    budget: Number(form.budget),
    days
  })

  await task

  if (travelPlanTask.error) {
    showToast(travelPlanTask.error)
    return
  }

  if (travelPlanTask.plan) {
    router.push('/detail')
  }
}

function selectCity(city) {
  form.city = city
}

function clampDays(value) {
  const days = Number.parseInt(value, 10)
  if (!Number.isFinite(days)) return MIN_DAYS
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, days))
}

function showDaysLimitToast(value = form.days) {
  const days = Number(value)

  if (Number.isFinite(days) && days < MIN_DAYS) {
    showToast(`旅行天数不能少于 ${MIN_DAYS} 天`)
    return
  }

  showToast(`最多只能规划 ${MAX_DAYS} 天行程`)
}
</script>

<style scoped>
.eyebrow {
  margin: 0 0 8px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.form-card :deep(.van-cell) {
  padding-right: 0;
  padding-left: 0;
}

.hot-cities {
  margin: 12px 0 18px;
}

.hot-title {
  margin-bottom: 10px;
  color: #7b8794;
  font-size: 13px;
}

.stream-card {
  color: #3e4c59;
}

.stream-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  color: #1989fa;
  font-weight: 700;
}

.stream-card p {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
}

.progress-text {
  min-height: 24px;
  margin-bottom: 12px !important;
}

.feature-card {
  display: grid;
  gap: 14px;
}

.feature-item {
  display: flex;
  gap: 12px;
}

.feature-item > .van-icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: #1989fa;
  font-size: 22px;
}

.feature-item strong {
  display: block;
  margin-bottom: 4px;
  color: #323233;
}

.feature-item p {
  margin: 0;
  color: #7b8794;
  font-size: 13px;
  line-height: 1.6;
}
</style>
