import test from 'node:test';
import assert from 'node:assert/strict';
import { magneticDeclination, orientationHeading, headingDifference } from '../dist/compass.js';
test('compass headings follow Earth axes, screen rotation and the short turn across north', () => {
  assert.equal(orientationHeading(270), 90);
  assert.ok(Math.abs(orientationHeading(0, 20, 10)) < .00001);
  assert.equal(orientationHeading(0, 0, 0, 90), 90);
  assert.equal(orientationHeading(0, 90), undefined);
  assert.equal(headingDifference(1, 359), 2);
  assert.equal(headingDifference(359, 1), -2);
  const declination = magneticDeclination(-37.74, 144.97, new Date('2026-09-18'));
  assert.ok(declination > 10 && declination < 13, 'Melbourne has an east magnetic correction');
  assert.equal(magneticDeclination(-37.74, 144.97, new Date('2050-01-01')), undefined);
});
