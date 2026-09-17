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
  let invincibilityTimer = 0; // Revive hone ke baad bachne ke liye

  // Player Mechanics
  let playerLane = 0; // -1 (Left), 0 (Center), 1 (Right)
  let jumpHeight = 0;
  let jumpVelocity = 0;
  const laneWidth = 3;

  // --- THREE.JS INITIALIZATION ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x5eb3ff); // Sky Blue color
  scene.fog = new THREE.Fog(0x5eb3ff, 20, 100);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 4, 8);
  camera.lookAt(0, 1, 0);

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  // --- ENVIRONMENT: ROAD & BUILDINGS ---
  const roadGeo = new THREE.PlaneGeometry(12, 200);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.z = -50;
  scene.add(road);

  const buildings = [];
  const buildGeo = new THREE.BoxGeometry(3, 20, 3);
  const buildMat = new THREE.MeshStandardMaterial({ color: 0x111122 });
  for(let i = 0; i < 20; i++) {
    const b = new THREE.Mesh(buildGeo, buildMat);
    b.position.x = (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 5);
    b.position.y = 10;
    b.position.z = - (Math.random() * 150);
    scene.add(b);
    buildings.push(b);
  }

  // --- LOAD PLAYER MODEL & ANIMATION ---
  let playerModel = new THREE.Group(); 
  scene.add(playerModel);
  let mixer; // Animation chalane ke liye

  const loader = new THREE.GLTFLoader();
  loader.load('../assets/models/Rigged male character model.glb', (gltf) => {
    scene.remove(playerModel);
    playerModel = gltf.scene;
    playerModel.scale.set(1.2, 1.2, 1.2);
    playerModel.position.set(0, 0, 0);
    playerModel.rotation.y = Math.PI; // Character ko aage ki taraf mooh karne ke liye
    scene.add(playerModel);

    // Agar model mein animation hai toh usko play karo
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(playerModel);
      const action = mixer.clipAction(gltf.animations[0]);
      action.play();
    }
  }, undefined, (e) => console.log('Model loading error:', e));

  // --- OBSTACLES & COINS SPAWNING ---
  function spawnObject() {
    const lane = Math.floor(Math.random() * 3) - 1; 
    const isCoin = Math.random() < 0.5;
    
    let mesh;
    if (isCoin) {
      const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xb8860b });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = 1; 
    } else {
      const geo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
      const mat = new THREE.MeshStandardMaterial({ color: 0xe74c3c, emissive: 0x800000 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.9;
    }

    mesh.position.x = lane * laneWidth;
    mesh.position.z = -100; // Door se spawn hoga
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
    isRevived = false; invincibilityTimer = 0;

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
    localStorage.setItem("runnerTotalCoins", Number(localStorage.getItem("runnerTotalCoins") || 0) + coins);

    document.getElementById("finalScore").textContent = score;
    document.getElementById("bestScore").textContent = best;
    document.getElementById("finalCoins").textContent = coins;

    document.getElementById("reviveButton").style.display = isRevived ? "none" : "block";

    hud.classList.add("hidden");
    controls.classList.add("hidden");
    showScreen('gameOver');
  }

  function watchAdAndRevive() {
    alert("Ad watched! Player Revived.");
    isRevived = true;
    invincibilityTimer = 3; // 3 second tak koi takkar nahi hogi
    
    objects.forEach(obj => {
      if (obj.mesh.position.z > -30) {
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
    if (running && !paused && jumpHeight <= 0.1) jumpVelocity = 15;
  }

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
  function gameLoop(currentTime) {
    const delta = Math.min(0.05, (currentTime - lastTime) / 1000);
    lastTime = currentTime;

    // Environment background hamesha chalega (Menu mein bhi)
    const currentSpeed = (running && !paused) ? speed : 15;
    road.position.z += currentSpeed * delta;
    if (road.position.z > 0) road.position.z = -50;
    
    buildings.forEach(b => {
      b.position.z += currentSpeed * delta;
      if(b.position.z > 10) b.position.z = -150 - Math.random() * 50;
    });

    if (running && !paused) {
      if (mixer) mixer.update(delta); // Animation Update

      speed = Math.min(90, speed + delta * 0.5); 
      distance += speed * delta;
      score = Math.floor(distance) + coins * 25;
      scoreText.textContent = score;

      if (invincibilityTimer > 0) invincibilityTimer -= delta;

      // Player Movement & Physics
      if (playerModel) {
        const targetX = playerLane * laneWidth;
        playerModel.position.x += (targetX - playerModel.position.x) * Math.min(1, delta * 15);

        // Backup Animation (agar model mein default running nahi hai)
        if (!mixer && jumpHeight <= 0) {
          playerModel.position.y = Math.abs(Math.sin(currentTime * 0.015)) * 0.2; 
        }

        if (jumpVelocity !== 0 || jumpHeight > 0) {
          jumpHeight += jumpVelocity * delta;
          jumpVelocity -= 40 * delta; // Gravity
          if (jumpHeight <= 0) { jumpHeight = 0; jumpVelocity = 0; }
          playerModel.position.y = jumpHeight;
        }

        // Blinking effect when invincible
        playerModel.visible = invincibilityTimer > 0 ? (Math.floor(currentTime / 100) % 2 === 0) : true;
      }

      // Object Spawning
      spawnTimer -= delta;
      if (spawnTimer <= 0) {
        spawnObject();
        spawnTimer = Math.max(0.4, 1.2 - (speed - 40) / 80);
      }

      // Exact Hitbox Collision Logic
      const pX = playerModel.position.x;
      const pY = playerModel.position.y;
      const pZ = playerModel.position.z;
      const playerBox = new THREE.Box3(
        new THREE.Vector3(pX - 0.5, pY, pZ - 0.5),
        new THREE.Vector3(pX + 0.5, pY + 1.8, pZ + 0.5)
      );

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
          } else if (invincibilityTimer <= 0) {
            endGame(); // Hit Barrier
          }
        }

        if (obj.mesh.position.z > 10) {
          scene.remove(obj.mesh);
          obj.removed = true;
        }
      }
      objects = objects.filter(o => !o.removed);
    }

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
      
