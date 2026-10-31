<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

gsap.registerPlugin(ScrollTrigger)

const TITLE = 'HORIZON'
const TITLE_CHARS = TITLE.split('')
const SECTIONS = [
  {
    title: 'COSMOS',
    line1: 'Beyond the boundaries of imagination,',
    line2: 'lies the universe of possibilities',
  },
  {
    title: 'INFINITY',
    line1: 'In the space between thought and creation,',
    line2: 'we find the essence of true innovation',
  },
]
const totalSections = SECTIONS.length

const canvasRef = ref<HTMLCanvasElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const subtitleRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const scrollProgressRef = ref<HTMLElement | null>(null)

const scrollProgress = ref(0)
const currentSection = ref(1)

// Three.js objects, hors réactivité Vue (pas besoin de les suivre)
const refs = {
  scene: null as THREE.Scene | null,
  camera: null as THREE.PerspectiveCamera | null,
  renderer: null as THREE.WebGLRenderer | null,
  composer: null as EffectComposer | null,
  stars: [] as THREE.Points[],
  nebula: null as THREE.Mesh | null,
  mountains: [] as THREE.Mesh[],
  animationId: 0,
  locations: [] as number[],
  targetCameraX: 0,
  targetCameraY: 30,
  targetCameraZ: 300,
}

const smoothCameraPos = { x: 0, y: 30, z: 100 }

let introTimeline: gsap.core.Timeline | null = null
let cleanupTriggers: Array<() => void> = []

const pad = (n: number) => String(n).padStart(2, '0')

/* ---------- Création de la scène ---------- */

