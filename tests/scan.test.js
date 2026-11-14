import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  appFormat, pickMainBackCamera, createFrameVoter, pickConfirmedRead, CAMERA_CONSTRAINTS, NATIVE_FORMATS, ZXING_FORMATS,
} from '../src/lib/camera.js';

const cam = (deviceId, label) => ({ kind: 'videoinput', deviceId, label });

describe('camera choice', () => {
  test('Samsung-style labels: switch from the ultra-wide to "camera2 0" (main lens)', () => {
    const devices = [
      cam('front', 'camera2 1, facing front'),
      cam('main', 'camera2 0, facing back'),
      cam('uw', 'camera2 2, facing back'),
      cam('tele', 'camera2 3, facing back'),
      { kind: 'audioinput', deviceId: 'mic', label: 'Microphone' },
    ];
    assert.equal(pickMainBackCamera(devices, 'uw'), 'main');
    assert.equal(pickMainBackCamera(devices, 'main'), null); // already on the main lens
  });

  test('descriptive labels: avoid ultra-wide / telephoto / depth lenses', () => {
    const devices = [cam('a', 'Back Ultra Wide Camera'), cam('b', 'Back Camera'), cam('c', 'Back Telephoto Camera')];
    assert.equal(pickMainBackCamera(devices, 'a'), 'b');
  });

  test('one back camera, or no labels (no permission yet): keep the current one', () => {
    assert.equal(pickMainBackCamera([cam('x', 'camera2 0, facing back'), cam('y', 'camera2 1, facing front')], 'x'), null);
    assert.equal(pickMainBackCamera([cam('x', ''), cam('y', '')], 'x'), null);
  });

  test('constraints ask for the back camera, high resolution and continuous focus', () => {
    assert.deepEqual(CAMERA_CONSTRAINTS.video.facingMode, { ideal: 'environment' });
    assert.equal(CAMERA_CONSTRAINTS.video.width.ideal, 1920);
    assert.deepEqual(CAMERA_CONSTRAINTS.video.advanced, [{ focusMode: 'continuous' }]);
  });
});

describe('misread protection', () => {
  test('live camera: the same code must be read in two frames within 1.5 s', () => {
    const vote = createFrameVoter({ needed: 2, windowMs: 1500 });
    assert.equal(vote('5941234567892', 0), false);
    assert.equal(vote('2422372593962', 100), false); // a stray misread
    assert.equal(vote('5941234567892', 200), true);
  });

  test('live camera: reads too far apart do not count', () => {
    const vote = createFrameVoter({ needed: 2, windowMs: 1500 });
    assert.equal(vote('5941234567892', 0), false);
    assert.equal(vote('5941234567892', 2000), false);
    assert.equal(vote('5941234567892', 2100), true);
  });

  test('photos: two agreeing passes win over a single conflicting read', () => {
    // the case found in the benchmark: one pass misread, two passes agreed
    const reads = [
      { code: '2422372593962', plain: false },
      { code: '7470372593968', plain: false },
      { code: '7470372593968', plain: false },
    ];
    assert.equal(pickConfirmedRead(reads), '7470372593968');
  });

  test('photos: a single plain read is accepted only when nothing contradicts it', () => {
    assert.equal(pickConfirmedRead([{ code: '5941234567892', plain: true }]), '5941234567892');
    assert.equal(pickConfirmedRead([{ code: '5941234567892', plain: false }]), null);
    assert.equal(pickConfirmedRead([{ code: '5941234567892', plain: true }, { code: '2422372593962', plain: false }]), null);
    assert.equal(pickConfirmedRead([]), null);
  });
});

describe('format names', () => {
  test('native, zxing-wasm and app names map to one app format', () => {
    for (const f of ['ean_13', 'EAN13', 'EAN-13', 'EAN_13']) assert.equal(appFormat(f), 'EAN_13');
    assert.equal(appFormat('upc_e'), 'UPC_E');
    assert.equal(appFormat('UPCA'), 'UPC_A');
    assert.equal(appFormat('ean_8'), 'EAN_8');
    assert.equal(appFormat('qr_code'), null);
    assert.equal(NATIVE_FORMATS.length, ZXING_FORMATS.length);
  });
});
