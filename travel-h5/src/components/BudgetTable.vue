<template>
  <div class="budget-table">
    <van-cell-group inset>
      <van-cell v-for="item in items" :key="item.key" :title="item.label" :value="formatMoney(item.value)" />
    </van-cell-group>

    <div class="budget-total">
      <span>预算合计</span>
      <strong>{{ formatMoney(totalAmount) }}</strong>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({})
  },
  total: {
    type: [Number, String],
    default: 0
  }
})

const labels = {
  accommodation: '住宿',
  food: '餐饮',
  transportation: '交通',
  tickets: '门票',
  other: '其他'
}

const items = computed(() =>
  Object.keys(labels).map((key) => ({
    key,
    label: labels[key],
    value: Number(props.data?.[key] || 0)
  }))
)

const totalAmount = computed(() => {
  const total = Number(props.total || 0)
  if (total > 0) return total

  return items.value.reduce((sum, item) => sum + Number(item.value || 0), 0)
})

function formatMoney(value) {
  return `¥${Number(value || 0).toLocaleString('zh-CN')}`
}
</script>

<style scoped>
.budget-table {
  margin-top: 8px;
}

.budget-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 16px 0;
  padding: 14px 16px;
  color: #323233;
  background: #f7f8fa;
  border-radius: 10px;
}

.budget-total strong {
  color: #ee0a24;
  font-size: 18px;
}
</style>
