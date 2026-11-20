# 胰岛素抵抗减脂与阶梯降碳助手

这是纯静态单页应用，无后端、无外部依赖。

## 文件

- index.html：入口页面，引用同目录的 styles.css 和 app.js。
- styles.css：全部页面样式。
- app.js：表单交互、计算、预警、localStorage 档案和对比逻辑。
- single-file.html：HTML、CSS、JavaScript 全部内嵌的单文件版本。
- tests/logic.test.js：不依赖第三方库的逻辑测试。

## 使用

1. 解压 ZIP 后，双击 index.html；也可直接打开 single-file.html。
2. 输入体重、体脂率与身体反馈，选择睡眠时长和症状，点击“生成今日建议”。
3. 点击“保存为今日档案”，在“历史档案”查看记录；有两个不同日期的档案后，在“数据对比”生成报告。
4. 若要得到无需登录 ChatGPT 的公网网址，可将 index.html、styles.css、app.js 上传到支持静态网页的托管服务。入口文件必须命名为 index.html。

档案和未提交表单保存在当前浏览器的 localStorage 中，不会自动跨设备同步。更换网址、浏览器或清理网站数据后，历史记录可能无法访问。共享设备上请注意个人健康数据的隐私。

运行测试：在本目录执行 node --test tests/logic.test.js。

本工具只按指定公式提供参考换算和自我观察提示，不替代医学诊断或个体化饮食建议。
