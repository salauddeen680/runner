// --- RUNNER : MAIN GAME LOGIC ---
(() => {
  "use strict";

  const canvas = document.getElementById("canvas");
  const screens = {
    menu: document.getElementById("menuScreen"),
    pause: document.getElementById("pauseScreen"),
    gameOver: document.getElementById("gameOverScreen"),
    store: document.getElementById("storeScreen"),
    profile: document.getElementById("profileScreen"),
    settings: document.getElementById("settingsScreen")
  };
  const hud = document.getElementById("hud");
  const controls = document.getElementById("controls");

  const scoreText = document.getElementById("score");
  const coinsText = document.getElementById("coins");

  let running = false;
  let paused = false;
  let lastTime = performance.now();
  let score = 0;
  let coins = 0;
  let distance = 0;
  let speed = 40; // Road aur obstacles ki speed
  let spawnTimer = 0;
  let objects = []; 
  let isRevived = false;

  // Player Mechanics
  let playerLane = 0; // -1 (Left), 0 (Center), 1 (Right)
  let jumpHeight = 0;
  let jumpVelocity = 0;
  const laneWidth = 3;

  // --- THREE.JS INITIALIZATION ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020412);
  scene.fog = new THREE.Fog(0x020412, 10, 80);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 4, 7);
  camera.lookAt(0, 1, 0);

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0x00eaff, 1.5);
  dirLight.position.set(0, 10, 5);
  scene.add(dirLight);

  // Environment Road Grid
  const grid = new THREE.GridHelper(100, 50, 0x00dfff, 0x162347);
  grid.position.y = 0;
  grid.position.z = -20;
  scene.add(grid);

  // --- LOAD PLAYER MODEL ---
  let playerModel = new THREE.Group(); 
  scene.add(playerModel);

  const loader = new THREE.GLTFLoader();
  // Kyunki script 'js' folder mein hai, isliye path '../assets/...' hoga
  loader.load('../assets/models/Rigged male character model.glb', (gltf) => {
    scene.remove(playerModel);
    playerModel = gltf.scene;
    playerModel.scale.set(1.2, 1.2, 1.2);
    playerModel.position.set(0, 0, 0);
    scene.add(playerModel);
  }, undefined, (e) => console.log('Model loading error:', e));

  // --- OBSTACLES & COINS SPAWNING ---
  function spawnObject() {
    const lane = Math.floor(Math.random() * 3) - 1; 
    const isCoin = Math.random() < 0.4;
    
    let mesh;
    if (isCoin) {
      const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffd83d, emissive: 0xff8d00 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = 1; 
    } else {
      const geo = new THREE.BoxGeometry(2, 2, 2);
      const mat = new THREE.MeshStandardMaterial({ color: 0xff4d00, emissive: 0x880000 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 1;
    }

    mesh.position.x = lane * laneWidth;
    mesh.position.z = -80; 
    scene.add(mesh);

    objects.push({
      mesh: mesh,
      type: isCoin ? 'coin' : 'barrier',
      lane: lane,
      removed: false
    });
  }

  // --- SCREEN SWITCHING ---
  function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    if(screenName) screens[screenName].classList.remove('hidden');
  }

  function goHome() {
    running = false;
    paused = false;
    hud.classList.add("hidden");
    controls.classList.add("hidden");
    showScreen('menu');
  }

  function startGame() {
    score = 0; coins = 0; distance = 0; speed = 40;
    playerLane = 0; jumpHeight = 0; jumpVelocity = 0;
    isRevived = false;

    if (playerModel) { playerModel.position.set(0, 0, 0); }
    
    objects.forEach(obj => scene.remove(obj.mesh));
    objects = [];

    scoreText.textContent = "0";
    coinsText.textContent = "0";

    running = true; paused = false;
    lastTime = performance.now();

    showScreen(null);
    hud.classList.remove("hidden");
    controls.classList.remove("hidden");
  }

  function pauseGame() {
    if (!running || paused) return;
    paused = true;
    showScreen('pause');
    controls.classList.add("hidden");
  }

  function resumeGame() {
    if (!running) return;
    paused = false;
    lastTime = performance.now();
    showScreen(null);
    controls.classList.remove("hidden");
  }

  function endGame() {
    running = false;
    
    const best = Math.max(Number(localStorage.getItem("runnerBestScore") || 0), score);
    localStorage.setItem("runnerBestScore", String(best));

    document.getElementById("finalScore").textContent = score;
    document.getElementById("bestScore").textContent = best;
    document.getElementById("finalCoins").textContent = coins;

    document.getElementById("reviveButton").style.display = isRevived ? "none" : "block";

    hud.classList.add("hidden");
    controls.classList.add("hidden");
    showScreen('gameOver');
  }

  function watchAdAndRevive() {
    // Yahan future mein AdMob plugin ka code aayega
    alert("Ad watched! Player Revived.");
    isRevived = true;
    
    // Paas ke khatre hata do
    objects.forEach(obj => {
      if (obj.mesh.position.z > -20) {
        scene.remove(obj.mesh);
        obj.removed = true;
      }
    });
    
    running = true;
    paused = false;
    lastTime = performance.now();
    showScreen(null);
    hud.classList.remove("hidden");
    controls.classList.remove("hidden");
  }

  // --- CONTROLS ---
  function moveLeft() { if (running && !paused) playerLane = Math.max(-1, playerLane - 1); }
  function moveRight() { if (running && !paused) playerLane = Math.min(1, playerLane + 1); }
  function jump() {
    if (running && !paused && jumpHeight <= 0.1) jumpVelocity = 12;
  }

  // Swipe Gestures
  let swipeStartX = 0, swipeStartY = 0;
  canvas.addEventListener("pointerdown", e => { swipeStartX = e.clientX; swipeStartY = e.clientY; });
  canvas.addEventListener("pointerup", e => {
    if (!running || paused) return;
    const diffX = e.clientX - swipeStartX;
    const diffY = e.clientY - swipeStartY;
    if (Math.abs(diffX) < 30 && Math.abs(diffY) < 30) return;
    if (Math.abs(diffX) > Math.abs(diffY)) {
      diffX > 0 ? moveRight() : moveLeft();
    } else if (diffY < 0) {
      jump();
    }
  });

  window.addEventListener("keydown", e => {
    if (e.code === "ArrowLeft") moveLeft();
    if (e.code === "ArrowRight") moveRight();
    if (e.code === "ArrowUp" || e.code === "Space") jump();
  });

  // --- GAME LOOP & UPDATES ---
  function updateLogic(delta) {
    speed = Math.min(90, speed + delta * 0.4); 
    distance += speed * delta;
    score = Math.floor(distance) + coins * 25;
    scoreText.textContent = score;

    grid.position.z += speed * delta;
    if (grid.position.z > 0) grid.position.z = -10;

    // Player Movement & Physics
    if (playerModel) {
      const targetX = playerLane * laneWidth;
      playerModel.position.x += (targetX - playerModel.position.x) * Math.min(1, delta * 15);

      if (jumpVelocity !== 0 || jumpHeight > 0) {
        jumpHeight += jumpVelocity * delta;
        jumpVelocity -= 35 * delta; 
        if (jumpHeight <= 0) { jumpHeight = 0; jumpVelocity = 0; }
        playerModel.position.y = jumpHeight;
      }
    }

    // Object Spawning
    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      spawnObject();
      spawnTimer = Math.max(0.5, 1.5 - (speed - 40) / 80);
    }

    // Collision Detection
    const playerBox = new THREE.Box3().setFromObject(playerModel);
    playerBox.expandByScalar(-0.4); 

    for (let i = objects.length - 1; i >= 0; i--) {
      let obj = objects[i];
      if (obj.removed) continue;

      obj.mesh.position.z += speed * delta;
      if (obj.type === 'coin') obj.mesh.rotation.y += delta * 5; 

      const objBox = new THREE.Box3().setFromObject(obj.mesh);
      if (playerBox.intersectsBox(objBox)) {
        if (obj.type === 'coin') {
          coins++;
          coinsText.textContent = coins;
          scene.remove(obj.mesh);
          obj.removed = true;
        } else {
          endGame(); 
        }
      }

      if (obj.mesh.position.z > 10) {
        scene.remove(obj.mesh);
        obj.removed = true;
      }
    }
    objects = objects.filter(o => !o.removed);
  }

  function gameLoop(currentTime) {
    const delta = Math.min(0.05, (currentTime - lastTime) / 1000);
    lastTime = currentTime;
    if (running && !paused) updateLogic(delta);
    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
  }

  // --- BUTTON EVENT BINDINGS ---
  document.getElementById("playButton").addEventListener("click", startGame);
  document.getElementById("restartButton").addEventListener("click", startGame);
  document.getElementById("pauseButton").addEventListener("click", pauseGame);
  document.getElementById("resumeButton").addEventListener("click", resumeGame);
  
  document.getElementById("leftButton").addEventListener("pointerdown", moveLeft);
  document.getElementById("rightButton").addEventListener("pointerdown", moveRight);
  document.getElementById("jumpButton").addEventListener("pointerdown", jump);

  document.getElementById("pauseHomeButton").addEventListener("click", goHome);
  document.getElementById("gameOverHomeButton").addEventListener("click", goHome);
  document.getElementById("storeBtn").addEventListener("click", () => showScreen('store'));
  document.getElementById("profileBtn").addEventListener("click", () => showScreen('profile'));
  document.getElementById("settingsBtn").addEventListener("click", () => showScreen('settings'));
  document.querySelectorAll('.backHomeBtn').forEach(btn => btn.addEventListener('click', () => showScreen('menu')));

  document.getElementById("reviveButton").addEventListener("click", watchAdAndRevive);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  requestAnimationFrame(gameLoop);
})();
