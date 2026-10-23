import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import glyphs from "./glyphs.json" with { type: "json" };

const LETTER_H = 1.88;
const EXTRUDE = {
  steps: 1,
  depth: 0.42,
  bevelEnabled: true,
  bevelThickness: 0.016,
  bevelSize: 0.014,
  bevelOffset: 0,
  bevelSegments: 3,
  curveSegments: 16,
};

export async function mountStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.42;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0c0e11, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0e11);
  scene.fog = new THREE.Fog(0x0c0e11, 12, 24);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 1.15;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0.2, 1.35, 7.1);

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: 0, y: 0 };
  let dragYaw = -0.32;
  let velocity = 0;
  let dragging = false;
  let lastX = 0;
  let idle = 0;
  let visible = true;
  let running = true;

  addRoom(scene);
  const dust = reduce ? null : addDust(scene);
  const rig = buildMark();
  scene.add(rig);

  const accent = new THREE.PointLight(0xe4d0a4, 0, 12, 2);
  accent.position.set(2.2, 1.7, 2.4);
  scene.add(accent);
  let accentTarget = 0;

  const look = new THREE.Vector3();

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const wide = window.innerWidth >= 980;
    const pr = Math.min(window.devicePixelRatio || 1, wide ? 1.75 : 1.35);
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.fov = wide ? 30 : 33;
    camera.updateProjectionMatrix();
  }

  function layoutCamera(immediate) {
    const wide = window.innerWidth >= 980;
    const lookY = wide ? 1.02 : 0.38;
    rig.position.x = wide ? -1.55 : 0;
    look.set(wide ? 0.45 : 0, lookY, 0);
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const aspect = Math.max(camera.aspect || 1, 0.2);
    const halfWidth = wide ? 3.5 : 3.2;
    const halfHeight = wide ? 2.05 : 2.2;
    const zFit = Math.max(halfWidth / (Math.tan(halfFov) * aspect), halfHeight / Math.tan(halfFov));
    const camZ = Math.max(wide ? 8.6 : 7.2, zFit);
    const camY = wide ? lookY + 0.28 : 1.62;
    const tx = look.x + pointer.x * (wide ? 0.22 : 0.06);
    const ty = camY - pointer.y * 0.06;
    if (immediate) {
      camera.position.set(tx, ty, camZ);
    } else {
      camera.position.x += (tx - camera.position.x) * 0.05;
      camera.position.y += (ty - camera.position.y) * 0.05;
      camera.position.z += (camZ - camera.position.z) * 0.08;
    }
    camera.lookAt(look);
  }

  function heroProgress() {
    const pin = canvas.closest(".hero-pin");
    if (!pin) return 0;
    const total = pin.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return THREE.MathUtils.clamp(-pin.getBoundingClientRect().top / total, 0, 1);
  }

  function frame(now) {
    if (!running || !visible) return;
    if (!reduce) {
      if (!dragging) {
        dragYaw += velocity;
        velocity *= 0.9;
        idle += 0.0015;
      }
      if (dust) driftDust(dust, now * 0.001);
    }
    accent.intensity += (accentTarget - accent.intensity) * 0.06;
    rig.rotation.y = dragYaw + idle + heroProgress() * 0.5;
    layoutCamera(false);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  resize();
  layoutCamera(true);
  canvas.classList.add("is-ready");
  requestAnimationFrame(frame);

  const ro = new ResizeObserver(() => {
    resize();
    layoutCamera(true);
  });
  ro.observe(canvas);

  window.addEventListener("pointermove", (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    if (!dragging) return;
    const dx = event.clientX - lastX;
    lastX = event.clientX;
    dragYaw += dx * 0.0052;
    velocity = dx * 0.0052;
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    lastX = event.clientX;
    velocity = 0;
    canvas.classList.add("is-dragging");
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
    canvas.classList.remove("is-dragging");
  });
  canvas.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      dragYaw -= 0.14;
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      dragYaw += 0.14;
      event.preventDefault();
    }
  });

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && running) requestAnimationFrame(frame);
    },
    { threshold: 0.02 }
  );
  io.observe(canvas);

  document.addEventListener("visibilitychange", () => {
    running = document.visibilityState === "visible";
    if (running && visible) requestAnimationFrame(frame);
  });

  return {
    setAccent(hex) {
      accent.color.set(hex);
      accentTarget = 22;
    },
  };
}

