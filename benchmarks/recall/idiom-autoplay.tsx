// expect: MEDIA-AUTOPLAY-001, MEDIA-AUTOPLAY-001
// Audible video the user did not start and cannot stop, and a carousel that
// rotates on its own with no pause control.
import React from "react";

export function BadVideo() {
  return <video autoPlay src="/intro.mp4" />;
}

export function BadCarousel() {
  return <Carousel autoPlay slides={["a", "b"]} />;
}

export function GoodVideo() {
  return <video autoPlay muted loop playsInline src="/background.mp4" />;
}

export function GoodCarousel() {
  const [paused, setPaused] = React.useState(false);

  return (
    <div>
      <Carousel autoPlay paused={paused} slides={["a", "b"]} />
      <button onClick={() => setPaused(!paused)}>Pause</button>
    </div>
  );
}
