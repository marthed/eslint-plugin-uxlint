import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const AUTOPLAY = "MEDIA-AUTOPLAY-001";

function lintIds(code: string): string[] {
  return warningIds(lintWithApplyRule(code));
}

serialTest("reports audible autoplay with no controls", () => {
  const code = `const ui = <video autoPlay src="/intro.mp4" />;`;
  assert.deepEqual(lintIds(code), [AUTOPLAY]);
});

serialTest("reports an autoplaying audio element", () => {
  const code = `const ui = <audio autoPlay src="/jingle.mp3" />;`;
  assert.deepEqual(lintIds(code), [AUTOPLAY]);
});

serialTest("accepts autoplay with native controls", () => {
  const code = `const ui = <video autoPlay controls src="/intro.mp4" />;`;
  assert.deepEqual(lintIds(code), []);
});

// Muted background video makes no sound, which is the case the rule is about.
serialTest("accepts muted background video", () => {
  const code = `const ui = <video autoPlay muted loop playsInline src="/bg.mp4" />;`;
  assert.deepEqual(lintIds(code), []);
});

serialTest("reports a component that auto-rotates with no pause", () => {
  const code = `
    function Hero() {
      return <Carousel autoPlay slides={slides} />;
    }
  `;
  assert.deepEqual(lintIds(code), [AUTOPLAY]);
});

serialTest("accepts an auto-rotating component with a pause control", () => {
  const code = `
    import React from "react";

    function Hero() {
      const [paused, setPaused] = React.useState(false);

      return (
        <div>
          <Carousel autoPlay paused={paused} slides={slides} />
          <button onClick={() => setPaused(!paused)}>Pause</button>
        </div>
      );
    }
  `;
  assert.deepEqual(lintIds(code), []);
});

serialTest("ignores an explicitly disabled autoplay", () => {
  const code = `const ui = <video autoPlay="false" src="/intro.mp4" />;`;
  assert.deepEqual(lintIds(code), []);
});
