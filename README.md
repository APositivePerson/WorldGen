# WorldGen · Spatial Studio

自然语言驱动的三维微世界原型，基于 React、TypeScript、Three.js 和 Vite。支持 DeepSeek 结构化场景生成与基于当前场景的自然语言修改；也保留无需密钥的本地规则模式。

## 运行

需要 Node.js 22+：

```sh
npm ci --cache /tmp/worldgen-npm
npm run dev -- --port 3000
```

```sh
npm test       # 场景生成、导入校验、数据往返
npm run build # TypeScript 检查和生产构建
npm start -- --port 3000 # 生产模式：同一个 Node 服务提供 API 和 dist 静态文件
```

## 配置 DeepSeek

```sh
cp .env.example .env
# 在本机编辑 .env，填入 WORLDGEN_DEEPSEEK_KEY；不要提交真实密钥。
npm run dev -- --port 3000
```

服务端读取 `WORLDGEN_DEEPSEEK_KEY`（本地也兼容 `DEEPSEEK_API_KEY`），模型由 `WORLDGEN_DEEPSEEK_MODEL` 指定，默认为 `deepseek-flash`。需要具有该模型访问权限及可用额度的 DeepSeek API 账户。不要使用 `VITE_*` 保存密钥。修改配置后重启服务。云环境中通过环境设置安全填写 `WORLDGEN_DEEPSEEK_KEY`，无需创建密钥文件。`GET /api/status` 仅返回配置状态与模型名；配置存在并不等于账户可用。

选择 DeepSeek 引擎后，左侧按钮创建新场景。下方输入修改指令，点击“用 DeepSeek 修改当前场景”，会将提示词、当前场景和选中 ID 发送到 DeepSeek；没有多轮聊天记录，连续编辑以最新场景为上下文。原有箭头按钮仍用于本地坐标、距离与基础移动查询。支持撤销最近一次生成 / AI 修改。

API 使用 DeepSeek Chat Completions 的 JSON Output（`response_format: json_object`），在提示词中提供完整场景 schema，并在服务端执行场景结构校验；输出截断、拒绝、认证、超时或校验失败均不会替换当前场景。请求期间发生手动编辑时，迟到结果不会覆盖这些编辑。服务端通过环境 HTTP 代理访问固定的 `api.deepseek.com`；不向客户端返回密钥或上游原始错误。

`npm run dev` 已改为同时启动 Node API 与 Vite；仅运行 Vite 或 `npm run preview` 不提供 AI API。生产使用 `npm run build` 后 `npm start`。默认模型 `deepseek-flash` 依据 DeepSeek 官方当前接口文档选择，可通过模型环境变量覆盖。默认端口 3000，可以通过 `--port` 或 `PORT` 修改。

此服务是开发原型，尚无用户认证、按用户限额或持久化任务队列。公开部署前需添加访问控制及用量管理。

## 功能

- 中文规则解析：`10×8` / `10x8` 房间尺寸、六种物体、阿拉伯数字或一至六的数量、基础东南西北方位。
- 三维视图：轨道旋转、平移、缩放、物体选择与定位、俯视、网格。
- 物体列表搜索；编辑名称、位置、尺寸、绕 Z 轴旋转和颜色；添加、删除物体。
- 空间查询：`桌子在哪里？`、`椅子离桌子多远？`、`把书架向西移动 1 米`。同类多个物体可使用完整名称，例如 `椅子 2`。
- 浏览器本地自动保存、经过校验的场景 JSON 导入与导出。

## 场景约定

JSON `version: 1`，`units: meters`，`upAxis: Z`；右手坐标系，X 向东、Y 向北、Z 向上。物体位置为底部中心，尺寸为局部长宽高，rotation 为绕 Z 轴的角度。World 根节点下的 objects 构成扁平场景树，查询距离是物体原点之间的欧氏距离。原型几何资产均由程序生成，无外部模型依赖。

## 边界

本地模式支持有限中文规则；DeepSeek 模式支持自由描述，但模型结果可能不满足空间关系或保留全部无关属性，须人工检查。当前只有 JSON 结构校验，没有确定性的空间关系约束求解。生成结果可为空；多个同类物体的布局是启发式结果。没有碰撞检测、物理引擎、第一人称行走、机器人接口或仿真保证；允许编辑到房间外，尚不进行空间约束验证。自动保存仅属于当前浏览器，重要数据请导出。渲染需要支持 WebGL 的浏览器。字体优先使用在线字体，网络不可用时自动回退到系统字体。

DeepSeek 生成通过服务端 `server/api.ts` 和共享的 `parseWorld` 校验进入编辑系统。后续需增加空间边界与碰撞校验；物理与机器人仿真对接需要另行定义碰撞体、质量、关节和坐标转换。

测试中的 DeepSeek 响应为模拟数据，不需要账户；通过这些测试并不代表真实模型访问已验证。

DeepSeek 接口参考：[首次调用](https://api-docs.deepseek.com/) · [JSON Output](https://api-docs.deepseek.com/guides/json_mode)。此前的 `WORLDGEN_OPENAI_KEY` / `WORLDGEN_OPENAI_MODEL` 不再使用，也不会将 OpenAI 密钥发送到 DeepSeek。云环境设置里可以删除旧 OpenAI 配置要求。