function buildMark() {
  const brushM = brushTexture("linear");
  const brushD = brushTexture("radial");
  const goldM = goldMaterial(brushM, Math.PI / 2);
  const goldD = goldMaterial(brushD, 0);

  const m = new THREE.Mesh(letterGeometry(glyphs.M), goldM);
  const d = new THREE.Mesh(letterGeometry(glyphs.D), goldD);
  m.castShadow = d.castShadow = true;
  m.receiveShadow = d.receiveShadow = true;

  const mW = glyphs.M.width * LETTER_H;
  const dW = glyphs.D.width * LETTER_H;
  const gap = 0.07;
  const plinthH = 0.56;
  const plinthW = mW + dW + gap + 1.25;
  const plinthD = 1.42;

  m.position.set(-(dW / 2 + gap / 2), plinthH, 0);
  d.position.set(mW / 2 + gap / 2, plinthH, 0);

  const label = madridLabel();
  const black = new THREE.MeshPhysicalMaterial({
    color: 0x070708,
    metalness: 0.62,
    roughness: 0.32,
    clearcoat: 0.45,
    clearcoatRoughness: 0.28,
    envMapIntensity: 0.55,
  });
  const top = black.clone();
  top.roughness = 0.16;
  top.metalness = 0.72;
  const front = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: label,
    metalness: 0.25,
    roughness: 0.42,
    envMapIntensity: 0.35,
  });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(plinthW, plinthH, plinthD), [
    black,
    black.clone(),
    top,
    black.clone(),
    front,
    black.clone(),
  ]);
  plinth.position.y = plinthH / 2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;

  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(plinthW * 1.25, plinthD * 1.7),
    new THREE.MeshBasicMaterial({
      map: contactShadow(),
      transparent: true,
      depthWrite: false,
    })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.025;

  const rig = new THREE.Group();
  rig.add(blob, plinth, m, d);
  return rig;
}

function letterGeometry(def) {
  const outer = def.contours.find((contour) => !contour.hole) || def.contours[0];
  const shape = new THREE.Shape();
  addContour(shape, outer.cmds, LETTER_H);
  for (const hole of def.contours) {
    if (!hole.hole) continue;
    const path = new THREE.Path();
    addContour(path, hole.cmds, LETTER_H);
    shape.holes.push(path);
  }
  const geo = new THREE.ExtrudeGeometry(shape, EXTRUDE);
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  geo.translate(
    -(box.max.x + box.min.x) / 2,
    -box.min.y,
    -(box.max.z + box.min.z) / 2
  );
  geo.computeVertexNormals();
  return geo;
}

function addContour(target, cmds, scale) {
  for (const cmd of cmds) {
    const x = cmd.x * scale;
    const y = cmd.y * scale;
    if (cmd.t === "M") target.moveTo(x, y);
    else if (cmd.t === "L") target.lineTo(x, y);
    else if (cmd.t === "Q") {
      target.quadraticCurveTo(cmd.x1 * scale, cmd.y1 * scale, x, y);
    } else if (cmd.t === "C") {
      target.bezierCurveTo(cmd.x1 * scale, cmd.y1 * scale, cmd.x2 * scale, cmd.y2 * scale, x, y);
    }
  }
}

function goldMaterial(roughnessMap, anisotropyRotation) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffe1aa,
    metalness: 1,
    roughness: 0.22,
    roughnessMap,
    anisotropy: 0.72,
    anisotropyRotation,
    clearcoat: 0.18,
    clearcoatRoughness: 0.35,
    envMapIntensity: 1.05,
  });
}

