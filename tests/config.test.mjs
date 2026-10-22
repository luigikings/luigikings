import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../config/profile.json', import.meta.url), 'utf8'));

test('config/profile.json tiene la forma del plan', () => {
  assert.equal(cfg.githubUser, 'luigikings');
  assert.equal(cfg.youtube.handle, '@lk_rl');
  assert.equal(typeof cfg.youtube.channelId, 'string');
  assert.equal(cfg.youtube.count, 3);
  assert.equal(cfg.youtube.shortsMaxSeconds, 180);
  assert.equal(cfg.youtube.titleMaxChars, 60);
  assert.equal(cfg.youtube.premiereMaxGapSeconds, 300);
  assert.deepEqual(cfg.languages.exclude, ['HTML', 'CSS', 'SCSS', 'Sass', 'Less', 'Markdown', 'MDX']);
  assert.equal(cfg.languages.max, 6);
});
