<template>
  <div v-if="data" class="spot-item">
    <div class="spot-name">{{ data.spot || data.name || '待定景点' }}</div>

    <div class="spot-meta">
      <span v-if="data.duration">
        <van-icon name="clock-o" />
        {{ data.duration }}
      </span>
      <span v-if="data.ticket">
        <van-icon name="coupon-o" />
        {{ data.ticket }}
      </span>
      <span v-if="data.transportation">
        <van-icon name="logistics" />
        {{ data.transportation }}
      </span>
    </div>

    <p v-if="data.description" class="spot-desc">{{ data.description }}</p>
  </div>

  <van-empty v-else description="暂无安排" image-size="44" />
</template>

<script setup>
defineProps({
  data: {
    type: Object,
    default: null
  }
})
</script>

<style scoped>
.spot-item {
  padding: 10px 0;
}

.spot-name {
  margin-bottom: 8px;
  color: #323233;
  font-size: 16px;
  font-weight: 700;
}

.spot-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.spot-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  color: #5f6c7b;
  background: #f2f6fb;
  border-radius: 999px;
  font-size: 12px;
}

.spot-desc {
  margin: 0;
  color: #646566;
  font-size: 14px;
  line-height: 1.6;
}
</style>
