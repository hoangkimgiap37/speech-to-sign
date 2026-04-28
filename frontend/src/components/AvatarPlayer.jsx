import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { buildSkeleton } from '../avatar/skeleton'
import { Animator } from '../avatar/animator'

export default function AvatarPlayer({ glosses, sessionKey, isFinal, onGlossChange, speed = 1, replayCount = 0 }) {
  const mountRef    = useRef(null)
  const animRef     = useRef(null)
  const isFinalRef  = useRef(isFinal)
  const onGCRef     = useRef(onGlossChange)
  const enqueuedRef = useRef(0)

  const [status, setStatus]           = useState('idle')
  const [activeGloss, setActiveGloss] = useState('')

  useEffect(() => { isFinalRef.current = isFinal }, [isFinal])
  useEffect(() => { onGCRef.current = onGlossChange }, [onGlossChange])

  // ── Three.js init ───────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const W = mount.clientWidth || 520
    const H = Math.round(W * (9 / 16))
    mount.style.height = H + 'px'

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x060c18)

    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100)
    camera.position.set(0, 0.35, 2.4)
    camera.lookAt(0, 0.2, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(1, 2, 2); scene.add(key)
    const fill = new THREE.DirectionalLight(0x8ec5fc, 0.35)
    fill.position.set(-1, 0.5, 1); scene.add(fill)

    const skeleton = buildSkeleton()
    scene.add(skeleton.root)

    const anim = new Animator(skeleton)
    anim.onGlossStart = (gloss) => {
      setActiveGloss(gloss)
      setStatus('playing')
      onGCRef.current?.(gloss.startsWith('FS:') ? null : gloss)
    }
    anim.onQueueDrained = (final) => {
      if (final) { setStatus('done'); setActiveGloss(''); onGCRef.current?.(null) }
      else        setStatus('waiting')
    }
    animRef.current = anim

    let rafId
    const loop = () => { rafId = requestAnimationFrame(loop); anim.update(); renderer.render(scene, camera) }
    loop()

    return () => {
      cancelAnimationFrame(rafId)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset on new session ────────────────────────────────────────────────
  useEffect(() => {
    const anim = animRef.current
    if (!anim) return
    anim.isFinal = false
    anim.reset()
    enqueuedRef.current = 0
    setStatus('idle')
    setActiveGloss('')
    onGCRef.current?.(null)
  }, [sessionKey])

  // ── Enqueue all glosses (including FS:) as they stream in ───────────────
  useEffect(() => {
    const anim = animRef.current
    if (!anim) return
    const all  = glosses || []
    const prev = enqueuedRef.current
    if (all.length <= prev) return
    all.slice(prev).forEach(g => anim.enqueue(g))
    enqueuedRef.current = all.length
  }, [glosses])

  // ── isFinal ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const anim = animRef.current
    if (!anim) return
    anim.isFinal = isFinal
    if (isFinal && status === 'waiting') {
      setStatus('done'); setActiveGloss(''); onGCRef.current?.(null)
    }
  }, [isFinal, status])

  // ── Speed ───────────────────────────────────────────────────────────────
  useEffect(() => { if (animRef.current) animRef.current.speed = speed }, [speed])

  // ── Replay ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (replayCount === 0) return
    const anim = animRef.current
    if (!anim || !(glosses?.length)) return
    anim.reset()
    anim.speed   = speed
    anim.isFinal = isFinal
    glosses.forEach(g => anim.enqueue(g))
    enqueuedRef.current = glosses.length
    setStatus('playing')
    setActiveGloss('')
  }, [replayCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFS     = activeGloss.startsWith('FS:')
  const fsLetter = isFS ? activeGloss.slice(3) : null

  return (
    <div className="avatar-wrap">
      <div className="avatar-canvas-wrap">
        <div ref={mountRef} className="avatar-canvas" />
        {fsLetter && (
          <div className="fs-overlay" key={fsLetter}>
            <span className="fs-letter">{fsLetter}</span>
            <span className="fs-label">đánh vần</span>
          </div>
        )}
      </div>
      <p className="video-info">
        {status === 'playing' && isFS  && <><span className="playing-dot" />Đánh vần: {activeGloss.slice(3)}</>}
        {status === 'playing' && !isFS && <><span className="playing-dot" />{activeGloss}</>}
        {status === 'waiting' && <>{activeGloss} · chờ...</>}
        {status === 'done'    && <><span className="done-check">✓</span> Hoàn thành</>}
      </p>
    </div>
  )
}
