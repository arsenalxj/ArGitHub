import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applicationPreferenceScore,
  filterRecommendedProjects,
  lowLevelReason,
} from './project-preference.mjs';

const LOW_LEVEL_CASES = [
  ['can1357/pon', 'Python 3.14 JIT & AoT native compiler and runtime in Rust.'],
  ['Poseidon-fan/linux-0.11-rs', 'Linux 0.11 rewritten in Rust: kernel and user library.'],
  ['malisper/pgrust', 'Postgres rewritten in Rust, passing all regression tests.'],
  ['samyeyo/clx', 'A cross-platform ahead-of-time Lua compiler and runtime.'],
  ['welcome-to-the-sunny-side/misa77', 'Ridiculously fast decompression at good ratios.'],
  ['example/model-core', 'A training framework for a new foundation model.'],
  ['kvcache-ai/ktransformers', 'A flexible framework for LLM inference and fine-tune optimizations.'],
];

const APPLICATION_CASES = [
  ['OpenCut-app/OpenCut', 'The open-source CapCut alternative video editor.'],
  ['hcavarsan/pipedash', 'Manage CI/CD pipelines in a self-hosted desktop app.'],
  ['patonw/leaves', 'A text-mode disk usage visualization utility.'],
  ['ronak-create/FableCut', 'A browser video editor that AI agents can drive.'],
  ['littledivy/mimic', 'Intercept any app, then call it from Python like a library.'],
  ['floodtide/dom-docx', 'Convert semantic HTML to native editable Word documents.'],
  ['example/local-llm', 'A desktop GUI app for private local LLM inference.'],
];

test('过滤明确的底层项目', () => {
  for (const [repo, description] of LOW_LEVEL_CASES) {
    assert.ok(lowLevelReason({ repo, description }), `${repo} 应被判定为底层项目`);
  }
});

test('保留能直接完成任务的应用和开发者工具', () => {
  for (const [repo, description] of APPLICATION_CASES) {
    assert.equal(lowLevelReason({ repo, description }), '', `${repo} 不应被误过滤`);
  }
});

test('应用项目在降级排序中优先于框架和 SDK', () => {
  const app = { repo: 'example/app', description: 'A self-hosted desktop app to manage invoices.' };
  const framework = { repo: 'example/framework', description: 'A framework and SDK for semantic metadata.' };
  assert.ok(applicationPreferenceScore(app) > applicationPreferenceScore(framework));
});

test('统一过滤函数保持剩余项目原始顺序', () => {
  const projects = [
    { repo: 'example/editor', description: 'A desktop video editor.' },
    { repo: 'example/compiler', description: 'An ahead-of-time compiler and language runtime.' },
    { repo: 'example/dashboard', description: 'A self-hosted monitoring dashboard.' },
  ];
  assert.deepEqual(filterRecommendedProjects(projects).map((item) => item.repo), [
    'example/editor',
    'example/dashboard',
  ]);
});