function addRoom(scene) {
  const concrete = noiseTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 20),
    new THREE.MeshStandardMaterial({
      color: 0x34383e,
      roughness: 0.72,
      metalness: 0.08,
      bumpMap: concrete,
      bumpScale: 0.015,
      envMapIntensity: 0.28,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2e3338,
    roughness: 0.94,
    metalness: 0.02,
    bumpMap: concrete,
    bumpScale: 0.03,
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), wallMat);
  back.position.set(0, 4.2, -4.6);
  back.receiveShadow = true;
  scene.add(back);

  const sideGeo = new THREE.PlaneGeometry(12, 9);
  const left = new THREE.Mesh(sideGeo, wallMat);
  left.position.set(-6.2, 4.2, 0.4);
  left.rotation.y = Math.PI / 2;
  left.receiveShadow = true;
  const right = new THREE.Mesh(sideGeo, wallMat.clone());
  right.position.set(6.4, 4.2, 0.2);
  right.rotation.y = -Math.PI / 2;
  scene.add(left, right);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 12),
    new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 1, metalness: 0 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 7.1;
  scene.add(ceiling);

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.15),
    new THREE.MeshBasicMaterial({ color: 0xfff6e8 })
  );
  sky.rotation.x = Math.PI / 2;
  sky.position.set(0.35, 7.08, 0.15);
  scene.add(sky);

  const shaft = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 7.2),
    new THREE.MeshBasicMaterial({
      map: shaftTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      color: 0xffe7c2,
      opacity: 0.12,
    })
  );
  shaft.position.set(0.15, 3.7, 0.35);
  shaft.rotation.x = 0.18;
  scene.add(shaft);

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(2.15, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffe2b0,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(1.15, 0.02, 1.85);
  scene.add(pool);

  scene.add(new THREE.HemisphereLight(0xfff4e4, 0x1a1c20, 0.38));

  const key = new THREE.DirectionalLight(0xfff6e8, 5.2);
  key.position.set(1.4, 8.2, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 22;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.02;
  key.target.position.set(-0.4, 1, 0);
  scene.add(key, key.target);

  const rim = new THREE.DirectionalLight(0xc5d4e6, 1.15);
  rim.position.set(-4.8, 3.4, -2.2);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xffe6c4, 0.7);
  fill.position.set(4.2, 1.6, 4.4);
  scene.add(fill);

  const front = new THREE.DirectionalLight(0xfff8ee, 2.4);
  front.position.set(0.2, 2.2, 8);
  scene.add(front);
}

function addDust(scene) {
  const count = 110;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.35) * 2.4;
    positions[i * 3 + 1] = Math.random() * 6.2;
    positions[i * 3 + 2] = (Math.random() - 0.2) * 1.8;
    speeds[i] = 0.08 + Math.random() * 0.22;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xfff4dd,
      size: 0.016,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );
  points.userData.speeds = speeds;
  scene.add(points);
  return points;
}

function driftDust(points, time) {
  const pos = points.geometry.attributes.position;
  const speeds = points.userData.speeds;
  for (let i = 0; i < speeds.length; i += 1) {
    let y = pos.getY(i) - speeds[i] * 0.012;
    if (y < 0.3) y = 6.1;
    const sway = Math.sin(time * 0.6 + i) * 0.002;
    pos.setY(i, y);
    pos.setX(i, pos.getX(i) + sway);
  }
  pos.needsUpdate = true;
}

function brushTexture(mode) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let n;
      if (mode === "radial") {
        const angle = Math.atan2(y - 256, x - 256);
        n = 148 + Math.sin(angle * 90) * 42 + Math.random() * 14;
      } else {
        n = 136 + Math.sin(y * 0.9) * 38 + Math.random() * 14;
      }
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = n;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(mode === "radial" ? 1 : 1.4, mode === "radial" ? 1 : 3);
  tex.anisotropy = 8;
  return tex;
}

function noiseTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(256, 256);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = 120 + Math.random() * 50;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = n;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function shaftTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const vertical = ctx.createLinearGradient(0, 0, 0, 512);
  vertical.addColorStop(0, "rgba(255,246,230,0)");
  vertical.addColorStop(0.18, "rgba(255,246,230,0.75)");
  vertical.addColorStop(1, "rgba(255,246,230,0)");
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, 128, 512);
  ctx.globalCompositeOperation = "destination-in";
  const side = ctx.createLinearGradient(0, 0, 128, 0);
  side.addColorStop(0, "rgba(0,0,0,0)");
  side.addColorStop(0.5, "rgba(0,0,0,1)");
  side.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, 128, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function contactShadow() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(128, 128, 20, 128, 128, 122);
  grd.addColorStop(0, "rgba(0,0,0,0.5)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function madridLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#050506";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(228,208,164,0.28)";
    ctx.lineWidth = 3;
    ctx.strokeRect(70, 70, canvas.width - 140, canvas.height - 140);
    ctx.fillStyle = "#e7d3a6";
    ctx.font = '500 228px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Madrid", canvas.width / 2, canvas.height / 2 + 12);
    tex.needsUpdate = true;
  };

  draw();
  document.fonts
    .load('500 64px "Cormorant Garamond"')
    .then(draw)
    .catch(() => {});
  return tex;
}
