<template>
  <div class="app-shell">
    <main class="app-main">
      <router-view />
    </main>

    <van-tabbar route safe-area-inset-bottom>
      <van-tabbar-item to="/" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/chat" icon="chat-o">咨询</van-tabbar-item>
      <van-tabbar-item to="/profile" icon="manager-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>
