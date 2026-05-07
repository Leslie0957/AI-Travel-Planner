<template>
  <div class="page-container">
    <van-nav-bar title="我的" fixed placeholder />

    <div class="page-content">
      <div class="card profile-card">
        <div class="profile-avatar" aria-hidden="true">
          <van-icon name="contact-o" size="30" />
        </div>
        <div>
          <h1>AI 旅游助手</h1>
          <p>移动端行程生成与旅游咨询 Demo</p>
        </div>
      </div>

      <van-cell-group inset class="menu-group">
        <van-cell title="当前行程" icon="orders-o" is-link @click="goDetail" />
        <van-cell title="接口配置" icon="setting-o" is-link @click="showConfigTip" />
        <van-cell title="清空本地数据" icon="delete-o" is-link @click="confirmClearData" />
      </van-cell-group>

      <div class="card about-card">
        <h2 class="section-title">项目说明</h2>
        <p>
          输入目的地、预算和旅行天数生成行程，并围绕当前行程继续提问。行程和对话保存在当前浏览器中。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { clearTravelStorage, hasCurrentPlan } from '../utils/storage'

const router = useRouter()

function goDetail() {
  if (!hasCurrentPlan()) {
    showToast('请先生成行程')
    router.push('/')
    return
  }

  router.push('/detail')
}

function showConfigTip() {
  showToast('后端 .env 中配置 AI_API_KEY')
}

async function confirmClearData() {
  try {
    await showConfirmDialog({
      title: '清空本地数据',
      message: '将清除当前浏览器保存的行程、聊天记录和表单内容。',
      confirmButtonText: '清空',
      confirmButtonColor: '#ee0a24'
    })
    clearTravelStorage()
    showToast('已清空本地数据')
    router.replace('/')
  } catch {
    // 用户取消时不需要提示。
  }
}
</script>

<style scoped>
.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
}

.profile-avatar {
  display: grid;
  width: 64px;
  height: 64px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: #e8f3ff;
  color: #1989fa;
}

.profile-card h1 {
  margin: 0 0 6px;
  color: #1f2933;
  font-size: 20px;
}

.profile-card p,
.about-card p {
  margin: 0;
  color: #7b8794;
  font-size: 14px;
  line-height: 1.7;
}

.menu-group {
  margin-bottom: 12px;
}
</style>
