<template>
  <div class="page-container detail-page">
    <van-nav-bar title="行程详情" left-arrow fixed placeholder @click-left="router.back()" />

    <div v-if="plan" class="page-content">
      <div class="card overview-card">
        <div>
          <p class="overview-label">{{ plan.city }} · {{ plan.days }}天</p>
          <h1>{{ plan.summary }}</h1>
        </div>
        <div class="budget-pill">¥{{ Number(plan.totalBudget || 0).toLocaleString('zh-CN') }}</div>
      </div>

      <van-collapse v-model="activeDays" class="trip-collapse">
        <van-collapse-item v-for="day in plan.dailyItinerary" :key="day.day" :name="day.day">
          <template #title>
            <span class="day-title">Day {{ day.day }} · {{ day.title || '行程安排' }}</span>
          </template>

          <div class="schedule-section">
            <span class="section-label morning">上午</span>
            <SpotItem :data="day.morning" />
          </div>
          <div class="schedule-section">
            <span class="section-label afternoon">下午</span>
            <SpotItem :data="day.afternoon" />
          </div>
          <div class="schedule-section">
            <span class="section-label evening">晚上</span>
            <SpotItem :data="day.evening" />
          </div>
        </van-collapse-item>
      </van-collapse>

      <div class="card">
        <h2 class="section-title">预算明细</h2>
        <BudgetTable :data="plan.budgetBreakdown" :total="plan.totalBudget" />
      </div>

      <div v-if="plan.tips?.length" class="card">
        <h2 class="section-title">旅行提示</h2>
        <ul class="info-list">
          <li v-for="tip in plan.tips" :key="tip">{{ tip }}</li>
        </ul>
      </div>

      <div v-if="plan.warnings?.length" class="card warning-card">
        <h2 class="section-title">注意事项</h2>
        <ul class="info-list">
          <li v-for="warning in plan.warnings" :key="warning">{{ warning }}</li>
        </ul>
      </div>
    </div>

    <div v-else class="empty-wrap">
      <van-empty description="还没有生成行程">
        <van-button type="primary" @click="router.push('/')">去生成</van-button>
      </van-empty>
    </div>

    <div v-if="plan" class="detail-footer">
      <van-button type="primary" block round icon="chat-o" @click="goChat">咨询 AI</van-button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BudgetTable from '../components/BudgetTable.vue'
import SpotItem from '../components/SpotItem.vue'
import { readCurrentPlan } from '../utils/storage'

const router = useRouter()
const plan = computed(() => readCurrentPlan())

const activeDays = ref([1])

function goChat() {
  router.push('/chat')
}
</script>

<style scoped>
.detail-page {
  padding-bottom: 76px;
}

.overview-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.overview-label {
  margin: 0 0 8px;
  color: #1989fa;
  font-size: 13px;
  font-weight: 700;
}

.overview-card h1 {
  margin: 0;
  color: #1f2933;
  font-size: 21px;
  line-height: 1.4;
}

.budget-pill {
  flex: 0 0 auto;
  padding: 7px 10px;
  color: #ee0a24;
  background: #fff1f0;
  border-radius: 999px;
  font-weight: 700;
}

.trip-collapse {
  margin-bottom: 12px;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(31, 41, 55, 0.06);
}

.day-title {
  color: #323233;
  font-weight: 700;
}

.schedule-section {
  padding: 4px 0 8px;
  border-bottom: 1px solid #f1f3f5;
}

.schedule-section:last-child {
  border-bottom: none;
}

.section-label {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 700;
}

.morning {
  color: #d46b08;
  background: #fff7e6;
}

.afternoon {
  color: #096dd9;
  background: #e6f7ff;
}

.evening {
  color: #389e0d;
  background: #f6ffed;
}

.info-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.info-list li {
  padding: 9px 0;
  color: #5f6c7b;
  font-size: 14px;
  line-height: 1.6;
  border-bottom: 1px solid #f1f3f5;
}

.info-list li:last-child {
  border-bottom: none;
}

.warning-card {
  border: 1px solid #ffe1e1;
}

.detail-footer {
  position: fixed;
  right: 0;
  bottom: 50px;
  left: 0;
  z-index: 20;
  max-width: 750px;
  margin: 0 auto;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -8px 24px rgba(31, 41, 55, 0.08);
}

.empty-wrap {
  display: flex;
  min-height: calc(100vh - 120px);
  align-items: center;
  justify-content: center;
}
</style>
