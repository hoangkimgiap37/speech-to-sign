import * as THREE from 'three'
import { getAnim } from './glosses'

const DEG = Math.PI / 180

const JOINT_NAMES = [
  'rightShoulder', 'rightElbow', 'rightWrist',
  'leftShoulder',  'leftElbow',  'leftWrist',
]

function lerp(a, b, t) { return a + (b - a) * t }

function lerpPose(a, b, t) {
  const out = {}
  for (const name of JOINT_NAMES) {
    out[name] = {
      x: lerp(a[name].x, b[name].x, t),
      y: lerp(a[name].y, b[name].y, t),
      z: lerp(a[name].z, b[name].z, t),
    }
  }
  return out
}

function applyPose(joints, pose) {
  for (const name of JOINT_NAMES) {
    const joint = joints[name]
    const rot   = pose[name]
    if (joint && rot) {
      joint.rotation.x = rot.x * DEG
      joint.rotation.y = rot.y * DEG
      joint.rotation.z = rot.z * DEG
    }
  }
}

function restPose() {
  const out = {}
  for (const name of JOINT_NAMES) out[name] = { x: 0, y: 0, z: 0 }
  return out
}

/**
 * Drives the skeleton through a queue of gloss animations.
 *
 * Usage:
 *   const anim = new Animator(skeleton)
 *   anim.onGlossStart = (gloss) => { ... }
 *   anim.onQueueDrained = (isFinal) => { ... }
 *   anim.enqueue('HELLO')
 *   // call anim.update() every frame
 */
export class Animator {
  constructor(skeleton) {
    this.joints  = skeleton.joints
    this.queue   = []
    this.current = null
    this.elapsed = 0
    this.lastMs  = null
    this.isFinal = false
    this.speed   = 1

    this.onGlossStart   = null
    this.onQueueDrained = null

    applyPose(this.joints, restPose())
  }

  enqueue(gloss) {
    this.queue.push(gloss)
    if (!this.current) this._next()
  }

  reset() {
    this.queue   = []
    this.current = null
    this.elapsed = 0
    this.lastMs  = null
    this.isFinal = false
    applyPose(this.joints, restPose())
  }

  update() {
    const now = performance.now()
    if (this.lastMs === null) { this.lastMs = now; return }
    const dt = (now - this.lastMs) / 1000 * this.speed
    this.lastMs = now

    if (!this.current) return

    this.elapsed = Math.min(this.elapsed + dt, this.current.duration)

    // Find surrounding keyframes
    const { frames, duration } = this.current
    const t = this.elapsed
    let fA = frames[0]
    let fB = frames[frames.length - 1]
    for (let i = 0; i < frames.length - 1; i++) {
      if (frames[i].t <= t && frames[i + 1].t >= t) {
        fA = frames[i]; fB = frames[i + 1]; break
      }
    }
    const span = fB.t - fA.t
    const alpha = span > 0 ? (t - fA.t) / span : 1
    applyPose(this.joints, lerpPose(fA.pose, fB.pose, Math.max(0, Math.min(1, alpha))))

    if (this.elapsed >= duration) this._advance()
  }

  _next() {
    if (this.queue.length === 0) {
      this.current = null
      this.onQueueDrained?.(this.isFinal)
      return
    }
    const gloss = this.queue.shift()
    this.current = { gloss, ...getAnim(gloss) }
    this.elapsed = 0
    this.onGlossStart?.(gloss)
  }

  _advance() {
    if (this.queue.length > 0) {
      this._next()
    } else {
      this.current = null
      this.onQueueDrained?.(this.isFinal)
    }
  }
}
