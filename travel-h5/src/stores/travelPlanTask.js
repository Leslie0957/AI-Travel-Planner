import { reactive } from 'vue'
import { streamTravelPlan } from '../api/travel'
import { saveCurrentPlan } from '../utils/storage'

const progressMessages = [
  '正在理解你的目的地、预算和旅行天数。',
  '正在分析景点区域、交通动线和游玩节奏。',
  '正在生成每天上午、下午、晚上的行程安排。',
  '正在估算住宿、餐饮、交通和门票预算。',
  '正在整理最终行程，马上进入详情页。'
]

export const travelPlanTask = reactive({
  loading: false,
  progressText: '',
  progressPercent: 0,
  progressStep: 0,
  error: '',
  plan: null
})

let runningTask = null

export function startTravelPlanTask(input) {
  if (travelPlanTask.loading) return runningTask

  travelPlanTask.loading = true
  travelPlanTask.progressStep = 0
  travelPlanTask.progressPercent = 8
  travelPlanTask.progressText = progressMessages[0]
  travelPlanTask.error = ''
  travelPlanTask.plan = null

  runningTask = streamTravelPlan(input, {
    onChunk() {
      advanceProgress()
    },
    onFinal(payload) {
      if (payload.plan) {
        travelPlanTask.progressText = progressMessages[4]
        travelPlanTask.progressPercent = 100
        travelPlanTask.plan = payload.plan
        saveCurrentPlan(payload.plan)
      }
    },
    onError(payload) {
      travelPlanTask.error = payload.message || '生成失败'
    }
  })
    .catch((error) => {
      travelPlanTask.error = error.message || '请求失败，请检查后端服务'
    })
    .finally(() => {
      travelPlanTask.loading = false
      runningTask = null
    })

  return runningTask
}

export function clearTravelPlanTaskResult() {
  travelPlanTask.plan = null
  travelPlanTask.error = ''
}

function advanceProgress() {
  travelPlanTask.progressStep = Math.min(travelPlanTask.progressStep + 1, progressMessages.length - 2)
  travelPlanTask.progressText = progressMessages[travelPlanTask.progressStep]
  travelPlanTask.progressPercent = Math.min(15 + travelPlanTask.progressStep * 22, 92)
}
