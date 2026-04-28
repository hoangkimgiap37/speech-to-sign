/**
 * Avatar animation debug panel — opens at /?debug
 *
 * Sliders control all 6 joints in real-time.
 * "Play" previews the current stored animation for a gloss.
 * "Copy JSON" copies the current pose as a keyframe you can paste into glosses.js.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { buildSkeleton } from '../avatar/skeleton'
import { Animator } from '../avatar/animator'
import { GLOSS_ANIMS } from '../avatar/glosses'

const JOINTS = ['rightShoulder', 'rightElbow', 'rightWrist', 'leftShoulder', 'leftElbow', 'leftWrist']
const AXES   = ['x', 'y', 'z']
const DEG    = Math.PI / 180

const initPose = () => Object.fromEntries(JOINTS.map(j => [j, { x: 0, y: 0, z: 0 }]))

function applyPose(joints, pose) {
  for (const name of JOINTS) {
    const j = joints[name]
    const r = pose[name]
    if (j && r) { j.rotation.x = r.x * DEG; j.rotation.y = r.y * DEG; j.rotation.z = r.z * DEG }
  }
}

export default function AvatarDebug() {
  const mountRef  = useRef(null)
  const jointsRef = useRef(null)
  const animRef   = useRef(null)
  const [pose, setPose] = useState(initPose)
  const [gloss, setGloss] = useState('HELLO')
  const [playing, setPlaying] = useState(false)

  // ── Three.js init ────────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const W = 480, H = 270
    const scene    = new THREE.Scene()
    scene.background = new THREE.Color(0x0f172a)
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100)
    camera.position.set(0, 0.35, 2.4)
    camera.lookAt(0, 0.2, 0)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(1, 2, 2); scene.add(key)

    const skeleton = buildSkeleton()
    scene.add(skeleton.root)
    jointsRef.current = skeleton.joints

    const anim = new Animator(skeleton)
    anim.onQueueDrained = () => setPlaying(false)
    animRef.current = anim

    let rafId
    const loop = () => {
      rafId = requestAnimationFrame(loop)
      anim.update()
      renderer.render(scene, camera)
    }
    loop()

    return () => { cancelAnimationFrame(rafId); renderer.dispose(); mount.removeChild(renderer.domElement) }
  }, [])

  // Apply slider pose to skeleton when not playing
  useEffect(() => {
    if (!jointsRef.current || playing) return
    applyPose(jointsRef.current, pose)
  }, [pose, playing])

  const handleSlider = useCallback((joint, axis, value) => {
    setPose(prev => ({ ...prev, [joint]: { ...prev[joint], [axis]: Number(value) } }))
  }, [])

  const handlePlay = useCallback(() => {
    const anim = animRef.current
    if (!anim) return
    anim.reset()
    anim.isFinal = true
    anim.enqueue(gloss)
    setPlaying(true)
    setPose(initPose())
  }, [gloss])

  const handleStop = useCallback(() => {
    animRef.current?.reset()
    setPlaying(false)
  }, [])

  const copyJSON = useCallback(() => {
    const clean = {}
    for (const j of JOINTS) {
      const r = pose[j]
      clean[j] = { x: +r.x.toFixed(1), y: +r.y.toFixed(1), z: +r.z.toFixed(1) }
    }
    const text = JSON.stringify({ t: 0.0, pose: clean }, null, 2)
    navigator.clipboard.writeText(text).then(() => alert('Copied keyframe JSON!'))
  }, [pose])

  const resetPose = useCallback(() => { setPose(initPose()); animRef.current?.reset(); setPlaying(false) }, [])

  const glossList = Object.keys(GLOSS_ANIMS).sort()

  return (
    <div style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem', background: '#0f1117', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '13px' }}>

      {/* Canvas */}
      <div>
        <div ref={mountRef} style={{ borderRadius: 12, overflow: 'hidden' }} />
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select value={gloss} onChange={e => setGloss(e.target.value)}
            style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px' }}>
            {glossList.map(g => <option key={g}>{g}</option>)}
          </select>
          {!playing
            ? <Btn onClick={handlePlay} color="#1d4ed8">▶ Play</Btn>
            : <Btn onClick={handleStop} color="#7c3aed">■ Stop</Btn>}
          <Btn onClick={resetPose} color="#374151">Reset</Btn>
          <Btn onClick={copyJSON} color="#065f46">Copy JSON</Btn>
        </div>
        <p style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '11px' }}>
          Move sliders to pose, then Copy JSON → paste into glosses.js
        </p>
      </div>

      {/* Sliders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', flex: 1, alignContent: 'start' }}>
        {JOINTS.map(joint => (
          <div key={joint} style={{ background: '#1e293b', borderRadius: 8, padding: '0.75rem' }}>
            <div style={{ color: '#60a5fa', marginBottom: '0.4rem', fontSize: '12px', fontWeight: 600 }}>{joint}</div>
            {AXES.map(axis => (
              <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ width: 12, color: axis === 'x' ? '#f87171' : axis === 'y' ? '#4ade80' : '#60a5fa' }}>{axis}</span>
                <input type="range" min={-180} max={180} step={1}
                  value={pose[joint][axis]}
                  onChange={e => handleSlider(joint, axis, e.target.value)}
                  disabled={playing}
                  style={{ flex: 1, accentColor: '#3b82f6' }}
                />
                <span style={{ width: 36, textAlign: 'right', color: '#94a3b8' }}>{pose[joint][axis]}°</span>
              </div>
            ))}
          </div>
        ))}
      </div>

    </div>
  )
}

function Btn({ onClick, color, children }) {
  return (
    <button onClick={onClick} style={{
      background: color, color: '#fff', border: 'none', borderRadius: 6,
      padding: '4px 12px', cursor: 'pointer', fontSize: '13px',
    }}>{children}</button>
  )
}
