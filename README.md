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

## 湖畔微景区

首次打开且没有已保存场景时，默认载入 **120×100 米的镜湖景区**。已有草稿不会被替换，可点击左侧 **一键体验湖畔景区** 手动载入，并可撤销。无需模型密钥即可体验。

景区包含湖泊、湖心岛、环湖步道、通往岛屿的小桥、北侧凉亭、东侧入口连接路和导览牌，以及树木、长椅和景石。模型全部由 Three.js 几何体构造，没有下载第三方资产。草地基底是平面，不是 GIS 地形或真实景区复原。

本地模式输入 `生成一个 200×160 米的湖畔景区` 会生成按场地尺寸缩放的固定布局模板（60–500 米）；不会逐条理解景区数量和方位指令。需要自由规划时选择 DeepSeek。

可尝试查询 `听风亭在哪里？`、`听风亭离湖心岛多远？`，或 `把湖畔长椅 1 向南移动 1 米`。景点可以从场景树选择，编辑坐标、尺寸、旋转和颜色，并随 JSON 导出保存。距离查询为底部原点直线距离，不是沿步道的步行距离。

室外 JSON 使用可选的 `environment: "outdoor"`，场地与资产尺寸上限为 500 米；未指定 environment 的旧场景仍按室内限制读取。环形步道使用 `shape: "ring"`，内半轴为外半轴的 86%，名称变化不会改变几何。室外湖泊、岛屿为椭圆，桥沿局部 X 轴延伸。所有位置均在统一米制 Z-up 坐标中。

当前探索方式是轨道相机，尚无沿路行走、路径规划、碰撞、地形起伏或水体物理。模板测试检查部分关键连接与尺寸，不能保证任意 AI 生成或手动编辑后的布局合理。

## 功能

- 中文规则解析：`10×8` / `10x8` 房间尺寸、室内六类基础物体、阿拉伯数字或一至六的数量、基础东南西北方位。
- 三维视图：轨道旋转、平移、缩放、物体选择与定位、俯视、网格。
- 物体列表搜索；编辑名称、位置、尺寸、绕 Z 轴旋转和颜色；添加、删除物体。
- 空间查询：`桌子在哪里？`、`椅子离桌子多远？`、`把书架向西移动 1 米`。同类多个物体可使用完整名称，例如 `椅子 2`。
- 浏览器本地自动保存、经过校验的场景 JSON 导入与导出。

## 场景约定

JSON `version: 1`，`units: meters`，`upAxis: Z`；右手坐标系，X 向东、Y 向北、Z 向上。物体位置为底部中心，尺寸为局部长宽高，rotation 为绕 Z 轴的角度。World 根节点下的 objects 构成扁平场景树，查询距离是物体原点之间的欧氏距离。室内与景区几何资产均由程序生成，无外部模型依赖。

## 边界

本地模式支持有限中文规则；DeepSeek 模式支持自由描述，但模型结果可能不满足空间关系或保留全部无关属性，须人工检查。当前只有 JSON 结构校验，没有通用的确定性空间关系约束求解。生成结果可为空；多个同类物体的布局是启发式结果。没有碰撞检测、物理引擎、第一人称行走、机器人接口或仿真保证；允许编辑到房间外，尚不进行空间约束验证。自动保存仅属于当前浏览器，重要数据请导出。渲染需要支持 WebGL 的浏览器。字体优先使用在线字体，网络不可用时自动回退到系统字体。

DeepSeek 生成通过服务端 `server/api.ts` 和共享的 `parseWorld` 校验进入编辑系统。后续需增加空间边界与碰撞校验；物理与机器人仿真对接需要另行定义碰撞体、质量、关节和坐标转换。

测试中的 DeepSeek 响应为模拟数据，不需要账户；通过这些测试并不代表真实模型访问已验证。

DeepSeek 接口参考：[首次调用](https://api-docs.deepseek.com/) · [JSON Output](https://api-docs.deepseek.com/guides/json_mode)。此前的 `WORLDGEN_OPENAI_KEY` / `WORLDGEN_OPENAI_MODEL` 不再使用，也不会将 OpenAI 密钥发送到 DeepSeek。云环境设置里可以删除旧 OpenAI 配置要求。

## 本地 Qwen 备用模型（Ollama）

DeepSeek 返回 HTTP 402（余额不足）时，服务端自动尝试 Ollama 的 `qwen2.5-coder:7b`。未配置 DeepSeek 密钥时也直接尝试 Ollama。其他错误不会自动转发到本地模型。界面也可直接选择“本地 Qwen（Ollama）”，跳过 DeepSeek。模型结果使用同样的场景校验，错误不覆盖当前场景。

在运行 WorldGen 后端的机器上安装 Ollama，并运行：

```sh
ollama serve # 如果后台服务已经运行，无需重复启动
ollama pull qwen2.5-coder:7b
# 另一个终端，从项目目录启动
npm run dev -- --port 3000
```

默认 `WORLDGEN_OLLAMA_URL=http://127.0.0.1:11434`，`WORLDGEN_LOCAL_MODEL=qwen2.5-coder:7b`。可在 .env 或后端环境变量中覆盖，修改后重启 WorldGen。Ollama 请求使用独立直连连接池，不经过 DeepSeek 代理，也不携带 DeepSeek 密钥。支持 Ollama `/api/chat`，非流式、JSON schema 格式；本地推理超时 180 秒，浏览器总等待上限 250 秒。

**云环境的 127.0.0.1 不是你的电脑。** 如果 Ollama 在个人电脑上，最简单的方法是在该电脑上运行整个 WorldGen 项目；否则需要提供云后端可访问的服务地址及安全网络通路。不要直接把无认证的 Ollama 服务暴露在公网。当前云环境未安装 Ollama，尚未验证真实 Qwen 推理；自动切换链路已用模拟模型响应测试。`/api/status` 的 localConfigured 仅表示有配置地址，不保证服务在线或模型已安装。
