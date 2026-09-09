(function () {
  const root = document.getElementById('home-companion');
  if (!root) return;

  const sprite = root.querySelector('.mascot-sprite');
  const bubble = root.querySelector('.companion-bubble');
  const bubbleText = root.querySelector('.companion-bubble-text');
  const button = root.querySelector('.companion-character');

  const poses = ['idle', 'guide', 'peek', 'sit', 'walk', 'think', 'sleep', 'work'];
  const poseMessages = {
    idle: '',
    guide: '你好，欢迎来到我的主页。',
    peek: '随便看看，不用拘谨。',
    sit: '这里放一些零散想法。',
    walk: '',
    think: '我也会在这里发会儿呆。',
    sleep: '……',
    work: '这里是项目、论文和长文。'
  };

  let state = 'idle';
  let bubbleTimer = null;
  let ambientTimer = null;
  let sleepTimer = null;
  let hoverLocked = false;
  let cycleIndex = 0;

  function setPose(next, message, options = {}) {
    if (!poses.includes(next)) next = 'idle';
    state = next;
    root.dataset.pose = next;
    sprite.className = 'mascot-sprite pose-' + next;
    root.classList.toggle('is-walking', next === 'walk');
    root.classList.toggle('is-peeking', next === 'peek');
    root.classList.toggle('is-sleeping', next === 'sleep');

    clearTimeout(bubbleTimer);

    const text = message == null ? poseMessages[next] : message;
    if (text) {
      bubbleText.textContent = text;
      bubble.classList.add('visible');
      bubbleTimer = setTimeout(() => {
        if (!options.keepBubble) bubble.classList.remove('visible');
      }, options.duration || 3200);
    } else {
      bubble.classList.remove('visible');
    }
  }

  function wake() {
    clearTimeout(sleepTimer);
    if (state === 'sleep' && !hoverLocked) setPose('idle');
    sleepTimer = setTimeout(() => {
      if (!hoverLocked) setPose('sleep', '……', { duration: 1800 });
    }, 26000);
  }

  function scheduleAmbient() {
    clearTimeout(ambientTimer);
    ambientTimer = setTimeout(() => {
      if (hoverLocked || state === 'sleep') {
        scheduleAmbient();
        return;
      }

      const ambient = ['think', 'walk', 'peek', 'sit', 'work', 'idle'];
      const next = ambient[Math.floor(Math.random() * ambient.length)];
      setPose(next);

      const hold = next === 'walk' ? 2600 : 3600;
      setTimeout(() => {
        if (!hoverLocked && state === next) setPose('idle');
      }, hold);

      scheduleAmbient();
    }, 8000 + Math.random() * 6500);
  }

  function bindTarget(selector, pose, message) {
    const el = document.querySelector(selector);
    if (!el) return;

    el.addEventListener('mouseenter', () => {
      hoverLocked = true;
      setPose(pose, message, { duration: 5200 });
    });

    el.addEventListener('mouseleave', () => {
      hoverLocked = false;
      setTimeout(() => {
        if (!hoverLocked) setPose('idle');
      }, 500);
    });

    el.addEventListener('focusin', () => {
      hoverLocked = true;
      setPose(pose, message, { duration: 5200 });
    });

    el.addEventListener('focusout', () => {
      hoverLocked = false;
      setPose('idle');
    });
  }

  button.addEventListener('click', () => {
    wake();
    cycleIndex = (cycleIndex + 1) % poses.length;
    const next = poses[cycleIndex];
    setPose(next, poseMessages[next] || '我还在这儿。', { duration: 2200 });
  });

  ['pointerdown', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, wake, { passive: true });
  });

  bindTarget('.profile-card', 'peek', '这里是关于我的基本信息。');
  bindTarget('.cards .card[href="thoughts.html"]', 'sit', '这里放一些零散的思考与灵感。');
  bindTarget('.cards .card[href="works.html"]', 'work', '项目、论文和长文都在这里。');

  window.addEventListener('load', () => {
    setTimeout(() => {
      setPose('guide', '你好，欢迎来到我的主页。', { duration: 3600 });
      setTimeout(() => {
        if (!hoverLocked && state === 'guide') setPose('idle');
      }, 3900);
    }, 500);
  });

  wake();
  scheduleAmbient();
})();