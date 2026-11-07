import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kneeFlexion, torsoLean } from './angles.ts';

const L = (x: number, y: number, visibility = 1) => ({ x, y, visibility });

test('straight leg is 0° flexion', () => {
  assert.equal(kneeFlexion(L(0.5, 0.2), L(0.5, 0.5), L(0.5, 0.8), 100, 100), 0);
});

test('right angle at knee is 90° flexion', () => {
  assert.equal(Math.round(kneeFlexion(L(0.2, 0.5), L(0.5, 0.5), L(0.5, 0.8), 100, 100)!), 90);
});

test('uses pixel space, not normalized space', () => {
  // Square in pixels only when the 2:1 aspect is applied.
  assert.equal(Math.round(kneeFlexion(L(0.25, 0.5), L(0.5, 0.5), L(0.5, 1), 200, 100)!), 90);
});

test('low visibility or missing joint yields null', () => {
  assert.equal(kneeFlexion(L(0.5, 0.2, 0.4), L(0.5, 0.5), L(0.5, 0.8), 100, 100), null);
  assert.equal(kneeFlexion(null, L(0.5, 0.5), L(0.5, 0.8), 100, 100), null);
});

test('torso lean from vertical', () => {
  assert.equal(torsoLean(L(0.5, 0.5), L(0.5, 0.2), 100, 100), 0);
  assert.equal(Math.round(torsoLean(L(0.5, 0.5), L(0.8, 0.2), 100, 100)), 45);
});
