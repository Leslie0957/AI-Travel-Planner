# AI旅游规划助手

一个移动端旅游规划 Demo。输入目的地、预算和天数后，可以查看每日路线、景点和预算明细，也可以围绕当前行程继续提问。行程和聊天记录保存在当前浏览器中。

- `travel-h5` 使用 Vue 3、Vant 和 Vite。
- `travel-server` 使用 Express，通过 SSE 返回规划进度和聊天内容。

## 本地运行

需要 Node.js 22.12 或更高版本。默认使用模拟数据，可以直接体验规划与问答。

在第一个终端启动服务端。

```sh
cd travel-server
npm ci
npm start
```

在另一个终端从仓库根目录启动前端，然后打开 `http://localhost:5173`。

```sh
cd travel-h5
npm ci
npm run dev
```

前端默认连接 `http://localhost:3300`。可以通过 `VITE_API_BASE_URL` 指定其他地址，前端生产构建使用 `npm run build`。

## 接入模型

将 `travel-server/.env.example` 复制为同目录下的 `.env`，填写 `AI_API_KEY` 后重启服务端。示例配置使用 DeepSeek，也可以修改 `AI_API_BASE_URL` 和 `AI_MODEL` 来连接兼容 OpenAI Chat Completions 的接口。
