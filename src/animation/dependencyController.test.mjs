import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnimationMixer, AnimationClip, NumberKeyframeTrack, Object3D } from 'three';
import { createDependencyController, parseAnimationName } from './dependencyController.js';

function fixture(names) {
  const root = new Object3D();
  const mixer = new AnimationMixer(root);
  const actions = Object.fromEntries(names.map((name, i) => {
    const object = new Object3D();
    object.name = `part_${i}`;
    root.add(object);
    return [name, mixer.clipAction(new AnimationClip(name, 1.25, [
      new NumberKeyframeTrack(`${object.name}.position[x]`, [0, 1.25], [0, 1]),
    ]))];
  }));
  const warnings = [];
  const controller = createDependencyController(mixer, actions, message => warnings.push(message));
  const step = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
    mixer.update(1.3);
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  return { mixer, actions, controller, warnings, step };
}

test('parses original model naming and preserves numeric identifiers', () => {
  assert.deepEqual(parseAnimationName('out.grid.requires.door'), {
    id: 'grid', requirements: ['door'], invalid: false,
  });
  assert.equal(parseAnimationName('out.drawer_01.requires.door_left').id, 'drawer_01');
});

test('opens prerequisite first, closes drawer first, rejects overlapping clicks', async () => {
  const { controller, actions, step } = fixture(['door.open', 'out.grid.requires.door']);
  const opening = controller.toggle('out.grid.requires.door');
  assert.equal(await controller.toggle('door.open'), false);
  await step();
  assert.equal(actions['door.open'].time, 1.25);
  assert.equal(actions['out.grid.requires.door'].time, 0);
  await step();
  assert.equal(await opening, true);
  const closing = controller.toggle('door.open');
  await step();
  assert.equal(actions['out.grid.requires.door'].time, 0);
  assert.equal(actions['door.open'].time, 1.25);
  await step();
  assert.equal(await closing, true);
  assert.equal(actions['door.open'].time, 0);
  controller.dispose();
});

test('independent doors can open concurrently', async () => {
  const { controller, actions, step } = fixture([
    'door_left.open', 'out.drawer_left.requires.door_left',
    'door_right.open', 'out.drawer_right.requires.door_right',
  ]);
  const left = controller.toggle('out.drawer_left.requires.door_left');
  const right = controller.toggle('out.drawer_right.requires.door_right');
  await step();
  await step();
  assert.equal(await left, true);
  assert.equal(await right, true);
  const close = controller.toggle('door_left.open');
  await step();
  await step();
  await close;
  assert.equal(actions['door_right.open'].time, 1.25);
  assert.equal(actions['out.drawer_right.requires.door_right'].time, 1.25);
  controller.dispose();
});

test('missing, ambiguous, and cyclic dependencies are disabled', async () => {
  for (const names of [
    ['out.grid.requires.absent'],
    ['door.open', 'out.door', 'out.grid.requires.door'],
    ['out.a.requires.b', 'out.b.requires.a'],
  ]) {
    const { controller, warnings } = fixture(names);
    assert.equal(warnings.length, 1);
    assert.equal(await controller.toggle(names[0]), false);
    controller.dispose();
  }
});

test('legacy clips remain interactive and dispose cancels pending sequences', async () => {
  const { controller, step } = fixture(['LegacyAnimation']);
  const open = controller.toggle('LegacyAnimation');
  await step();
  assert.equal(await open, true);
  const close = controller.toggle('LegacyAnimation');
  await Promise.resolve();
  controller.dispose();
  assert.equal(await close, false);
});

test('shared prerequisites and nested dependents finish without duplicate playback', async () => {
  const { controller, step } = fixture([
    'door.open', 'out.a.requires.door', 'out.b.requires.door',
    'out.tray.requires.a.requires.b',
  ]);
  const open = controller.toggle('out.tray.requires.a.requires.b');
  await step();
  await step();
  await step();
  assert.equal(await open, true);
  const close = controller.toggle('door.open');
  await step();
  await step();
  await step();
  assert.equal(await close, true);
  controller.dispose();
});