function createStarField() {
  const scene = refs.scene!
  const starCount = 5000

  for (let i = 0; i < 3; i++) {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(starCount * 3)
    const colors = new Float32Array(starCount * 3)
    const sizes = new Float32Array(starCount)

    for (let j = 0; j < starCount; j++) {
      const radius = 200 + Math.random() * 800
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)

      positions[j * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[j * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[j * 3 + 2] = radius * Math.cos(phi)

      const color = new THREE.Color()
      const colorChoice = Math.random()
      if (colorChoice < 0.7) {
        color.setHSL(0, 0, 0.8 + Math.random() * 0.2)
      } else if (colorChoice < 0.9) {
        color.setHSL(0.08, 0.5, 0.8)
      } else {
        color.setHSL(0.6, 0.5, 0.8)
      }

      colors[j * 3] = color.r
      colors[j * 3 + 1] = color.g
      colors[j * 3 + 2] = color.b

      sizes[j] = Math.random() * 2 + 0.5
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        depth: { value: i },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float time;
        uniform float depth;

        void main() {
          vColor = color;
          vec3 pos = position;

          float angle = time * 0.05 * (1.0 - depth * 0.3);
          mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
          pos.xy = rot * pos.xy;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          float opacity = 1.0 - smoothstep(0.0, 0.5, dist);
          gl_FragColor = vec4(vColor, opacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const stars = new THREE.Points(geometry, material)
    scene.add(stars)
    refs.stars.push(stars)
  }
}

function createNebula() {
  const geometry = new THREE.PlaneGeometry(8000, 4000, 100, 100)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color1: { value: new THREE.Color(0x0033ff) },
      color2: { value: new THREE.Color(0xff0066) },
      opacity: { value: 0.3 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vElevation;
      uniform float time;

      void main() {
        vUv = uv;
        vec3 pos = position;

        float elevation = sin(pos.x * 0.01 + time) * cos(pos.y * 0.01 + time) * 20.0;
        pos.z += elevation;
        vElevation = elevation;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color1;
      uniform vec3 color2;
      uniform float opacity;
      uniform float time;
      varying vec2 vUv;
      varying float vElevation;

      void main() {
        float mixFactor = sin(vUv.x * 10.0 + time) * cos(vUv.y * 10.0 + time);
        vec3 color = mix(color1, color2, mixFactor * 0.5 + 0.5);

        float alpha = opacity * (1.0 - length(vUv - 0.5) * 2.0);
        alpha *= 1.0 + vElevation * 0.01;

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  const nebula = new THREE.Mesh(geometry, material)
  nebula.position.z = -1050
  nebula.rotation.x = 0
  refs.scene!.add(nebula)
  refs.nebula = nebula
}

function createMountains() {
  const layers = [
    { distance: -50, height: 60, color: 0x1a1a2e, opacity: 1 },
    { distance: -100, height: 80, color: 0x16213e, opacity: 0.8 },
    { distance: -150, height: 100, color: 0x0f3460, opacity: 0.6 },
    { distance: -200, height: 120, color: 0x0a4668, opacity: 0.4 },
  ]

  layers.forEach((layer, index) => {
    const points: THREE.Vector2[] = []
    const segments = 50

    for (let i = 0; i <= segments; i++) {
      const x = (i / segments - 0.5) * 1000
      const y =
        Math.sin(i * 0.1) * layer.height +
        Math.sin(i * 0.05) * layer.height * 0.5 +
        Math.random() * layer.height * 0.2 -
        100
      points.push(new THREE.Vector2(x, y))
    }

    points.push(new THREE.Vector2(5000, -300))
    points.push(new THREE.Vector2(-5000, -300))

    const shape = new THREE.Shape(points)
    const geometry = new THREE.ShapeGeometry(shape)
    const material = new THREE.MeshBasicMaterial({
      color: layer.color,
      transparent: true,
      opacity: layer.opacity,
      side: THREE.DoubleSide,
    })

    const mountain = new THREE.Mesh(geometry, material)
    mountain.position.z = layer.distance
    mountain.position.y = layer.distance
    mountain.userData = { baseZ: layer.distance, index }
    refs.scene!.add(mountain)
    refs.mountains.push(mountain)
  })
}

function createAtmosphere() {
  const geometry = new THREE.SphereGeometry(600, 32, 32)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float time;

      void main() {
        float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        vec3 atmosphere = vec3(0.3, 0.6, 1.0) * intensity;

        float pulse = sin(time * 2.0) * 0.1 + 0.9;
        atmosphere *= pulse;

        gl_FragColor = vec4(atmosphere, intensity * 0.25);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
  })

  refs.scene!.add(new THREE.Mesh(geometry, material))
}

function storeMountainLocations() {
  refs.locations = refs.mountains.map((mountain) => mountain.position.z)
}

/* ---------- Boucle d'animation ---------- */

function animate() {
  refs.animationId = requestAnimationFrame(animate)

  const time = Date.now() * 0.001

  refs.stars.forEach((starField) => {
    const uniforms = (starField.material as THREE.ShaderMaterial).uniforms
    uniforms.time.value = time
  })

  if (refs.nebula) {
    const uniforms = (refs.nebula.material as THREE.ShaderMaterial).uniforms
    uniforms.time.value = time * 0.5
  }

  const camera = refs.camera
  if (camera) {
    const smoothingFactor = 0.05

    smoothCameraPos.x += (refs.targetCameraX - smoothCameraPos.x) * smoothingFactor
    smoothCameraPos.y += (refs.targetCameraY - smoothCameraPos.y) * smoothingFactor
    smoothCameraPos.z += (refs.targetCameraZ - smoothCameraPos.z) * smoothingFactor

    const floatX = Math.sin(time * 0.1) * 2
    const floatY = Math.cos(time * 0.15) * 1

    camera.position.x = smoothCameraPos.x + floatX
    camera.position.y = smoothCameraPos.y + floatY
    camera.position.z = smoothCameraPos.z
    camera.lookAt(0, 10, -600)
  }

  refs.mountains.forEach((mountain, i) => {
    const parallaxFactor = 1 + i * 0.5
    mountain.position.x = Math.sin(time * 0.1) * 2 * parallaxFactor
    mountain.position.y = 50 + Math.cos(time * 0.15) * 1 * parallaxFactor
  })

  refs.composer?.render()
}

/* ---------- Initialisation Three.js ---------- */

function initThree() {
  const canvas = canvasRef.value
  if (!canvas) return

  refs.scene = new THREE.Scene()
  refs.scene.fog = new THREE.FogExp2(0x000000, 0.00025)

  refs.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
  refs.camera.position.z = 100
  refs.camera.position.y = 20

  refs.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  refs.renderer.setSize(window.innerWidth, window.innerHeight)
  refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  refs.renderer.toneMapping = THREE.ACESFilmicToneMapping
  refs.renderer.toneMappingExposure = 0.5

  refs.composer = new EffectComposer(refs.renderer)
  refs.composer.addPass(new RenderPass(refs.scene, refs.camera))
  refs.composer.addPass(
    new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.4, 0.85),
  )

  createStarField()
  createNebula()
  createMountains()
  createAtmosphere()
  storeMountainLocations()

  animate()
}

/* ---------- Scroll et redimensionnement ---------- */

const cameraPositions = [
  { x: 0, y: 30, z: 300 }, // Section 0 : HORIZON
  { x: 0, y: 40, z: -50 }, // Section 1 : COSMOS
  { x: 0, y: 50, z: -700 }, // Section 2 : INFINITY
]

function handleScroll() {
  const scrollY = window.scrollY
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  const progress = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0

  scrollProgress.value = progress
  const newSection = Math.min(Math.floor(progress * totalSections), totalSections)
  currentSection.value = newSection

  const sectionProgress = (progress * totalSections) % 1
  const currentPos = cameraPositions[newSection] ?? cameraPositions[0]!
  const nextPos = cameraPositions[newSection + 1] ?? currentPos

  refs.targetCameraX = currentPos.x + (nextPos.x - currentPos.x) * sectionProgress
  refs.targetCameraY = currentPos.y + (nextPos.y - currentPos.y) * sectionProgress
  refs.targetCameraZ = currentPos.z + (nextPos.z - currentPos.z) * sectionProgress

  refs.mountains.forEach((mountain, i) => {
    const speed = 1 + i * 0.9
    const targetZ = mountain.userData.baseZ + scrollY * speed * 0.5
    refs.nebula!.position.z = targetZ + progress * speed * 0.01 - 100

    // Comportement d'origine : au-delà de 70 % du scroll, les montagnes sont repoussées très loin
    if (progress > 0.7) {
      mountain.position.z = 600000
    } else {
      mountain.position.z = refs.locations[i] ?? mountain.position.z
    }
  })

  if (refs.mountains[3] && refs.nebula) {
    refs.nebula.position.z = refs.mountains[3].position.z
  }
}

function handleResize() {
  const { camera, renderer, composer } = refs
  if (!camera || !renderer || !composer) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
}

/* ---------- Animation d'entrée GSAP ---------- */

function playIntro() {
  const tl = gsap.timeline()

  if (menuRef.value) {
    tl.from(menuRef.value, { x: -100, opacity: 0, duration: 1, ease: 'power3.out' })
  }

  const chars = titleRef.value?.querySelectorAll('.title-char')
  if (chars?.length) {
    tl.from(chars, { y: 200, opacity: 0, duration: 1.5, stagger: 0.05, ease: 'power4.out' }, '-=0.5')
  }

  const lines = subtitleRef.value?.querySelectorAll('.subtitle-line')
  if (lines?.length) {
    tl.from(lines, { y: 50, opacity: 0, duration: 1, stagger: 0.2, ease: 'power3.out' }, '-=0.8')
  }

  if (scrollProgressRef.value) {
    tl.from(scrollProgressRef.value, { opacity: 0, y: 50, duration: 1, ease: 'power2.out' }, '-=0.5')
  }

  introTimeline = tl
}

/* ---------- Cycle de vie ---------- */

onMounted(() => {
  initThree()
  playIntro()

  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll)
  handleScroll()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(refs.animationId)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll)

  introTimeline?.kill()
  cleanupTriggers.forEach((fn) => fn())
  cleanupTriggers = []

  refs.stars.forEach((starField) => {
    starField.geometry.dispose()
    ;(starField.material as THREE.Material).dispose()
  })
  refs.mountains.forEach((mountain) => {
    mountain.geometry.dispose()
    ;(mountain.material as THREE.Material).dispose()
  })
  if (refs.nebula) {
    refs.nebula.geometry.dispose()
    ;(refs.nebula.material as THREE.Material).dispose()
  }
  refs.composer?.dispose()
  refs.renderer?.dispose()
})
</script>

<template>
  <div class="relative w-full overflow-x-hidden bg-black text-white">
    <canvas ref="canvasRef" class="pointer-events-none fixed inset-0 h-full w-full" />

    <!-- Menu latéral -->
    <div ref="menuRef" class="fixed top-1/2 left-6 z-10 flex -translate-y-1/2 flex-col items-center gap-6">
      <div class="flex flex-col gap-1.5">
        <span class="block h-px w-6 bg-white/80" />
        <span class="block h-px w-6 bg-white/80" />
        <span class="block h-px w-6 bg-white/80" />
      </div>
      <div class="text-xs tracking-[0.4em] text-white/70 [writing-mode:vertical-rl]">SPACE</div>
    </div>

    <!-- Section d'accueil -->
    <section class="relative z-10 flex h-screen flex-col items-center justify-center px-6 text-center">
      <h1
        ref="titleRef"
        class="text-[clamp(56px,12vw,180px)] leading-none font-black tracking-tight"
      >
        <span v-for="(char, i) in TITLE_CHARS" :key="i" class="title-char inline-block">{{ char }}</span>
      </h1>
      <div ref="subtitleRef" class="mt-8 space-y-2 text-lg text-white/80 md:text-2xl">
        <p class="subtitle-line">Where vision meets reality,</p>
        <p class="subtitle-line">we shape the future of tomorrow</p>
      </div>
    </section>

    <!-- Sections défilantes -->
    <section
      v-for="section in SECTIONS"
      :key="section.title"
      class="relative z-10 flex h-screen flex-col items-center justify-center px-6 text-center"
    >
      <h2 class="text-[clamp(56px,12vw,180px)] leading-none font-black tracking-tight">
        {{ section.title }}
      </h2>
      <div class="mt-8 space-y-2 text-lg text-white/80 md:text-2xl">
        <p>{{ section.line1 }}</p>
        <p>{{ section.line2 }}</p>
      </div>
    </section>

    <!-- Indicateur de progression -->
    <div
      ref="scrollProgressRef"
      class="fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 text-xs tracking-[0.3em] text-white/70"
    >
      <span>SCROLL</span>
      <div class="h-px w-40 bg-white/20">
        <div class="h-px bg-white transition-[width] duration-150" :style="{ width: `${scrollProgress * 100}%` }" />
      </div>
      <span>{{ pad(currentSection) }} / {{ pad(totalSections) }}</span>
    </div>
  </div>
</template>
