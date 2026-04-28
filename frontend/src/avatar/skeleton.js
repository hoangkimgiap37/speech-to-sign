import * as THREE from 'three'

const SKIN  = 0xf0c090
const SHIRT = 0x334155
const HAIR  = 0x2d1b0e

function box(w, h, d, color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  )
}

function sphere(r, color) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(r, 12, 10),
    new THREE.MeshLambertMaterial({ color })
  )
}

function cylinder(r, h, color) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 8),
    new THREE.MeshLambertMaterial({ color })
  )
}

/**
 * Build an upper-body stick figure.
 * Arm hierarchy (right side):
 *   rightShoulder (Group) → upper arm mesh
 *     └─ rightElbow (Group) → forearm mesh
 *           └─ rightWrist (Group) → hand mesh
 *
 * All joints default to rotation (0,0,0) → arms hang straight down.
 * Animations rotate these groups to pose the figure.
 */
export function buildSkeleton() {
  const root = new THREE.Group()

  // ── Torso ──────────────────────────────────────────────────────────────────
  const torso = box(0.40, 0.52, 0.20, SHIRT)
  root.add(torso)

  // ── Neck + Head ────────────────────────────────────────────────────────────
  const neck = cylinder(0.07, 0.12, SKIN)
  neck.position.y = 0.32
  root.add(neck)

  const head = sphere(0.19, SKIN)
  head.position.y = 0.50
  root.add(head)

  // Hair cap
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.195, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshLambertMaterial({ color: HAIR })
  )
  hair.position.y = 0.51
  root.add(hair)

  // ── Eyes (simple dots) ─────────────────────────────────────────────────────
  for (const sx of [-0.065, 0.065]) {
    const eye = sphere(0.030, 0x111111)
    eye.position.set(sx, 0.515, 0.17)
    root.add(eye)
  }

  // ── Arms ───────────────────────────────────────────────────────────────────
  const buildArm = (side) => {
    const sx = side === 'right' ? 1 : -1

    // Shoulder pivot — origin at shoulder socket
    const shoulder = new THREE.Group()
    shoulder.position.set(sx * 0.225, 0.21, 0)
    root.add(shoulder)

    const upperArmMesh = cylinder(0.065, 0.30, side === 'right' ? SHIRT : SHIRT)
    upperArmMesh.position.y = -0.15
    shoulder.add(upperArmMesh)

    // Elbow pivot
    const elbow = new THREE.Group()
    elbow.position.y = -0.30
    shoulder.add(elbow)

    const forearmMesh = cylinder(0.055, 0.26, SKIN)
    forearmMesh.position.y = -0.13
    elbow.add(forearmMesh)

    // Wrist pivot
    const wrist = new THREE.Group()
    wrist.position.y = -0.26
    elbow.add(wrist)

    const handMesh = box(0.11, 0.14, 0.055, SKIN)
    handMesh.position.y = -0.07
    wrist.add(handMesh)

    return { shoulder, elbow, wrist }
  }

  const right = buildArm('right')
  const left  = buildArm('left')

  return {
    root,
    joints: {
      rightShoulder: right.shoulder,
      rightElbow:    right.elbow,
      rightWrist:    right.wrist,
      leftShoulder:  left.shoulder,
      leftElbow:     left.elbow,
      leftWrist:     left.wrist,
    },
  }
}
