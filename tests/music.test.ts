import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ZoneGate,
  zoneAt,
  frequency,
  extension,
  duration,
  CHORDS,
} from "../src/lib/music.ts";
test("mirrored hand zones include edges and clamp noise", () => {
  assert.deepEqual(
    [-0.1, 0, 0.249, 0.25, 0.5, 0.75, 1, 1.1].map(zoneAt),
    [0, 0, 0, 1, 2, 3, 3, 3],
  );
});
test("zone dwell suppresses jitter and retriggers after hand leaves", () => {
  const g = new ZoneGate();
  assert.equal(g.update(0, 0), null);
  assert.equal(g.update(0, 179), null);
  assert.equal(g.update(0, 180), 0);
  assert.equal(g.update(0, 600), null);
  assert.equal(g.update(1, 610), null);
  assert.equal(g.update(0, 650), null);
  assert.equal(g.update(1, 700), null);
  assert.equal(g.update(1, 880), 1);
  g.update(null, 900);
  g.update(1, 1000);
  assert.equal(g.update(1, 1180), 1);
});
test("chord voicings and concert pitch", () => {
  assert.equal(frequency(69), 440);
  assert.equal(frequency(57), 220);
  assert.deepEqual(
    CHORDS.map((c) => c.name),
    ["C", "Am", "F", "G"],
  );
});
test("recording extension matches Safari and Chromium formats", () => {
  assert.equal(extension("video/mp4"), "mp4");
  assert.equal(extension("audio/mp4;codecs=mp4a.40.2"), "mp4");
  assert.equal(extension("audio/webm;codecs=opus"), "webm");
  assert.equal(duration(180), "3:00");
  assert.equal(duration(9.5), "0:09");
});
