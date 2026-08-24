/**
 * KERA — Advanced Educational Aesthetic Filler Injection Simulator
 * Interactive 3D Syringe, Instrument Selector, Vascular Anatomy & Audio Synthesizer (v3.5)
 */

(function () {
  'use strict';

  // --- Global State Variables ---
  let scene, camera, renderer, controls;
  let headModel = null;
  let hotspotsData = [];
  let hotspotObjects = [];
  let activeHotspot = null;
  let hoveredHotspot = null;
  let hotspotsVisible = true;
  let needleVisible = true;
  let vesselsVisible = true;
  let beforeAfterMode = false;

  // Syringe & 3D Objects
  let syringeGroup = null;
  let needleMesh = null;
  let needleTip = null;
  let needleHub = null;
  let syringePlunger = null;
  let syringeFluid = null;
  let vascularGroup = null;
  let bolusObjects = {};
  let angleArcMesh = null;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Instrument Presets
  const INSTRUMENTS = {
    'needle_30g_4mm': { name: 'Needle 30G 4mm', length: 1.0, radius: 0.014, hubColor: 0xfacc15, isCannula: false },
    'needle_27g_13mm': { name: 'Needle 27G 13mm', length: 1.6, radius: 0.018, hubColor: 0x94a3b8, isCannula: false },
    'needle_32g_4mm': { name: 'Needle 32G 4mm (Micro)', length: 0.9, radius: 0.012, hubColor: 0x22c55e, isCannula: false },
    'cannula_27g_38mm': { name: 'Blunt Cannula 27G 38mm', length: 2.2, radius: 0.018, hubColor: 0x94a3b8, isCannula: true },
    'cannula_25g_50mm': { name: 'Blunt Cannula 25G 50mm', length: 2.6, radius: 0.022, hubColor: 0xf97316, isCannula: true },
    'cannula_22g_70mm': { name: 'Blunt Cannula 22G 70mm', length: 3.2, radius: 0.028, hubColor: 0x0f172a, isCannula: true }
  };
  let currentInstrument = 'needle_30g_4mm';

  // --- Web Audio Synthesizer ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, type, duration, gainLevel = 0.1) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainLevel, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function playInjectionSound() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + 0.9);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } catch (e) {}
  }

  // DOM Elements
  const canvas = document.getElementById('canvas3d');
  const viewportContainer = document.getElementById('viewport-container');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingProgress = document.getElementById('loading-progress');
  const tooltip = document.getElementById('hotspot-tooltip');
  const quickbar = document.getElementById('regions-quickbar');
  const needleStatusBadge = document.getElementById('needle-status-badge');
  const needleStatusDot = document.getElementById('needle-status-dot');
  const needleStatusText = document.getElementById('needle-status-text');

  // Side Panel Elements
  const emptyState = document.getElementById('empty-state');
  const activePanelContent = document.getElementById('active-panel-content');
  const regionNameAr = document.getElementById('panel-region-name-ar');
  const regionNameEn = document.getElementById('panel-region-name-en');
  const dangerZone = document.getElementById('panel-danger-zone');
  const clinicalPearls = document.getElementById('panel-clinical-pearls');
  const descriptionText = document.getElementById('panel-description');
  const instrumentBadge = document.getElementById('instrument-badge');

  // Protocol Tabs Elements (Pre & Post Care)
  const panelPrecareAssessment = document.getElementById('panel-precare-assessment');
  const panelPrecareContra = document.getElementById('panel-precare-contra');
  const panelPrecareAnesthesia = document.getElementById('panel-precare-anesthesia');
  const panelPrecarePrep = document.getElementById('panel-precare-prep');
  const panelPostcareEval = document.getElementById('panel-postcare-eval');
  const panelPostcareMassage = document.getElementById('panel-postcare-massage');
  const panelPostcareInstructions = document.getElementById('panel-postcare-instructions');
  const panelPostcareDowntime = document.getElementById('panel-postcare-downtime');

  // Sliders & Controls
  const sliderAngle = document.getElementById('slider-angle');
  const sliderDepth = document.getElementById('slider-depth');
  const sliderVolume = document.getElementById('slider-volume');
  const valAngleDisplay = document.getElementById('val-angle-display');
  const valDepthDisplay = document.getElementById('val-depth-display');
  const valVolumeDisplay = document.getElementById('val-volume-display');
  const selectTechnique = document.getElementById('select-technique');
  const btnAspiration = document.getElementById('btn-aspiration');
  const txtAspiration = document.getElementById('txt-aspiration');
  const btnInject = document.getElementById('btn-inject');
  const txtBtnInject = document.getElementById('txt-btn-inject');
  const emergencyCard = document.getElementById('emergency-hyaluronidase-card');
  const hyaluronidaseDose = document.getElementById('hyaluronidase-dose');
  const btnDissolveFiller = document.getElementById('btn-dissolve-filler');
  const resultBox = document.getElementById('result-box');
  const resultTitle = document.getElementById('result-title');
  const resultDetails = document.getElementById('result-details');

  // Header Actions
  const btnClosePanel = document.getElementById('btn-close-panel');
  const btnResetCam = document.getElementById('btn-reset-cam');
  const btnToggleHotspots = document.getElementById('btn-toggle-hotspots');
  const txtToggleHotspots = document.getElementById('txt-toggle-hotspots');
  const btnToggleNeedle = document.getElementById('btn-toggle-needle');
  const txtToggleNeedle = document.getElementById('txt-toggle-needle');
  const btnToggleVessels = document.getElementById('btn-toggle-vessels');
  const txtToggleVessels = document.getElementById('txt-toggle-vessels');
  const btnBeforeAfter = document.getElementById('btn-before-after');
  const txtBeforeAfter = document.getElementById('txt-before-after');

  // --- Initialization ---
  async function init() {
    setupScene();
    setupLighting();
    setupControls();
    create3DSyringe();
    create3DVascularMap();
    setupEventListeners();

    await loadHotspotsData();
    load3DModel();

    animate();
  }

  // --- Three.js Scene Setup ---
  function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);

    const width = viewportContainer.clientWidth || window.innerWidth;
    const height = viewportContainer.clientHeight || window.innerHeight;
    const aspect = width / height;

    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 0, 14);

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (renderer.outputEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
  }

  // --- Lighting Setup ---
  function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(5, 6, 8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 1.1);
    fillLight.position.set(-5, 3, 6);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, 8, -6);
    scene.add(rimLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.7);
    scene.add(hemiLight);
  }

  // --- Orbit Controls ---
  function setupControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4.0;
    controls.maxDistance = 30.0;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.target.set(0, 0, 0);
    controls.update();
  }

  // --- Procedural 3D Syringe & Needle ---
  function create3DSyringe() {
    syringeGroup = new THREE.Group();
    syringeGroup.name = 'Medical_Syringe';

    const inst = INSTRUMENTS[currentInstrument];

    // 1. Stainless Steel Needle (Tip at origin)
    const needleGeo = new THREE.CylinderGeometry(inst.radius, inst.radius, inst.length, 16);
    needleGeo.translate(0, inst.length / 2, 0);
    const needleMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.2
    });
    needleMesh = new THREE.Mesh(needleGeo, needleMat);
    syringeGroup.add(needleMesh);

    // Tip: Bevel if sharp needle, rounded hemisphere if blunt cannula
    if (inst.isCannula) {
      const bluntGeo = new THREE.SphereGeometry(inst.radius, 12, 12);
      needleTip = new THREE.Mesh(bluntGeo, needleMat);
      // Lateral port opening
      const portGeo = new THREE.BoxGeometry(inst.radius * 1.5, 0.06, inst.radius * 1.5);
      portGeo.translate(0, 0.08, 0);
      const portMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      const portMesh = new THREE.Mesh(portGeo, portMat);
      syringeGroup.add(portMesh);
    } else {
      const bevelGeo = new THREE.ConeGeometry(inst.radius * 1.1, 0.08, 16);
      bevelGeo.translate(0, 0.04, 0);
      needleTip = new THREE.Mesh(bevelGeo, needleMat);
    }
    syringeGroup.add(needleTip);

    // 2. Hub (Luer-Lock)
    const hubGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.35, 16);
    hubGeo.translate(0, inst.length + 0.175, 0);
    const hubMat = new THREE.MeshStandardMaterial({
      color: inst.hubColor,
      roughness: 0.4,
      metalness: 0.1
    });
    needleHub = new THREE.Mesh(hubGeo, hubMat);
    syringeGroup.add(needleHub);

    // 3. Glass Barrel
    const barrelBaseY = inst.length + 0.35;
    const barrelGeo = new THREE.CylinderGeometry(0.18, 0.18, 2.2, 24);
    barrelGeo.translate(0, barrelBaseY + 1.1, 0);
    const barrelMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      transmission: 0.8,
      thickness: 0.1,
      depthWrite: false
    });
    const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
    syringeGroup.add(barrelMesh);

    // Flange
    const flangeGeo = new THREE.BoxGeometry(0.65, 0.06, 0.4);
    flangeGeo.translate(0, barrelBaseY + 2.2, 0);
    const flangeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const flangeMesh = new THREE.Mesh(flangeGeo, flangeMat);
    syringeGroup.add(flangeMesh);

    // Graduation Lines
    for (let i = 0; i < 6; i++) {
      const ringGeo = new THREE.RingGeometry(0.181, 0.185, 24);
      ringGeo.rotateX(Math.PI / 2);
      ringGeo.translate(0, barrelBaseY + 0.3 + i * 0.35, 0);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x475569, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      syringeGroup.add(ring);
    }

    // 4. Fluid Column
    const fluidGeo = new THREE.CylinderGeometry(0.165, 0.165, 1.8, 16);
    fluidGeo.translate(0, barrelBaseY + 0.9, 0);
    const fluidMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      roughness: 0.15
    });
    syringeFluid = new THREE.Mesh(fluidGeo, fluidMat);
    syringeGroup.add(syringeFluid);

    // 5. Plunger
    const plungerGroup = new THREE.Group();
    const stopperGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.18, 16);
    stopperGeo.translate(0, barrelBaseY + 1.8, 0);
    const stopperMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const stopperMesh = new THREE.Mesh(stopperGeo, stopperMat);
    plungerGroup.add(stopperMesh);

    const shaftGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.0, 12);
    shaftGeo.translate(0, barrelBaseY + 2.8, 0);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 });
    const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
    plungerGroup.add(shaftMesh);

    const thumbGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.05, 16);
    thumbGeo.translate(0, barrelBaseY + 3.8, 0);
    const thumbMesh = new THREE.Mesh(thumbGeo, hubMat);
    plungerGroup.add(thumbMesh);

    syringePlunger = plungerGroup;
    syringeGroup.add(syringePlunger);

    // 6. Interactive 3D Protractor Arc (Visual Angle Indicator)
    const arcCurve = new THREE.EllipseCurve(0, 0, 0.6, 0.6, 0, Math.PI / 2, false, 0);
    const arcPoints = arcCurve.getPoints(24);
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2 });
    angleArcMesh = new THREE.Line(arcGeo, arcMat);
    angleArcMesh.visible = false;
    syringeGroup.add(angleArcMesh);

    syringeGroup.visible = false;
    scene.add(syringeGroup);
  }

  // --- 3D Vascular Map ---
  function create3DVascularMap() {
    vascularGroup = new THREE.Group();
    vascularGroup.name = 'Vascular_Anatomy_Map';

    const vesselMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.75,
      roughness: 0.3,
      metalness: 0.1,
      depthTest: false
    });

    const createArteryTube = (points, radius = 0.032) => {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
      const tubeGeo = new THREE.TubeGeometry(curve, 32, radius, 8, false);
      return new THREE.Mesh(tubeGeo, vesselMat);
    };

    // Right & Left Facial Arteries
    vascularGroup.add(createArteryTube([
      [-1.5, -2.2, 1.2],
      [-1.1, -1.5, 2.3],
      [-0.7, -1.1, 2.8],
      [-0.48, -0.5, 3.12],
      [-0.45, 0.1, 3.05],
      [-0.75, 0.8, 2.85],
      [-0.85, 1.3, 2.7]
    ]));
    vascularGroup.add(createArteryTube([
      [1.5, -2.2, 1.2],
      [1.1, -1.5, 2.3],
      [0.7, -1.1, 2.8],
      [0.48, -0.5, 3.12],
      [0.45, 0.1, 3.05],
      [0.75, 0.8, 2.85],
      [0.85, 1.3, 2.7]
    ]));

    // Superior & Inferior Labial Arteries
    vascularGroup.add(createArteryTube([
      [-0.55, -0.85, 3.2],
      [-0.25, -0.82, 3.32],
      [0.0, -0.8, 3.34],
      [0.25, -0.82, 3.32],
      [0.55, -0.85, 3.2]
    ], 0.024));
    vascularGroup.add(createArteryTube([
      [-0.6, -1.2, 3.1],
      [-0.28, -1.18, 3.22],
      [0.0, -1.16, 3.24],
      [0.28, -1.18, 3.22],
      [0.6, -1.2, 3.1]
    ], 0.024));

    // Supratrochlear & Supraorbital Arteries
    vascularGroup.add(createArteryTube([
      [-0.35, 1.4, 2.85],
      [-0.28, 1.9, 3.25],
      [-0.2, 2.6, 3.15],
      [-0.3, 3.4, 2.6]
    ], 0.026));
    vascularGroup.add(createArteryTube([
      [0.35, 1.4, 2.85],
      [0.28, 1.9, 3.25],
      [0.2, 2.6, 3.15],
      [0.3, 3.4, 2.6]
    ], 0.026));

    // Superficial Temporal Arteries (STA)
    vascularGroup.add(createArteryTube([
      [-2.1, 0.4, 0.5],
      [-2.0, 1.2, 1.1],
      [-1.85, 1.8, 1.8],
      [-1.4, 2.6, 1.9],
      [-0.9, 3.2, 2.0]
    ], 0.028));
    vascularGroup.add(createArteryTube([
      [2.1, 0.4, 0.5],
      [2.0, 1.2, 1.1],
      [1.85, 1.8, 1.8],
      [1.4, 2.6, 1.9],
      [0.9, 3.2, 2.0]
    ], 0.028));

    scene.add(vascularGroup);
  }

  // --- Load 3D Head Model with Auto-Fallback ---
  function load3DModel() {
    const candidateUrls = [
      './assets/models/head.glb?v=4.0.0',
      './head.glb?v=4.0.0',
      './assets/head.glb?v=4.0.0',
      './angelica (1).glb?v=4.0.0',
      './assets/models/angelica (1).glb?v=4.0.0'
    ];

    const loader = new THREE.GLTFLoader();
    let currentCandidateIdx = 0;

    function tryLoadCandidate(idx) {
      if (idx >= candidateUrls.length) {
        if (loadingProgress) {
          loadingProgress.textContent = 'تعذر العثور على ملف النموذج 3D (تأكد من وجود head.glb)';
        }
        return;
      }

      const url = candidateUrls[idx];

      loader.load(
        url,
        function (gltf) {
          headModel = gltf.scene;

          // Process Materials & Fix transparency/extensions
          headModel.traverse(function (node) {
            if (node.isMesh) {
              node.castShadow = false;
              node.receiveShadow = false;

              if (node.material) {
                node.material.side = THREE.DoubleSide;

                if (node.name.includes('Head') || node.name.includes('Mouth')) {
                  node.material.transparent = false;
                  node.material.opacity = 1.0;
                  node.material.depthWrite = true;
                  node.material.roughness = 0.6;
                  node.material.metalness = 0.0;
                } else if (node.name.includes('Hair')) {
                  node.material.transparent = true;
                  node.material.alphaTest = 0.3;
                  node.material.depthWrite = true;
                } else if (node.name.includes('EyeSclera') || node.name.includes('Meniscus')) {
                  node.material.transparent = true;
                  node.material.opacity = 0.4;
                  node.material.depthWrite = false;
                }
                node.material.needsUpdate = true;
              }
            }
          });

          // Normalize Scale and Center to 10.0 units if loading unbaked model
          const bbox = new THREE.Box3().setFromObject(headModel);
          const size = bbox.getSize(new THREE.Vector3());
          const center = bbox.getCenter(new THREE.Vector3());

          if (size.y > 0.001) {
            const targetHeight = 10.0;
            if (Math.abs(size.y - targetHeight) > 1.0) {
              const s = targetHeight / size.y;
              headModel.scale.set(s, s, s);
              headModel.position.set(-center.x * s, -center.y * s, -center.z * s);
            } else {
              headModel.position.set(0, 0, 0);
            }
          }

          scene.add(headModel);

          camera.position.set(0, 0, 14);
          controls.target.set(0, 0, 0);
          controls.update();

          createHotspotMarkers();

          if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
          }
        },
        function (xhr) {
          if (xhr.lengthComputable && loadingProgress) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            loadingProgress.textContent = `${percent}%`;
          }
        },
        function (err) {
          // If this path failed, try the next candidate
          tryLoadCandidate(idx + 1);
        }
      );
    }

    tryLoadCandidate(0);
  }

  // --- Load JSON Configuration ---
  async function loadHotspotsData() {
    try {
      const response = await fetch('./assets/js/lab-data.json?v=4.0.0');
      const data = await response.json();
      hotspotsData = data.points || [];
      renderQuickbar();
    } catch (error) {
      console.error('Failed to load lab-data.json:', error);
    }
  }

  // --- Create 3D Hotspot Markers ---
  function createHotspotMarkers() {
    hotspotObjects.forEach(function (obj) {
      scene.remove(obj);
    });
    hotspotObjects = [];

    hotspotsData.forEach(function (point) {
      const group = new THREE.Group();
      group.position.set(point.position[0], point.position[1], point.position[2]);

      const ringGeo = new THREE.RingGeometry(0.09, 0.14, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthTest: false
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);

      const dotGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        depthTest: false
      });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);

      const hitGeo = new THREE.SphereGeometry(0.25, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);

      group.add(ringMesh);
      group.add(dotMesh);
      group.add(hitMesh);

      group.userData = {
        pointData: point,
        ringMesh: ringMesh,
        dotMesh: dotMesh,
        hitMesh: hitMesh
      };

      scene.add(group);
      hotspotObjects.push(group);
    });
  }

  // --- Render Quickbar ---
  function renderQuickbar() {
    if (!quickbar) return;
    quickbar.innerHTML = '';
    hotspotsData.forEach(function (pt) {
      const pill = document.createElement('button');
      pill.className = 'quickbar-pill';
      pill.textContent = `${pt.name_ar} (${pt.md_code || ''})`;
      pill.dataset.id = pt.id;
      pill.addEventListener('click', function () {
        const obj = hotspotObjects.find(function (h) {
          return h.userData.pointData.id === pt.id;
        });
        if (obj) {
          selectHotspot(obj.userData.pointData);
        }
      });
      quickbar.appendChild(pill);
    });
  }

  // --- Select Hotspot ---
  function selectHotspot(point) {
    activeHotspot = point;
    playTone(520, 'sine', 0.15, 0.08);

    hotspotObjects.forEach(function (h) {
      const isThis = h.userData.pointData.id === point.id;
      if (isThis) {
        h.userData.ringMesh.material.color.setHex(0x059669);
        h.userData.dotMesh.material.color.setHex(0x34d399);
        h.userData.ringMesh.material.opacity = 1.0;
        h.scale.set(1.4, 1.4, 1.4);
      } else {
        h.userData.ringMesh.material.color.setHex(0x0284c7);
        h.userData.dotMesh.material.color.setHex(0x38bdf8);
        h.userData.ringMesh.material.opacity = 0.85;
        h.scale.set(1.0, 1.0, 1.0);
      }
    });

    document.querySelectorAll('.quickbar-pill').forEach(function (p) {
      p.classList.toggle('active', p.dataset.id === point.id);
    });

    if (emptyState) emptyState.style.display = 'none';
    if (activePanelContent) activePanelContent.style.display = 'block';

    if (regionNameAr) regionNameAr.textContent = `${point.name_ar} [${point.md_code || ''}]`;
    if (regionNameEn) regionNameEn.textContent = point.name_en;
    if (dangerZone) dangerZone.textContent = point.danger_zone;
    if (clinicalPearls) clinicalPearls.textContent = point.clinical_pearls;
    if (descriptionText) descriptionText.textContent = `${point.description} • اللزوجة (Rheology): ${point.rheology}`;
    if (instrumentBadge) instrumentBadge.textContent = point.recommended_instrument;

    // Populate Pre-Care Protocol
    if (point.pre_care) {
      if (panelPrecareAssessment) panelPrecareAssessment.textContent = point.pre_care.assessment;
      if (panelPrecareContra) panelPrecareContra.textContent = point.pre_care.contraindications;
      if (panelPrecareAnesthesia) panelPrecareAnesthesia.textContent = point.pre_care.anesthesia;
      if (panelPrecarePrep) panelPrecarePrep.textContent = point.pre_care.prep_steps;
    }

    // Populate Post-Care Protocol
    if (point.post_care) {
      if (panelPostcareEval) panelPostcareEval.textContent = point.post_care.immediate_eval;
      if (panelPostcareMassage) panelPostcareMassage.textContent = point.post_care.massage;
      if (panelPostcareInstructions) panelPostcareInstructions.textContent = point.post_care.patient_instructions;
      if (panelPostcareDowntime) panelPostcareDowntime.textContent = point.post_care.downtime;
    }

    // Default to first tab (Technique)
    document.querySelectorAll('.protocol-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'technique'));
    document.querySelectorAll('.protocol-tab-pane').forEach((p) => p.classList.toggle('active', p.id === 'pane-technique'));

    document.querySelectorAll('.layer-item').forEach(function (el) {
      const idx = parseInt(el.dataset.layerIdx, 10);
      el.classList.toggle('active-target', idx === point.target_layer_index);
    });

    // Default Sliders to Safe Midpoints
    const midAngle = Math.round((point.safe_angle_min + point.safe_angle_max) / 2);
    const midDepth = ((point.safe_depth_min + point.safe_depth_max) / 2).toFixed(1);
    const midVol = ((point.recommended_volume_min + point.recommended_volume_max) / 2).toFixed(2);

    if (sliderAngle) sliderAngle.value = midAngle;
    if (sliderDepth) sliderDepth.value = midDepth;
    if (sliderVolume) sliderVolume.value = midVol;

    resetAspirationState();
    if (emergencyCard) emergencyCard.className = 'emergency-hyaluronidase-card';

    if (resultBox) {
      resultBox.className = 'result-box';
      resultBox.style.display = 'none';
    }

    update3DSyringeTransform();

    focusCameraOnPoint(point.position);
  }

  // --- Deselect Hotspot ---
  function deselectHotspot() {
    activeHotspot = null;
    if (emptyState) emptyState.style.display = 'flex';
    if (activePanelContent) activePanelContent.style.display = 'none';

    hotspotObjects.forEach(function (h) {
      h.userData.ringMesh.material.color.setHex(0x0284c7);
      h.userData.dotMesh.material.color.setHex(0x38bdf8);
      h.userData.ringMesh.material.opacity = 0.85;
      h.scale.set(1.0, 1.0, 1.0);
    });

    document.querySelectorAll('.quickbar-pill').forEach(function (p) {
      p.classList.remove('active');
    });

    if (syringeGroup) syringeGroup.visible = false;
    if (needleStatusDot && needleStatusText) {
      needleStatusDot.className = 'needle-status-dot';
      needleStatusText.textContent = 'اختر نقطة لتفعيل الإبرة 3D';
    }
  }

  // --- Real-time 3D Needle Tracking & Live Safety Assessment ---
  function update3DSyringeTransform() {
    if (!activeHotspot || !syringeGroup) return;

    syringeGroup.visible = needleVisible;

    const entryPos = new THREE.Vector3(
      activeHotspot.position[0],
      activeHotspot.position[1],
      activeHotspot.position[2]
    );

    const norm = activeHotspot.normal
      ? new THREE.Vector3(activeHotspot.normal[0], activeHotspot.normal[1], activeHotspot.normal[2]).normalize()
      : entryPos.clone().normalize();

    const angleDeg = parseInt(sliderAngle.value, 10);
    const depthMm = parseFloat(sliderDepth.value);
    const volumeMl = parseFloat(sliderVolume.value);

    // Update Live Value Displays with explicit degrees and millimeter units
    if (valAngleDisplay) valAngleDisplay.textContent = `${angleDeg}°`;
    if (valDepthDisplay) valDepthDisplay.textContent = `${depthMm.toFixed(1)} mm`;
    if (valVolumeDisplay) valVolumeDisplay.textContent = `${volumeMl.toFixed(2)} ml`;

    // Angle rotation relative to surface normal
    const upRef = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3().crossVectors(norm, upRef).normalize();
    if (tangent.lengthSq() < 0.001) tangent.set(1, 0, 0);

    const angleRad = (angleDeg * Math.PI) / 180;
    const syringeDir = new THREE.Vector3()
      .addScaledVector(norm, Math.sin(angleRad))
      .addScaledVector(tangent, Math.cos(angleRad))
      .normalize();

    const scaleFactor = 0.0519;
    const depthOffset = depthMm * scaleFactor;

    const tipPos = entryPos.clone().addScaledVector(syringeDir, -depthOffset);
    syringeGroup.position.copy(tipPos);

    const defaultSyringeAxis = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(defaultSyringeAxis, syringeDir);
    syringeGroup.quaternion.copy(q);

    updateLayerGauge(depthMm);

    // Live Safety Assessment
    evaluateLiveSafety(angleDeg, depthMm);
  }

  // --- Live Safety Assessment Badge ---
  function evaluateLiveSafety(angle, depth) {
    if (!activeHotspot || !needleStatusBadge || !needleStatusDot || !needleStatusText) return;

    const isAngleOk = angle >= activeHotspot.safe_angle_min && angle <= activeHotspot.safe_angle_max;
    const isDepthOk = depth >= activeHotspot.safe_depth_min && depth <= activeHotspot.safe_depth_max;

    if (isAngleOk && isDepthOk) {
      needleStatusDot.style.backgroundColor = '#059669';
      needleStatusDot.style.boxShadow = '0 0 8px rgba(5, 150, 105, 0.6)';
      needleStatusText.innerHTML = `<strong>الوضعية آمنة:</strong> زاوية <strong>${angle}°</strong> • عمق <strong>${depth.toFixed(1)} مم</strong> (ضمن النطاق الموصى به)`;
    } else {
      needleStatusDot.style.backgroundColor = '#dc2626';
      needleStatusDot.style.boxShadow = '0 0 8px rgba(220, 38, 38, 0.6)';
      needleStatusText.innerHTML = `<strong>تنبيه:</strong> زاوية <strong>${angle}°</strong> (المثالي: ${activeHotspot.safe_angle_min}°-${activeHotspot.safe_angle_max}°) • عمق <strong>${depth.toFixed(1)} مم</strong> (المثالي: ${activeHotspot.safe_depth_min}-${activeHotspot.safe_depth_max} مم)`;
    }
  }

  // --- Real-time Layer Cross-Section Gauge ---
  function updateLayerGauge(depthMm) {
    let currentLayerIdx = 0;
    if (depthMm <= 1.5) {
      currentLayerIdx = 0;
    } else if (depthMm <= 3.0) {
      currentLayerIdx = 1;
    } else if (depthMm <= 4.5) {
      currentLayerIdx = 2;
    } else if (depthMm <= 6.0) {
      currentLayerIdx = 3;
    } else {
      currentLayerIdx = 4;
    }

    document.querySelectorAll('.layer-item').forEach(function (el) {
      const idx = parseInt(el.dataset.layerIdx, 10);
      el.classList.toggle('needle-current', idx === currentLayerIdx);
    });
  }

  // --- Aspiration Test ---
  function performAspirationTest() {
    if (!activeHotspot || !btnAspiration) return;

    const currentAngle = parseInt(sliderAngle.value, 10);
    const currentDepth = parseFloat(sliderDepth.value);

    let pullStep = 0;
    function pullAnim() {
      pullStep += 0.1;
      if (syringePlunger) syringePlunger.position.y = Math.sin(pullStep * Math.PI) * 0.25;
      if (pullStep < 1.0) {
        requestAnimationFrame(pullAnim);
      }
    }
    pullAnim();

    const inDangerZone =
      currentDepth > activeHotspot.safe_depth_max + 0.8 ||
      currentDepth < activeHotspot.safe_depth_min - 0.8 ||
      currentAngle < activeHotspot.safe_angle_min - 15;

    if (inDangerZone) {
      playTone(320, 'sawtooth', 0.4, 0.12);
      btnAspiration.className = 'btn-aspiration aspirated-blood';
      txtAspiration.textContent = '⚠ سحب دم إيجابي (Blood Flashback)! الإبرة في وعاء دموي!';
      if (syringeFluid) syringeFluid.material.color.setHex(0xdc2626);

      if (emergencyCard && hyaluronidaseDose) {
        emergencyCard.className = 'emergency-hyaluronidase-card show';
        hyaluronidaseDose.textContent = activeHotspot.emergency_hyaluronidase_dose || '300-500 IU';
      }
    } else {
      playTone(660, 'sine', 0.2, 0.08);
      btnAspiration.className = 'btn-aspiration aspirated-safe';
      txtAspiration.textContent = '✓ سحب سلبي آمن (Negative Aspiration) — لا يوجد دم';
      if (syringeFluid) syringeFluid.material.color.setHex(0x38bdf8);
      if (emergencyCard) emergencyCard.className = 'emergency-hyaluronidase-card';
    }
  }

  function resetAspirationState() {
    if (!btnAspiration || !txtAspiration) return;
    btnAspiration.className = 'btn-aspiration';
    txtAspiration.textContent = 'إجراء اختبار السحب السلبي (Aspiration Test)';
    if (syringeFluid) syringeFluid.material.color.setHex(0x38bdf8);
  }

  // --- Injection Execution & Dynamic Tissue Response ---
  function executeInjection() {
    if (!activeHotspot || !resultBox) return;

    const currentAngle = parseInt(sliderAngle.value, 10);
    const currentDepth = parseFloat(sliderDepth.value);
    const currentVolume = parseFloat(sliderVolume.value);

    const {
      safe_angle_min,
      safe_angle_max,
      safe_depth_min,
      safe_depth_max,
      recommended_volume_min,
      recommended_volume_max
    } = activeHotspot;

    const isAngleSafe = currentAngle >= safe_angle_min && currentAngle <= safe_angle_max;
    const isDepthSafe = currentDepth >= safe_depth_min && currentDepth <= safe_depth_max;
    const isVolumeSafe = currentVolume >= recommended_volume_min && currentVolume <= recommended_volume_max;

    btnInject.classList.add('injecting');
    txtBtnInject.textContent = 'جاري حقن الفيلر...';
    playInjectionSound();

    let progress = 0;
    function injectionStep() {
      progress += 0.04;

      if (syringePlunger) {
        syringePlunger.position.y = -Math.min(progress, 1.0) * 0.8;
      }
      if (syringeFluid) {
        syringeFluid.scale.y = Math.max(1.0 - progress * 0.6, 0.4);
      }

      if (progress < 1.0) {
        requestAnimationFrame(injectionStep);
      } else {
        btnInject.classList.remove('injecting');
        txtBtnInject.textContent = 'تنفيذ الحقن والتأثير التفاعلي';

        const isSuccess = isDepthSafe && isAngleSafe && isVolumeSafe;
        if (isSuccess) {
          playTone(880, 'sine', 0.3, 0.1);
        } else {
          playTone(280, 'sawtooth', 0.5, 0.12);
        }

        createTissueBolusEffect(activeHotspot, currentVolume, isSuccess);

        displayClinicalResult(isAngleSafe, isDepthSafe, isVolumeSafe, currentAngle, currentDepth, currentVolume);

        if (!isSuccess && emergencyCard && hyaluronidaseDose) {
          emergencyCard.className = 'emergency-hyaluronidase-card show';
          hyaluronidaseDose.textContent = activeHotspot.emergency_hyaluronidase_dose || '300-500 IU';
        }
      }
    }
    injectionStep();
  }

  // --- Emergency Hyaluronidase Dissolve Action ---
  function dissolveFillerAction() {
    if (!activeHotspot) return;

    playTone(580, 'triangle', 0.6, 0.1);

    const bolus = bolusObjects[activeHotspot.id];
    if (bolus) {
      let dissolveProg = 1.0;
      function dissolveStep() {
        dissolveProg -= 0.05;
        bolus.scale.set(dissolveProg, dissolveProg, dissolveProg);
        if (dissolveProg > 0) {
          requestAnimationFrame(dissolveStep);
        } else {
          scene.remove(bolus);
          delete bolusObjects[activeHotspot.id];
        }
      }
      dissolveStep();
    }

    if (emergencyCard) emergencyCard.className = 'emergency-hyaluronidase-card';
    resetAspirationState();

    if (resultBox) {
      resultBox.className = 'result-box success show';
      resultTitle.textContent = '✓ تم تنفيذ بروتوكول الإنقاذ بالهيالورونيداز بنجاح';
      resultDetails.innerHTML = `
        <strong>تقرير الإنقاذ السريري:</strong><br>
        • تم حقن جرعة الهيالورونيداز الإسعافية (${activeHotspot.emergency_hyaluronidase_dose || '300-500 IU'}).<br>
        • تم تفكيك الفيلر بنجاح واستعادة التروية الدموية الطبيعية للأنسجة لتفادي النخر الجلدي.<br>
        • <strong>التوصية السريرية:</strong> تطبيق كمادات دافئة والمراقبة الحيوية لعلامات إعادة الامتلاء الشعري (Capillary Refill Time &lt; 2s).
      `;
    }
  }

  // --- 3D Volumetric Tissue Bulge / Glow Effect ---
  function createTissueBolusEffect(point, volume, isSuccessful) {
    if (bolusObjects[point.id]) {
      scene.remove(bolusObjects[point.id]);
    }

    const bolusGroup = new THREE.Group();
    bolusGroup.position.set(point.position[0], point.position[1], point.position[2]);

    const radius = 0.12 + volume * 0.14;
    const bolusGeo = new THREE.SphereGeometry(radius, 24, 24);
    const bolusMat = new THREE.MeshStandardMaterial({
      color: isSuccessful ? 0x06b6d4 : 0xf87171,
      transparent: true,
      opacity: 0.6,
      roughness: 0.2,
      depthTest: false
    });
    const bolusMesh = new THREE.Mesh(bolusGeo, bolusMat);
    bolusMesh.scale.set(0.1, 0.1, 0.1);
    bolusGroup.add(bolusMesh);

    scene.add(bolusGroup);
    bolusObjects[point.id] = bolusGroup;

    let scaleProg = 0;
    function grow() {
      scaleProg += 0.08;
      const s = easeOutBack(Math.min(scaleProg, 1.0));
      bolusMesh.scale.set(s, s, s);
      if (scaleProg < 1.0) {
        requestAnimationFrame(grow);
      }
    }
    grow();
  }

  function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  // --- Clinical Feedback Report Generation ---
  function displayClinicalResult(isAngleSafe, isDepthSafe, isVolumeSafe, angle, depth, volume) {
    resultBox.style.display = 'block';

    const {
      safe_angle_min,
      safe_angle_max,
      safe_depth_min,
      safe_depth_max,
      recommended_volume_min,
      recommended_volume_max,
      danger_zone,
      anatomical_layer,
      rheology
    } = activeHotspot;

    const allSafe = isAngleSafe && isDepthSafe && isVolumeSafe;

    if (allSafe) {
      resultBox.className = 'result-box success show';
      resultTitle.textContent = '✓ تقييم سريري ممتاز: حقن آمن ومتوافق مع المعايير التشريحية';
      resultDetails.innerHTML = `
        <strong>تقرير الإجراء السريري:</strong><br>
        • <strong>المستوى التشريحي المستهدف:</strong> ${anatomical_layer}<br>
        • <strong>زاوية الدخول:</strong> ${angle}° (المدى الموصى به: ${safe_angle_min}° إلى ${safe_angle_max}°)<br>
        • <strong>عمق النفاذ:</strong> ${depth.toFixed(1)} مم (المدى الموصى به: ${safe_depth_min} إلى ${safe_depth_max} مم)<br>
        • <strong>الجرعة المحقونة:</strong> ${volume.toFixed(2)} مل (المدى الموصى به: ${recommended_volume_min} إلى ${recommended_volume_max} مل)<br>
        • <strong>نوع الفيلر (Rheology):</strong> ${rheology}<br>
        • <strong>النتيجة:</strong> استعادة حجمية متناسقة دون مضاعفات وعائية.
      `;
    } else {
      resultBox.className = 'result-box warning show';
      resultTitle.textContent = '⚠ تنبيه سريري: معايير الحقن بحاجة لتعديل لتجنب المضاعفات';

      let issues = [];
      if (!isAngleSafe) {
        if (angle < safe_angle_min) {
          issues.push(`زاوية الدخول (${angle}°) مسطحة جداً مقارنة بالمستوى المطلوب (${safe_angle_min}° - ${safe_angle_max}°).`);
        } else {
          issues.push(`زاوية الدخول (${angle}°) عمودية بشكل زائد قد تعرض البنى العميقة للخطر (${safe_angle_min}° - ${safe_angle_max}°).`);
        }
      }

      if (!isDepthSafe) {
        if (depth < safe_depth_min) {
          issues.push(`العمق (${depth.toFixed(1)} مم) سطحي للغاية، مما قد يؤدي لظهور تكتلات سطحية أو ظاهرة تيندال (Tyndall Effect). النطاق الآمن: (${safe_depth_min} - ${safe_depth_max} مم).`);
        } else {
          issues.push(`العمق (${depth.toFixed(1)} مم) زائد عن المستوى الآمن، مما يزيد احتمالية اختراق الشرايين العميقة. النطاق الآمن: (${safe_depth_min} - ${safe_depth_max} مم).`);
        }
      }

      if (!isVolumeSafe) {
        if (volume < recommended_volume_min) {
          issues.push(`الجرعة (${volume.toFixed(2)} مل) أقل من الحد الأدنى الفعال للنتيجة التجميلية (${recommended_volume_min} - ${recommended_volume_max} مل).`);
        } else {
          issues.push(`الجرعة (${volume.toFixed(2)} مل) زائدة قد تسبب متلازمة فرط الامتلاء (Overfilled syndrome) وضغطاً وعائياً.`);
        }
      }

      resultDetails.innerHTML = `
        <strong>الملاحظات السريرية:</strong><br>
        ${issues.map((i) => `• ${i}`).join('<br>')}<br>
        <br>
        <div style="color: var(--color-danger); font-weight: 700;">
          تحذير الأمان: ${danger_zone}
        </div>
      `;
    }
  }

  // --- Camera Focus Helper ---
  function focusCameraOnPoint(targetPos) {
    const dir = new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2]).normalize();
    if (dir.lengthSq() > 0.001) {
      const dist = 11.5;
      const targetCamX = dir.x * 4.0;
      const targetCamY = targetPos[1] + 0.5;
      const targetCamZ = Math.max(dir.z * dist, 7.5);

      let progress = 0;
      const startPos = camera.position.clone();
      const endPos = new THREE.Vector3(targetCamX, targetCamY, targetCamZ);

      function step() {
        progress += 0.05;
        camera.position.lerpVectors(startPos, endPos, easeOutCubic(progress));
        controls.target.lerp(new THREE.Vector3(0, targetPos[1] * 0.2, 0), 0.1);
        controls.update();
        if (progress < 1) {
          requestAnimationFrame(step);
        }
      }
      step();
    }
  }

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  // --- Before / After Comparison Toggle ---
  function toggleBeforeAfter() {
    beforeAfterMode = !beforeAfterMode;
    Object.values(bolusObjects).forEach(function (b) {
      b.visible = !beforeAfterMode;
    });
    if (txtBeforeAfter) {
      txtBeforeAfter.textContent = beforeAfterMode ? 'المظهر: قبل الحقن (Baseline)' : 'المظهر: بعد الحقن (Live)';
    }
    if (btnBeforeAfter) {
      btnBeforeAfter.classList.toggle('active', beforeAfterMode);
    }
  }

  // --- Setup Event Listeners ---
  function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);

    if (sliderAngle) sliderAngle.addEventListener('input', update3DSyringeTransform);
    if (sliderDepth) sliderDepth.addEventListener('input', update3DSyringeTransform);
    if (sliderVolume) sliderVolume.addEventListener('input', update3DSyringeTransform);

    if (btnAspiration) btnAspiration.addEventListener('click', performAspirationTest);
    if (btnInject) btnInject.addEventListener('click', executeInjection);
    if (btnDissolveFiller) btnDissolveFiller.addEventListener('click', dissolveFillerAction);
    if (btnClosePanel) btnClosePanel.addEventListener('click', deselectHotspot);
    if (btnResetCam) btnResetCam.addEventListener('click', resetCameraView);
    if (btnToggleHotspots) btnToggleHotspots.addEventListener('click', toggleHotspotsVisibility);
    if (btnToggleNeedle) btnToggleNeedle.addEventListener('click', toggleNeedleVisibility);
    if (btnToggleVessels) btnToggleVessels.addEventListener('click', toggleVesselsVisibility);
    if (btnBeforeAfter) btnBeforeAfter.addEventListener('click', toggleBeforeAfter);

    // Protocol Tabs
    document.querySelectorAll('.protocol-tab-btn').forEach(function (tabBtn) {
      tabBtn.addEventListener('click', function () {
        const tabName = tabBtn.dataset.tab;
        document.querySelectorAll('.protocol-tab-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        document.querySelectorAll('.protocol-tab-pane').forEach(function (p) {
          p.classList.remove('active');
        });

        tabBtn.classList.add('active');
        const targetPane = document.getElementById(`pane-${tabName}`);
        if (targetPane) targetPane.classList.add('active');
        playTone(600, 'sine', 0.08, 0.05);
      });
    });

    document.querySelectorAll('.viewport-toolbar .tool-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.viewport-toolbar .tool-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        setCameraPreset(btn.dataset.view);
      });
    });

    if (viewportContainer) {
      viewportContainer.addEventListener('mousemove', onMouseMove);
      viewportContainer.addEventListener('click', onMouseClick);
      viewportContainer.addEventListener('touchstart', onTouchStart, { passive: true });
    }
  }

  // --- Preset Views ---
  function setCameraPreset(mode) {
    const dist = 14;
    let targetPos = new THREE.Vector3(0, 0, dist);

    switch (mode) {
      case 'front':
        targetPos.set(0, 0, dist);
        break;
      case 'right':
        targetPos.set(-dist, 0, 0);
        break;
      case 'left':
        targetPos.set(dist, 0, 0);
        break;
      case 'three-quarter':
        targetPos.set(dist * 0.7, 1.5, dist * 0.7);
        break;
    }

    let progress = 0;
    const startPos = camera.position.clone();
    function step() {
      progress += 0.06;
      camera.position.lerpVectors(startPos, targetPos, easeOutCubic(progress));
      controls.target.set(0, 0, 0);
      controls.update();
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    step();
  }

  function resetCameraView() {
    setCameraPreset('front');
    document.querySelectorAll('.viewport-toolbar .tool-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === 'front');
    });
  }

  function toggleHotspotsVisibility() {
    hotspotsVisible = !hotspotsVisible;
    hotspotObjects.forEach(function (h) {
      h.visible = hotspotsVisible;
    });
    if (txtToggleHotspots) {
      txtToggleHotspots.textContent = hotspotsVisible ? 'النقاط: مفعّلة' : 'النقاط: مخفية';
    }
  }

  function toggleNeedleVisibility() {
    needleVisible = !needleVisible;
    if (syringeGroup && activeHotspot) {
      syringeGroup.visible = needleVisible;
    }
    if (txtToggleNeedle) {
      txtToggleNeedle.textContent = needleVisible ? 'الإبرة 3D: مفعّلة' : 'الإبرة 3D: مخفية';
    }
  }

  function toggleVesselsVisibility() {
    vesselsVisible = !vesselsVisible;
    if (vascularGroup) {
      vascularGroup.visible = vesselsVisible;
    }
    if (txtToggleVessels) {
      txtToggleVessels.textContent = vesselsVisible ? 'الشرايين 3D: مفعّلة' : 'الشرايين 3D: مخفية';
    }
  }

  // --- Raycasting ---
  function getCanvasRelativeCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : 0);
    const clientY = event.clientY || (event.touches && event.touches[0] ? event.touches[0].clientY : 0);

    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    return { clientX, clientY, rect };
  }

  function onMouseMove(event) {
    if (!hotspotsVisible || !tooltip) {
      if (tooltip) tooltip.style.display = 'none';
      return;
    }

    const coords = getCanvasRelativeCoords(event);
    raycaster.setFromCamera(mouse, camera);

    const hitMeshes = hotspotObjects.map(function (h) {
      return h.userData.hitMesh;
    });
    const intersects = raycaster.intersectObjects(hitMeshes, false);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object.parent;
      const point = hitObj.userData.pointData;
      hoveredHotspot = hitObj;

      canvas.style.cursor = 'pointer';

      tooltip.textContent = `${point.name_ar} [${point.md_code || ''}] • ${point.name_en}`;
      tooltip.style.left = `${coords.clientX - coords.rect.left}px`;
      tooltip.style.top = `${coords.clientY - coords.rect.top}px`;
      tooltip.style.display = 'block';

      if (!activeHotspot || activeHotspot.id !== point.id) {
        hitObj.userData.ringMesh.material.opacity = 1.0;
      }
    } else {
      if (hoveredHotspot && (!activeHotspot || activeHotspot.id !== hoveredHotspot.userData.pointData.id)) {
        hoveredHotspot.userData.ringMesh.material.opacity = 0.85;
      }
      hoveredHotspot = null;
      canvas.style.cursor = 'grab';
      tooltip.style.display = 'none';
    }
  }

  function onMouseClick(event) {
    if (!hotspotsVisible) return;

    getCanvasRelativeCoords(event);
    raycaster.setFromCamera(mouse, camera);

    const hitMeshes = hotspotObjects.map(function (h) {
      return h.userData.hitMesh;
    });
    const intersects = raycaster.intersectObjects(hitMeshes, false);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object.parent;
      selectHotspot(hitObj.userData.pointData);
    }
  }

  function onTouchStart(event) {
    if (!hotspotsVisible || !event.touches.length) return;
    getCanvasRelativeCoords(event);
    raycaster.setFromCamera(mouse, camera);

    const hitMeshes = hotspotObjects.map(function (h) {
      return h.userData.hitMesh;
    });
    const intersects = raycaster.intersectObjects(hitMeshes, false);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object.parent;
      selectHotspot(hitObj.userData.pointData);
    }
  }

  // --- Resize Handling ---
  function onWindowResize() {
    if (!canvas || !renderer || !camera || !viewportContainer) return;
    const width = viewportContainer.clientWidth;
    const height = viewportContainer.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  // --- Animation Loop ---
  function animate() {
    requestAnimationFrame(animate);

    if (controls) controls.update();

    if (hotspotsVisible && camera) {
      hotspotObjects.forEach(function (h) {
        h.quaternion.copy(camera.quaternion);
      });
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
