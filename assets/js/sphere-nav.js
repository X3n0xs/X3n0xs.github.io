(function () {
  'use strict';

  var root = document.getElementById('sphere-nav');
  if (!root || typeof pannellum === 'undefined') return;

  var viewerEl = document.getElementById('sphere-nav-viewer');
  var instructions = document.getElementById('sphere-nav-instructions');
  var instructionsOk = document.getElementById('sphere-nav-instructions-ok');
  var blocker = document.getElementById('sphere-nav-blocker');
  var startBtn = document.getElementById('sphere-nav-start');
  var stopBtn = document.getElementById('sphere-nav-stop');
  var hint = document.getElementById('sphere-nav-hint');

  var isActive = false;
  var instructionsReady = false;
  var viewer = null;
  var currentScene = 0;
  var aimLoopId = null;

  var SECTIONS = [
    { label: 'Architecture', guide: 'portfolio', href: 'archi.html' },
    { label: 'Research', guide: 'notes', href: 'code.html#research' },
    { label: 'About', guide: 'profile', href: 'contacts.html' },
    { label: 'Journal', guide: 'read below', href: '#journal', scrollTarget: true },
    { label: '360° Tour', guide: 'immersive walk', href: 'archi.html' }
  ];

  var FACE_LAYOUTS = [
    { center: 0, tl: 1, tr: 2, bl: 3, br: 5, arrow: 4 },
    { center: 1, tl: 2, tr: 3, bl: 4, br: 5, arrow: 0 },
    { center: 2, tl: 3, tr: 4, bl: 5, br: 0, arrow: 1 },
    { center: 3, tl: 4, tr: 5, bl: 0, br: 1, arrow: 2 },
    { center: 4, tl: 5, tr: 0, bl: 1, br: 2, arrow: 3 },
    { center: 5, tl: 0, tr: 1, bl: 2, br: 3, arrow: 4 }
  ];

  var SCENE_ORIENT = [
    { yaw: 0, pitch: 0 },
    { yaw: 90, pitch: 0 },
    { yaw: 180, pitch: 0 },
    { yaw: -90, pitch: 0 },
    { yaw: 0, pitch: 82 },
    { yaw: 0, pitch: -82 }
  ];

  var CORNER_OFFSETS = {
    tl: { pitch: 14, yaw: -20 },
    tr: { pitch: 14, yaw: 20 },
    bl: { pitch: -14, yaw: -20 },
    br: { pitch: -14, yaw: 20 }
  };

  var PAN_MARGIN = { yaw: 34, pitch: 26 };
  var HFOV = 44;
  var GUIDE_BLEND = 0.56;

  document.body.classList.add('has-sphere-nav');

  var whitePano = (function () {
    var canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 2048, 1024);
    return canvas.toDataURL('image/jpeg', 0.9);
  })();

  function esc(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeYaw(delta) {
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  }

  function coordsToScreen(yaw, pitch) {
    if (!viewer) return null;

    var viewYaw = viewer.getYaw();
    var viewPitch = viewer.getPitch();
    var hfov = viewer.getHfov();
    var roll = viewer.getConfig().roll || 0;
    var canvas = viewer.getRenderer().getCanvas();
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;

    var hs = Math.sin(pitch * Math.PI / 180);
    var hc = Math.cos(pitch * Math.PI / 180);
    var ds = Math.sin(viewPitch * Math.PI / 180);
    var dc = Math.cos(viewPitch * Math.PI / 180);
    var g = Math.cos((-yaw + viewYaw) * Math.PI / 180);
    var dot = hs * ds + hc * g * dc;

    if (dot <= 0) return null;

    var l = Math.sin((-yaw + viewYaw) * Math.PI / 180);
    var k = Math.tan(hfov * Math.PI / 360);
    var sx = (-w / k) * l * hc / dot / 2;
    var sy = (-w / k) * (hs * dc - hc * g * ds) / dot / 2;
    var cr = Math.sin(roll * Math.PI / 180);
    var dr = Math.cos(roll * Math.PI / 180);
    var rx = sx * dr - sy * cr;
    var ry = sx * cr + sy * dr;
    var rect = canvas.getBoundingClientRect();

    return {
      x: rect.left + rx + w / 2,
      y: rect.top + ry + h / 2
    };
  }

  function screenAimDegrees(fromX, fromY, toX, toY) {
    var dx = toX - fromX;
    var dy = toY - fromY;
    return Math.atan2(dx, -dy) * (180 / Math.PI);
  }

  function navigate(section) {
    if (section.scrollTarget) {
      stopTour(true);
      var target = document.querySelector(section.href);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    window.location.href = section.href;
  }

  function guidePosition(orient, labelPitch, labelYaw) {
    var dPitch = labelPitch - orient.pitch;
    var dYaw = normalizeYaw(labelYaw - orient.yaw);
    var len = Math.sqrt(dPitch * dPitch + dYaw * dYaw);
    if (len < 0.5) {
      return { pitch: labelPitch + 9, yaw: labelYaw };
    }
    return {
      pitch: orient.pitch + dPitch * GUIDE_BLEND,
      yaw: orient.yaw + dYaw * GUIDE_BLEND
    };
  }

  function guideArrowMarkup(args, isEdge) {
    var cls = 'sphere-nav-guide__arrow' + (isEdge ? ' sphere-nav-guide__arrow--edge' : '');
    var targetAttr =
      args.targetScene !== undefined ? ' data-target-scene="' + args.targetScene + '"' : '';
    return (
      '<span class="sphere-nav-guide__stack">' +
      '<span class="' +
      cls +
      '" aria-hidden="true" data-from-yaw="' +
      args.fromYaw +
      '" data-from-pitch="' +
      args.fromPitch +
      '" data-to-yaw="' +
      args.toYaw +
      '" data-to-pitch="' +
      args.toPitch +
      '"' +
      targetAttr +
      '>' +
      '<svg class="sphere-nav-guide__svg" viewBox="0 0 48 56" focusable="false">' +
      '<path class="sphere-nav-guide__chev sphere-nav-guide__chev--1" d="M6 44 L24 26 L42 44"/>' +
      '<path class="sphere-nav-guide__chev sphere-nav-guide__chev--2" d="M6 32 L24 14 L42 32"/>' +
      '<path class="sphere-nav-guide__chev sphere-nav-guide__chev--3" d="M6 20 L24 2 L42 20"/>' +
      '</svg></span>' +
      '<span class="sphere-nav-guide__caption">' +
      esc(args.caption) +
      '</span></span>'
    );
  }

  function contentHotspot(id, labelPitch, labelYaw, sectionIndex) {
    var section = SECTIONS[sectionIndex];
    return {
      pitch: labelPitch,
      yaw: labelYaw,
      type: 'custom',
      cssClass: 'sphere-nav-item',
      id: id,
      createTooltipFunc: function (el, args) {
        el.innerHTML =
          '<span class="sphere-nav-item__stack">' +
          '<span class="sphere-nav-item__label">' +
          esc(args.label) +
          '</span>' +
          '<span class="sphere-nav-item__guide">' +
          esc(args.guide) +
          '</span></span>';
      },
      createTooltipArgs: {
        label: section.label,
        guide: section.guide
      },
      clickHandlerFunc: function () {
        if (!isActive) return;
        navigate(section);
      }
    };
  }

  function guideArrowHotspot(id, labelPitch, labelYaw, orient, sectionIndex) {
    var section = SECTIONS[sectionIndex];
    var pos = guidePosition(orient, labelPitch, labelYaw);
    return {
      pitch: pos.pitch,
      yaw: pos.yaw,
      type: 'custom',
      cssClass: 'sphere-nav-guide',
      id: id + '-guide',
      createTooltipFunc: function (el, args) {
        el.innerHTML = guideArrowMarkup(args, false);
      },
      createTooltipArgs: {
        fromYaw: pos.yaw,
        fromPitch: pos.pitch,
        toYaw: labelYaw,
        toPitch: labelPitch,
        caption: section.label
      }
    };
  }

  function edgeGuideHotspot(sceneIndex, orient, layout) {
    if (layout.arrow === layout.center) return null;
    var targetOrient = SCENE_ORIENT[layout.arrow];
    var targetSection = SECTIONS[layout.arrow];
    var blend = 0.56;
    var fromYaw =
      orient.yaw + normalizeYaw(targetOrient.yaw - orient.yaw) * blend;
    var fromPitch =
      orient.pitch + (targetOrient.pitch - orient.pitch) * blend;
    return {
      pitch: fromPitch,
      yaw: fromYaw,
      type: 'custom',
      cssClass: 'sphere-nav-guide sphere-nav-guide--edge',
      id: 'edge-guide',
      createTooltipFunc: function (el, args) {
        el.innerHTML = guideArrowMarkup(args, true);
      },
      createTooltipArgs: {
        fromYaw: fromYaw,
        fromPitch: fromPitch,
        toYaw: targetOrient.yaw,
        toPitch: targetOrient.pitch,
        targetScene: layout.arrow,
        caption: targetSection.label
      },
      clickHandlerFunc: function (_evt, args) {
        if (!isActive || !viewer) return;
        goToScene(args.targetScene);
      }
    };
  }

  function buildSceneConfig(sceneIndex) {
    var orient = SCENE_ORIENT[sceneIndex];
    var layout = FACE_LAYOUTS[sceneIndex];
    var centerPitch = orient.pitch;
    var centerYaw = orient.yaw;
    var tlPitch = orient.pitch + CORNER_OFFSETS.tl.pitch;
    var tlYaw = orient.yaw + CORNER_OFFSETS.tl.yaw;
    var trPitch = orient.pitch + CORNER_OFFSETS.tr.pitch;
    var trYaw = orient.yaw + CORNER_OFFSETS.tr.yaw;
    var blPitch = orient.pitch + CORNER_OFFSETS.bl.pitch;
    var blYaw = orient.yaw + CORNER_OFFSETS.bl.yaw;
    var brPitch = orient.pitch + CORNER_OFFSETS.br.pitch;
    var brYaw = orient.yaw + CORNER_OFFSETS.br.yaw;

    var hotSpots = [
      contentHotspot('c-center', centerPitch, centerYaw, layout.center),
      contentHotspot('c-tl', tlPitch, tlYaw, layout.tl),
      contentHotspot('c-tr', trPitch, trYaw, layout.tr),
      contentHotspot('c-bl', blPitch, blYaw, layout.bl),
      contentHotspot('c-br', brPitch, brYaw, layout.br),
      guideArrowHotspot('c-tl', tlPitch, tlYaw, orient, layout.tl),
      guideArrowHotspot('c-tr', trPitch, trYaw, orient, layout.tr),
      guideArrowHotspot('c-bl', blPitch, blYaw, orient, layout.bl),
      guideArrowHotspot('c-br', brPitch, brYaw, orient, layout.br)
    ];
    var edge = edgeGuideHotspot(sceneIndex, orient, layout);
    if (edge) hotSpots.push(edge);

    return {
      type: 'equirectangular',
      panorama: whitePano,
      yaw: orient.yaw,
      pitch: orient.pitch,
      hfov: HFOV,
      minHfov: 38,
      maxHfov: 52,
      minYaw: orient.yaw - PAN_MARGIN.yaw,
      maxYaw: orient.yaw + PAN_MARGIN.yaw,
      minPitch: orient.pitch - PAN_MARGIN.pitch,
      maxPitch: orient.pitch + PAN_MARGIN.pitch,
      avoidShowingBackground: true,
      hotSpots: hotSpots
    };
  }

  function buildConfig() {
    var scenes = {};
    var i;
    for (i = 0; i < FACE_LAYOUTS.length; i += 1) {
      scenes['scene' + i] = buildSceneConfig(i);
    }
    return {
      default: {
        firstScene: 'scene0',
        sceneFadeDuration: 500,
        autoLoad: true,
        showControls: false,
        showFullscreenCtrl: false,
        showZoomCtrl: false,
        compass: false,
        backgroundColor: [255, 255, 255]
      },
      scenes: scenes
    };
  }

  function updateAimArrows() {
    if (!viewerEl || !viewer) return;
    viewerEl.querySelectorAll('.sphere-nav-guide__arrow').forEach(function (arrow) {
      var parent = arrow.closest('.sphere-nav-guide--edge');
      if (parent && currentScene === parseInt(arrow.getAttribute('data-target-scene'), 10)) {
        arrow.style.opacity = '0';
        arrow.style.pointerEvents = 'none';
        return;
      }

      var fromYaw = parseFloat(arrow.getAttribute('data-from-yaw'));
      var fromPitch = parseFloat(arrow.getAttribute('data-from-pitch'));
      var toYaw = parseFloat(arrow.getAttribute('data-to-yaw'));
      var toPitch = parseFloat(arrow.getAttribute('data-to-pitch'));
      var fromScreen = coordsToScreen(fromYaw, fromPitch);
      var toScreen = coordsToScreen(toYaw, toPitch);

      if (!fromScreen || !toScreen) {
        arrow.style.opacity = '0.2';
        arrow.style.pointerEvents = 'none';
        return;
      }

      arrow.style.opacity = '';
      arrow.style.pointerEvents = parent ? 'auto' : 'none';
      var deg = screenAimDegrees(fromScreen.x, fromScreen.y, toScreen.x, toScreen.y);
      arrow.style.transform = 'rotate(' + deg + 'deg)';
    });
  }

  function startAimLoop() {
    if (aimLoopId) return;
    function tick() {
      if (!isActive) {
        aimLoopId = null;
        return;
      }
      updateAimArrows();
      aimLoopId = requestAnimationFrame(tick);
    }
    aimLoopId = requestAnimationFrame(tick);
  }

  function stopAimLoop() {
    if (aimLoopId) {
      cancelAnimationFrame(aimLoopId);
      aimLoopId = null;
    }
  }

  function goToScene(index) {
    if (index < 0 || index >= FACE_LAYOUTS.length || !viewer) return;
    currentScene = index;
    viewer.loadScene('scene' + index);
    setTimeout(updateAimArrows, 520);
  }

  function setHint(text) {
    if (hint) hint.textContent = text;
  }

  function updateControls() {
    if (!startBtn || !stopBtn) return;
    var showStart = instructionsReady && !isActive;
    startBtn.disabled = !showStart;
    startBtn.classList.toggle('d-none', !showStart);
    stopBtn.classList.toggle('d-none', !isActive);
  }

  function showInstructions(show) {
    if (!instructions) return;
    instructions.classList.toggle('is-hidden', !show);
    instructions.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function setBlocker(on) {
    if (blocker) blocker.classList.toggle('is-hidden', !on);
  }

  function startTour() {
    if (!instructionsReady || isActive || !viewer) return;
    isActive = true;
    document.body.classList.add('sphere-nav-active');
    root.classList.add('is-active');
    setBlocker(false);
    setHint('Drag the canvas · follow guide arrows');
    updateControls();
    updateAimArrows();
    startAimLoop();
    try {
      viewer.resize();
    } catch (e) {}
  }

  function stopTour(fromHotspot) {
    if (!isActive) return;
    isActive = false;
    stopAimLoop();
    document.body.classList.remove('sphere-nav-active');
    root.classList.remove('is-active');
    setBlocker(true);
    if (!fromHotspot) {
      setHint('Start again to explore · or scroll down');
    }
    updateControls();
  }

  function dismissInstructions() {
    instructionsReady = true;
    showInstructions(false);
    startTour();
  }

  viewer = pannellum.viewer(viewerEl, buildConfig());

  viewer.on('load', updateAimArrows);
  viewer.on('scenechange', function (id) {
    currentScene = parseInt(String(id).replace('scene', ''), 10) || 0;
    updateAimArrows();
  });
  viewer.on('animatefinished', updateAimArrows);
  viewer.on('zoomchange', updateAimArrows);
  viewer.on('mouseup', updateAimArrows);
  viewer.on('touchend', updateAimArrows);

  showInstructions(true);
  setBlocker(true);
  setHint('Read the instructions to begin');
  updateControls();

  if (instructionsOk) instructionsOk.addEventListener('click', dismissInstructions);
  if (startBtn) startBtn.addEventListener('click', startTour);
  if (stopBtn) stopBtn.addEventListener('click', function () {
    stopTour(false);
  });

  window.addEventListener(
    'resize',
    function () {
      try {
        viewer.resize();
      } catch (e) {}
      updateAimArrows();
    },
    { passive: true }
  );
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isActive) stopTour(false);
  });
})();
