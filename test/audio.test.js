// 음악(CHM-29): 가짜 오디오에서 곡 넷 × 층 0~4를 한 바퀴씩 예약해도 예외가 없는지, 화면에 따라 곡과 층이 바뀌는지
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDom } from '../tools/fakedom.mjs';
import { createAudio } from '../src/audio/audio.js';

const fresh = () => {
  const dom = makeFakeDom();
  const audio = createAudio(dom.window, { strict: true });
  audio.unlock();
  return { dom, audio };
};

test('곡 넷 × 층 0~4를 한 바퀴씩 예약해도 예외가 없다', () => {
  const { dom, audio } = fresh();
  assert.deepEqual([...audio.tracks].sort(), ['battle', 'master', 'shop', 'title']);
  for (const name of audio.tracks) {
    const loop = audio.loopSeconds(name);
    assert.ok(loop >= 15, `${name} 한 바퀴 ${loop.toFixed(1)}초`); // 너무 짧게 되풀이하지 않게
    for (let L = 0; L <= 4; L++) {
      const before = dom.audioCalls.nodes;
      assert.equal(audio.renderMusic(name, L, loop + 0.5), true);
      assert.ok(dom.audioCalls.nodes > before, `${name} 층 ${L}에서 소리가 난다`);
    }
  }
});

test('층이 높을수록 소리가 두꺼워진다', () => {
  for (const name of ['battle', 'master']) {
    const counts = [];
    for (let L = 0; L <= 4; L++) {
      const { dom, audio } = fresh();
      audio.renderMusic(name, L, audio.loopSeconds(name));
      counts.push(dom.audioCalls.nodes);
    }
    for (let L = 1; L <= 4; L++) assert.ok(counts[L] > counts[L - 1], `${name} 층 ${L}: ${counts.join(' · ')}`);
  }
});

test('화면에 따라 곡과 층을 고른다', () => {
  const { audio } = fresh();
  const at = (name, extra = {}) => { audio.update(0.016, { screen: { name, ...extra } }); return audio.music; };
  assert.deepEqual(at('title'), { track: 'title', layers: 1 });
  assert.deepEqual(at('shop'), { track: 'shop', layers: 2 });
  const chain = (n) => ({ view: { chain: { path: new Array(n + 1).fill(0) } } });
  assert.deepEqual(at('battle', chain(0)), { track: 'battle', layers: 0 });
  assert.deepEqual(at('battle', chain(6)), { track: 'battle', layers: 4 });
  assert.deepEqual(at('legend'), { track: 'battle', layers: 1 });
  assert.deepEqual(at('battle', { b: { kind: 'master' }, ...chain(0) }), { track: 'master', layers: 1 });
  assert.deepEqual(at('battle', { b: { kind: 'master' }, ...chain(4) }), { track: 'master', layers: 3 });
  assert.deepEqual(at('result'), { track: 'title', layers: 1 });
});

test('음악을 끄면 예약하지 않고, 효과음은 그대로 난다', () => {
  const { dom, audio } = fresh();
  audio.apply({ volume: 0.6, music: 0 });
  audio.update(0.016, { screen: { name: 'title' } });
  const n = dom.audioCalls.nodes;
  audio.update(0.016, { screen: { name: 'title' } });
  assert.equal(dom.audioCalls.nodes, n);
  audio.play('capture', 3);
  assert.ok(dom.audioCalls.nodes > n);
});
