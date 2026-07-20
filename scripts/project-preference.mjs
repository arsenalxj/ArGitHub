// 推荐层级判定：明确底层项目直接过滤，其余项目按“能否直接使用”排序。

const DIRECT_USE_PATTERNS = [
  /\b(?:app|application|desktop|mobile|web app|client|editor|ide|browser|extension|plugin|dashboard|manager|viewer|generator|converter|checker|monitor|assistant|chat|game|emulator)\b/i,
  /\b(?:cli|tui|gui|tool|utility|agent|automation|workflow|self[- ]hosted|one[- ]click|local[- ]first|platform)\b/i,
  /\b(?:manage|convert|visuali[sz]e|organize|download|protect|edit|search|monitor|generate|replay)\w*\b/i,
  /(?:应用|客户端|桌面端|网页工具|编辑器|浏览器|扩展|插件|助手|管理器|可视化|自动化|自托管|一键部署|游戏)/,
];

const BUILDING_BLOCK_PATTERNS = [
  /\b(?:library|framework|sdk|protocol|specification|standard|format|engine|runtime|toolkit|dataset|foundation model|inference|fine[- ]?tuning|pretraining|benchmark)\b/i,
  /(?:开发库|框架|开发包|协议|规范|引擎|运行时|数据集|基础模型|预训练|基准测试)/,
];

const LOW_LEVEL_RULES = [
  {
    reason: '编译器或语言运行时',
    patterns: [
      /\b(?:compiler|transpiler|toolchain|assembler|linker|bytecode interpreter|language runtime|garbage collector)\b/i,
      /\b(?:jit|aot|ahead-of-time|just-in-time)\b.{0,50}\b(?:compiler|compilation|runtime|backend)\b/i,
      /\b(?:programming|scripting) language\b.{0,50}\b(?:implementation|runtime|compiler|designed)\b/i,
      /(?:编译器|转译器|编译工具链|语言运行时|字节码解释器|垃圾回收器)/,
    ],
  },
  {
    reason: '操作系统或硬件底层',
    patterns: [
      /\b(?:operating system kernel|kernel|device driver|bootloader|hypervisor|bare[- ]metal|firmware)\b/i,
      /(?:操作系统内核|内核开发|设备驱动|引导程序|虚拟机监控器|裸机程序|固件)/,
    ],
  },
  {
    reason: '数据库或存储引擎',
    patterns: [
      /\b(?:database|storage|query) engine\b/i,
      /\b(?:postgres(?:ql)?|redis|sqlite|mysql)\b.{0,60}\b(?:rewrite|rewritten|implementation|clone)\b/i,
      /\b(?:rewrite|rewritten|implementation|clone)\b.{0,60}\b(?:postgres(?:ql)?|redis|sqlite|mysql)\b/i,
      /\b(?:filesystem|file system)\b.{0,40}\b(?:implementation|library|driver)\b/i,
      /(?:数据库引擎|存储引擎|查询引擎|重写数据库|文件系统实现)/,
    ],
  },
];

const AI_INFRASTRUCTURE_PATTERNS = [
  /\b(?:foundation model|model architecture|inference|fine[- ]?tun(?:e|ing)|pretraining|model training)\b/i,
  /\b(?:llm|model)\b.{0,100}\b(?:engine|framework|runtime|library|optimization|backend)\b/i,
  /(?:基础模型|模型架构|模型推理|模型训练|微调框架|训练框架|推理引擎|推理运行时|预训练)/,
];

const FOUNDATIONAL_LIBRARY_PATTERNS = [
  /\b(?:compression|decompression|cryptograph(?:y|ic)|serialization|memory allocat(?:or|ion)|network stack)\b/i,
  /\b(?:parser|lexer)\b.{0,40}\b(?:library|generator|combinator)\b/i,
  /\b(?:library|implementation|algorithm|codec)\b.{0,50}\b(?:compression|decompression|cryptograph(?:y|ic)|serialization|hashing)\b/i,
  /(?:压缩算法|解压算法|密码学库|序列化库|内存分配器|网络协议栈|解析器库)/,
];

const SPEC_OR_PROTOCOL_PATTERNS = [
  /\b(?:protocol|specification|industry standard|open-source format)\b/i,
  /(?:协议实现|行业规范|开放格式)/,
];

function projectText(project) {
  return [project.repo, project.description, ...(project.topics || [])].filter(Boolean).join(' ');
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

export function lowLevelReason(project) {
  const text = projectText(project);
  for (const rule of LOW_LEVEL_RULES) {
    if (matchesAny(text, rule.patterns)) return rule.reason;
  }

  const directUse = matchesAny(text, DIRECT_USE_PATTERNS);
  if (!directUse && matchesAny(text, AI_INFRASTRUCTURE_PATTERNS)) return 'AI 基础模型或训练设施';
  if (!directUse && matchesAny(text, FOUNDATIONAL_LIBRARY_PATTERNS)) return '基础算法或底层库';
  if (!directUse && matchesAny(text, SPEC_OR_PROTOCOL_PATTERNS)) return '基础协议或规范';
  return '';
}

export function filterRecommendedProjects(projects) {
  return projects.filter((project) => !lowLevelReason(project));
}

/** 正数越大越接近可直接使用的应用；负数表示更像构建模块或研究项目。 */
export function applicationPreferenceScore(project) {
  if (lowLevelReason(project)) return -100;
  const text = projectText(project);
  let score = 0;
  for (const pattern of DIRECT_USE_PATTERNS) {
    if (pattern.test(text)) score += 2;
  }
  for (const pattern of BUILDING_BLOCK_PATTERNS) {
    if (pattern.test(text)) score -= 2;
  }
  if (/\b(?:research|experimental|proof of concept)\b|(?:研究项目|实验性|概念验证)/i.test(text)) score -= 1;
  return score;
}

export function applicationPreferenceTier(project) {
  const score = applicationPreferenceScore(project);
  if (score >= 2) return 2;
  if (score >= 0) return 1;
  return 0;
}
