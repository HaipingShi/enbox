const assert = require('node:assert/strict');
const { DEFAULT_SYSTEM_PROMPT, LEGACY_SYSTEM_PROMPT, PREVIOUS_SYSTEM_PROMPT, upgradeSystemPrompt, translationTarget, buildTranslationPrompt } = require('../lib/translation');

for (const old of [LEGACY_SYSTEM_PROMPT, PREVIOUS_SYSTEM_PROMPT, undefined]) {
  assert.equal(upgradeSystemPrompt(old), DEFAULT_SYSTEM_PROMPT);
}
assert.equal(upgradeSystemPrompt('Use concise business language.'), 'Use concise business language.');
for (const [input, expected] of [
  ['This makes the window available across Spaces.', 'zh'],
  ['Configure workspace visibility once: repeatedly toggling it can temporarily hide windows.', 'zh'],
  ['请帮我修复窗口拖动的问题。', 'en'],
  ['請修復這個問題。', 'en'],
  ['请修复 Electron BrowserWindow 的 bug', 'en'],
  ['Bonjour, comment allez-vous ?', 'zh'],
  ['今日は良い天気です。', 'zh'],
  ['이 창을 고쳐 주세요.', 'zh'],
]) {
  assert.equal(translationTarget(input), expected, input);
  for (const saved of [LEGACY_SYSTEM_PROMPT, PREVIOUS_SYSTEM_PROMPT, 'Always polish English. Use concise language.']) {
    const prompt = buildTranslationPrompt(saved, input);
    assert.ok(prompt.includes(expected === 'zh' ? '外语全文翻译成简体中文' : '中文翻译成自然的英文'));
    assert.ok(!prompt.includes(expected === 'zh' ? '本次翻译任务（优先于上述偏好）：\n将用户提供的中文' : '本次翻译任务（优先于上述偏好）：\n将用户提供的外语'));
  }
}
const custom = buildTranslationPrompt('Always polish English. Use concise language.', 'Hello');
assert.ok(custom.includes('Always polish English. Use concise language.'));
assert.ok(custom.indexOf('本次翻译任务') > custom.indexOf('Always polish English.'));
console.log('✅ Translation direction and saved-prompt migration tests passed');
