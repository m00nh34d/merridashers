(function () {
  "use strict";

  /*
   * Per-clip tuning. All effect values are multipliers where 1 = the default
   * look, 0 = off, and 2 = twice as strong. luma is measured source brightness
   * and drives the automatic grading, so normally leave it alone.
   *
   *   shake    - handheld jitter amount
   *   cuts     - frequency of rips/tears and strength of the cut flashes
   *   grain    - opacity of the moving film grain
   *   grime    - dust/scratches/dragged flecks
   *   blotches - large dark dirt patches
   *   stripes  - fast motion streaks and banding
   */
  const videos = [
    {
      src: "bg/3048876-sd_426_240_24fps.mp4", luma: 157,
      shake: 2, cuts: 1, grain: 1.1, grime: 1.3, blotches: 1.2, stripes: 1
    },
    {
      src: "bg/3209242-sd_426_240_25fps.mp4", luma: 87,
      shake: 2, cuts: 1.4, grain: 1, grime: 0.9, blotches: 0.8, stripes: 1.1
    },
    {
      src: "bg/6573724-sd_426_240_24fps.mp4", luma: 65,
      shake: 0.8, cuts: 0.7, grain: 0.9, grime: 0.5, blotches: 0.4, stripes: 0.9
    },
    {
      src: "bg/7877205-sd_426_226_25fps.mp4", luma: 101,
      shake: 1.2, cuts: 1.8, grain: 1, grime: 1, blotches: 0.9, stripes: 1.3
    },
    {
      src: "bg/8520623-sd_426_176_25fps.mp4", luma: 99,
      shake: 2, cuts: 0.5, grain: 1.3, grime: 0.35, blotches: 0.3, stripes: 0.8
    },
    {
      src: "bg/8533442-sd_426_240_25fps.mp4", luma: 83,
      shake: 2, cuts: 1.5, grain: 1, grime: 1.1, blotches: 0.8, stripes: 1.2
    }
  ];

  // Every clip is graded toward the same on-screen brightness. Dark sources are
  // lifted and bright sources are pulled down, so the page stays dark but legible.
  const TARGET_LUMA = 105;
  const MIN_BRIGHT = 0.34;
  const MAX_BRIGHT = 1.5;
  const TRANSITION_LEAD_SECONDS = 1.4;
  const TRANSITION_DURATION_MS = 1200;

  const stage = document.querySelector(".stage");
  const videoA = document.getElementById("bg-video-a");
  const videoB = document.getElementById("bg-video-b");
  const sliceVideo = document.getElementById("slice-video");
  const grainCanvas = document.getElementById("grain");
  const grainCtx = grainCanvas.getContext("2d");
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = 32;
  sampleCanvas.height = 18;
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let activePlayer = videoA;
  let inactivePlayer = videoB;
  let currentIndex = -1;
  let nextIndex = -1;
  let isTransitioning = false;
  let waitingForNext = false;
  let measuredLuma = null;

  function brightnessFor(luma) {
    const value = TARGET_LUMA / Math.max(luma, 5);
    return Math.min(MAX_BRIGHT, Math.max(MIN_BRIGHT, value));
  }

  function setBrightness(player, luma) {
    player.style.setProperty("--bright", brightnessFor(luma).toFixed(3));
  }

  function applyClipSettings(index) {
    const settings = videos[index];
    ["shake", "cuts", "grain", "grime", "blotches", "stripes"].forEach(function (name) {
      stage.style.setProperty("--" + name, String(settings[name]));
    });
  }

  function pickDifferentIndex(excludeIndex) {
    if (videos.length === 1) return 0;
    let index = excludeIndex;
    while (index === excludeIndex) {
      index = Math.floor(Math.random() * videos.length);
    }
    return index;
  }

  function isReady(player) {
    return !!player && player.readyState >= 2 && player.videoWidth > 0 && !player.error;
  }

  function configurePlayer(player) {
    player.muted = true;
    player.defaultMuted = true;
    player.playsInline = true;
    player.setAttribute("muted", "");
    player.setAttribute("playsinline", "");
    player.setAttribute("webkit-playsinline", "");
    player.preload = "auto";
  }

  function safePlay(player) {
    const promise = player.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(function () {
        player.muted = true;
        player.play().catch(function () {});
      });
    }
  }

  function preparePlayer(player, index) {
    if (player.dataset.index === String(index) && isReady(player)) return;
    player.dataset.index = String(index);
    setBrightness(player, videos[index].luma);
    player.src = encodeURI(videos[index].src);
    player.load();
  }

  function prepareNextVideo() {
    nextIndex = pickDifferentIndex(currentIndex);
    preparePlayer(inactivePlayer, nextIndex);
  }

  function transitionToNext() {
    if (isTransitioning || waitingForNext || nextIndex < 0) return;

    if (!isReady(inactivePlayer)) {
      if (!waitingForNext) {
        waitingForNext = true;
        let attempts = 0;
        // Keep the current clip alive rather than exposing a black frame.
        const waitForReady = window.setInterval(function () {
          attempts += 1;
          if (!isTransitioning && isReady(inactivePlayer)) {
            window.clearInterval(waitForReady);
            waitingForNext = false;
            transitionToNext();
          } else if (attempts > 75) {
            window.clearInterval(waitForReady);
            waitingForNext = false;
            prepareNextVideo();
          }
        }, 200);
        try {
          activePlayer.currentTime = 0;
          safePlay(activePlayer);
        } catch (ignored) {}
      }
      return;
    }

    isTransitioning = true;
    measuredLuma = null;
    applyClipSettings(nextIndex);
    setBrightness(inactivePlayer, videos[nextIndex].luma);
    try {
      inactivePlayer.currentTime = 0;
    } catch (ignored) {}
    safePlay(inactivePlayer);

    inactivePlayer.classList.add("is-active");
    activePlayer.classList.remove("is-active");
    activePlayer.classList.add("is-leaving");

    const outgoing = activePlayer;
    window.setTimeout(function () {
      outgoing.classList.remove("is-leaving");
      outgoing.pause();
      outgoing.removeAttribute("src");
      outgoing.load();
      delete outgoing.dataset.index;

      activePlayer = inactivePlayer;
      inactivePlayer = outgoing;
      currentIndex = nextIndex;
      isTransitioning = false;
      prepareNextVideo();
    }, TRANSITION_DURATION_MS);
  }

  function sampleLuminance() {
    if (!isReady(activePlayer) || isTransitioning) return;
    try {
      sampleCtx.drawImage(activePlayer, 0, 0, sampleCanvas.width, sampleCanvas.height);
      const pixels = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
      let total = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        total += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      }
      const luma = total / (pixels.length / 4);
      if (luma < 3) return;
      measuredLuma = measuredLuma === null ? luma : measuredLuma * 0.7 + luma * 0.3;
      setBrightness(activePlayer, measuredLuma);
    } catch (ignored) {
      // Cross-origin restriction: keep the measured-per-file fallback.
    }
  }

  function resizeGrain() {
    const pixelSize = window.innerWidth < 700 ? 1.5 : 2;
    const width = Math.ceil(window.innerWidth / pixelSize) + 12;
    const height = Math.ceil(window.innerHeight / pixelSize) + 12;
    if (grainCanvas.width === width && grainCanvas.height === height) return;
    grainCanvas.width = width;
    grainCanvas.height = height;
  }

  function drawGrain() {
    const width = grainCanvas.width;
    const height = grainCanvas.height;
    grainCtx.clearRect(0, 0, width, height);

    // Irregular clumps of grain, with a few dragged into horizontal smears.
    const count = Math.floor((width * height) / 20);
    for (let i = 0; i < count; i += 1) {
      const value = 55 + ((Math.random() * 200) | 0);
      const alpha = 0.1 + Math.random() * 0.55;
      grainCtx.fillStyle = "rgba(" + value + "," + value + "," + value + "," + alpha.toFixed(2) + ")";
      const size = Math.random() < 0.14 ? 2 + Math.random() * 4 : 1 + Math.random() * 1.6;
      grainCtx.fillRect(Math.random() * width, Math.random() * height, size, size);
    }

    const smears = Math.floor(count / 90);
    for (let i = 0; i < smears; i += 1) {
      grainCtx.fillStyle = "rgba(255,255,255," + (0.06 + Math.random() * 0.14).toFixed(2) + ")";
      grainCtx.fillRect(Math.random() * width, Math.random() * height, 10 + Math.random() * 55, 1);
    }
  }

  function scheduleRip() {
    const cuts = videos[currentIndex] ? videos[currentIndex].cuts : 1;
    const delay = (3200 + Math.random() * 4200) / Math.max(cuts, 0.1);
    window.setTimeout(triggerRip, delay);
  }

  function runRip() {
    sliceVideo.style.setProperty("--bright", activePlayer.style.getPropertyValue("--bright") || "0.8");
    sliceVideo.style.setProperty("--rip-top", (8 + Math.random() * 62).toFixed(1) + "%");
    sliceVideo.style.setProperty("--rip-bottom", (8 + Math.random() * 32).toFixed(1) + "%");
    try {
      sliceVideo.currentTime = activePlayer.currentTime;
    } catch (ignored) {}
    safePlay(sliceVideo);
    sliceVideo.classList.remove("is-ripping");
    void sliceVideo.offsetWidth;
    sliceVideo.classList.add("is-ripping");
    window.setTimeout(function () {
      sliceVideo.classList.remove("is-ripping");
      sliceVideo.pause();
    }, 620);
    scheduleRip();
  }

  function triggerRip() {
    if (!isReady(activePlayer) || isTransitioning) {
      scheduleRip();
      return;
    }

    const source = activePlayer.currentSrc;
    if (sliceVideo.dataset.src === source && isReady(sliceVideo)) {
      runRip();
      return;
    }

    const onError = function () {
      sliceVideo.removeEventListener("loadeddata", onReady);
      sliceVideo.removeEventListener("error", onError);
      scheduleRip();
    };
    const onReady = function () {
      sliceVideo.removeEventListener("loadeddata", onReady);
      sliceVideo.removeEventListener("error", onError);
      runRip();
    };

    sliceVideo.dataset.src = source;
    sliceVideo.src = source;
    sliceVideo.addEventListener("loadeddata", onReady);
    sliceVideo.addEventListener("error", onError);
    sliceVideo.load();
  }

  videoA.addEventListener("timeupdate", function () {
    if (activePlayer !== videoA || isTransitioning) return;
    if (Number.isFinite(videoA.duration) && videoA.duration - videoA.currentTime <= TRANSITION_LEAD_SECONDS) {
      transitionToNext();
    }
  });

  videoB.addEventListener("timeupdate", function () {
    if (activePlayer !== videoB || isTransitioning) return;
    if (Number.isFinite(videoB.duration) && videoB.duration - videoB.currentTime <= TRANSITION_LEAD_SECONDS) {
      transitionToNext();
    }
  });

  [videoA, videoB].forEach(function (player) {
    configurePlayer(player);

    player.addEventListener("ended", function () {
      if (player === activePlayer) transitionToNext();
    });

    player.addEventListener("error", function () {
      if (player === inactivePlayer) {
        prepareNextVideo();
      } else if (player === activePlayer) {
        isTransitioning = false;
        prepareNextVideo();
        window.setTimeout(transitionToNext, 200);
      }
    });
  });

  configurePlayer(sliceVideo);
  resizeGrain();
  drawGrain();

  window.addEventListener("resize", function () {
    resizeGrain();
    drawGrain();
  });

  if (!reduceMotion) {
    window.setInterval(drawGrain, 80);
    window.setInterval(sampleLuminance, 600);
    scheduleRip();
  }

  currentIndex = pickDifferentIndex(-1);
  applyClipSettings(currentIndex);
  preparePlayer(activePlayer, currentIndex);
  activePlayer.classList.add("is-active");
  safePlay(activePlayer);
  prepareNextVideo();
})();
