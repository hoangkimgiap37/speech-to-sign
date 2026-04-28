/**
 * Keyframe animation data for VNSL glosses.
 *
 * Coordinate notes (Three.js right-hand, arm hanging down = local -Y):
 *   shoulder.x negative → arm raises FORWARD (toward viewer)
 *   shoulder.z negative → RIGHT arm raises OUTWARD; positive → inward
 *   shoulder.z positive → LEFT  arm raises OUTWARD; negative → inward
 *   elbow.z    negative → right forearm swings inward (arm curls toward chest)
 *   elbow.x    negative → forearm raises forward relative to upper arm
 *
 * All angles in degrees.
 */

const R = (x, y = 0, z = 0) => ({ x, y, z })
const REST_POSE = {
  rightShoulder: R(0), rightElbow: R(0), rightWrist: R(0),
  leftShoulder:  R(0), leftElbow:  R(0), leftWrist:  R(0),
}
const rest = () => JSON.parse(JSON.stringify(REST_POSE))

// Helpers to build common arm positions
const rightArmRaised   = (sx = -60, sz = -40, ex = 0, ez = -50) => ({
  rightShoulder: R(sx, 0, sz), rightElbow: R(ex, 0, ez), rightWrist: R(0),
  leftShoulder: R(0), leftElbow: R(0), leftWrist: R(0),
})
const leftArmRaised    = (sx = -60, sz = 40, ex = 0, ez = 50) => ({
  leftShoulder: R(sx, 0, sz), leftElbow: R(ex, 0, ez), leftWrist: R(0),
  rightShoulder: R(0), rightElbow: R(0), rightWrist: R(0),
})

// ── Animation library ──────────────────────────────────────────────────────

export const GLOSS_ANIMS = {

  HELLO: {
    duration: 1.6,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-55, 0, -45), rightElbow: R(0, 0, -55), rightWrist: R(0) } },
      { t: 0.7, pose: { ...rest(), rightShoulder: R(-55, 0, -45), rightElbow: R(0, 0, -55), rightWrist: R(0, 0, 25) } },
      { t: 1.0, pose: { ...rest(), rightShoulder: R(-55, 0, -45), rightElbow: R(0, 0, -55), rightWrist: R(0, 0, -25) } },
      { t: 1.3, pose: { ...rest(), rightShoulder: R(-55, 0, -45), rightElbow: R(0, 0, -55), rightWrist: R(0) } },
      { t: 1.6, pose: rest() },
    ],
  },

  GOODBYE: {
    duration: 1.4,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-40, 0, -30), rightElbow: R(0, 0, -40), rightWrist: R(0, 0, 20) } },
      { t: 0.8, pose: { ...rest(), rightShoulder: R(-40, 0, -30), rightElbow: R(0, 0, -40), rightWrist: R(0, 0, -20) } },
      { t: 1.1, pose: { ...rest(), rightShoulder: R(-20, 0, -15), rightElbow: R(0) } },
      { t: 1.4, pose: rest() },
    ],
  },

  THANK_YOU: {
    duration: 1.2,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-30, 0, -10), rightElbow: R(-80, 0, -20) } },
      { t: 0.8, pose: { ...rest(), rightShoulder: R(-65, 0, -10), rightElbow: R(-20, 0, 0) } },
      { t: 1.2, pose: rest() },
    ],
  },

  SORRY: {
    duration: 1.2,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-30, 0, -5), rightElbow: R(-75, 0, -25) } },
      { t: 0.7, pose: { ...rest(), rightShoulder: R(-35, 0, -5), rightElbow: R(-75, 0, -25), rightWrist: R(15) } },
      { t: 1.0, pose: { ...rest(), rightShoulder: R(-25, 0, -5), rightElbow: R(-75, 0, -25), rightWrist: R(-15) } },
      { t: 1.2, pose: rest() },
    ],
  },

  YES: {
    duration: 1.0,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.3, pose: { ...rest(), rightShoulder: R(-40, 0, -10), rightElbow: R(-70, 0, -20) } },
      { t: 0.5, pose: { ...rest(), rightShoulder: R(-45, 0, -10), rightElbow: R(-80, 0, -20) } },
      { t: 0.7, pose: { ...rest(), rightShoulder: R(-35, 0, -10), rightElbow: R(-60, 0, -20) } },
      { t: 1.0, pose: rest() },
    ],
  },

  NO: {
    duration: 1.0,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.25, pose: { ...rest(), rightShoulder: R(-50, 0, -20), rightElbow: R(0, 0, -50), rightWrist: R(0, 30) } },
      { t: 0.50, pose: { ...rest(), rightShoulder: R(-50, 0, -20), rightElbow: R(0, 0, -50), rightWrist: R(0, -30) } },
      { t: 0.75, pose: { ...rest(), rightShoulder: R(-50, 0, -20), rightElbow: R(0, 0, -50), rightWrist: R(0, 30) } },
      { t: 1.0,  pose: rest() },
    ],
  },

  ME: {
    duration: 0.8,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-20, 0, 0), rightElbow: R(-90, 0, -15) } },
      { t: 0.8, pose: rest() },
    ],
  },

  YOU: {
    duration: 0.8,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-75, 0, -10), rightElbow: R(0, 0, -5) } },
      { t: 0.8, pose: rest() },
    ],
  },

  YOU_MALE:   { duration: 0.8, frames: [{ t: 0.0, pose: rest() }, { t: 0.4, pose: { ...rest(), rightShoulder: R(-75, 0, -10) } }, { t: 0.8, pose: rest() }] },
  YOU_FEMALE: { duration: 0.8, frames: [{ t: 0.0, pose: rest() }, { t: 0.4, pose: { ...rest(), rightShoulder: R(-75, 0, -10) } }, { t: 0.8, pose: rest() }] },

  WE: {
    duration: 1.0,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.3, pose: { ...rest(), rightShoulder: R(-30, 0, -10), rightElbow: R(-80, 0, -20) } },
      { t: 0.6, pose: { ...rest(), rightShoulder: R(-50, 0, 30), rightElbow: R(-30, 0, 10) } },
      { t: 1.0, pose: rest() },
    ],
  },

  WANT: {
    duration: 1.2,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: {
        rightShoulder: R(-50, 0, 25), rightElbow: R(0, 0, -10), rightWrist: R(0),
        leftShoulder: R(-50, 0, -25), leftElbow: R(0, 0, 10),  leftWrist: R(0),
      }},
      { t: 0.9, pose: {
        rightShoulder: R(-30, 0, 5), rightElbow: R(-30, 0, -20), rightWrist: R(0),
        leftShoulder: R(-30, 0, -5), leftElbow: R(-30, 0, 20),  leftWrist: R(0),
      }},
      { t: 1.2, pose: rest() },
    ],
  },

  NEED: {
    duration: 1.0,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.35, pose: { ...rest(), rightShoulder: R(-60, 0, 10), rightElbow: R(0, 0, -40) } },
      { t: 0.65, pose: { ...rest(), rightShoulder: R(-75, 0, 10), rightElbow: R(0, 0, -40) } },
      { t: 1.0,  pose: rest() },
    ],
  },

  LOVE: {
    duration: 1.2,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.5, pose: {
        rightShoulder: R(-20, 0, 25), rightElbow: R(-30, 0, -70), rightWrist: R(0),
        leftShoulder: R(-20, 0, -25), leftElbow: R(-30, 0, 70),  leftWrist: R(0),
      }},
      { t: 1.2, pose: rest() },
    ],
  },

  LIKE: {
    duration: 0.9,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-25, 0, -5), rightElbow: R(-70, 0, -30) } },
      { t: 0.7, pose: { ...rest(), rightShoulder: R(-35, 0, -5), rightElbow: R(-60, 0, -30) } },
      { t: 0.9, pose: rest() },
    ],
  },

  EAT: {
    duration: 1.1,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-30, 0, -5), rightElbow: R(-90, 0, -25) } },
      { t: 0.65, pose: { ...rest(), rightShoulder: R(-35, 0, -5), rightElbow: R(-95, 0, -25) } },
      { t: 0.85, pose: { ...rest(), rightShoulder: R(-25, 0, -5), rightElbow: R(-85, 0, -25) } },
      { t: 1.1, pose: rest() },
    ],
  },

  DRINK: {
    duration: 1.1,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-25, 0, -5), rightElbow: R(-80, 0, -20), rightWrist: R(-20) } },
      { t: 0.7, pose: { ...rest(), rightShoulder: R(-35, 0, -5), rightElbow: R(-100, 0, -20), rightWrist: R(-30) } },
      { t: 1.1, pose: rest() },
    ],
  },

  STUDY: {
    duration: 1.0,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.3, pose: {
        rightShoulder: R(-50, 0, 20), rightElbow: R(0, 0, -50), rightWrist: R(0),
        leftShoulder: R(-50, 0, -20), leftElbow: R(0, 0, 50),  leftWrist: R(0),
      }},
      { t: 0.6, pose: {
        rightShoulder: R(-55, 0, 20), rightElbow: R(0, 0, -55), rightWrist: R(10),
        leftShoulder: R(-55, 0, -20), leftElbow: R(0, 0, 55),  leftWrist: R(-10),
      }},
      { t: 1.0, pose: rest() },
    ],
  },

  WORK: {
    duration: 1.2,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.3, pose: {
        rightShoulder: R(-40, 0, 15), rightElbow: R(0, 0, -60), rightWrist: R(0),
        leftShoulder: R(-40, 0, -15), leftElbow: R(0, 0, 60),  leftWrist: R(0),
      }},
      { t: 0.6, pose: {
        rightShoulder: R(-50, 0, 10), rightElbow: R(0, 0, -50), rightWrist: R(15),
        leftShoulder: R(-30, 0, -20), leftElbow: R(0, 0, 70),  leftWrist: R(-15),
      }},
      { t: 0.9, pose: {
        rightShoulder: R(-30, 0, 20), rightElbow: R(0, 0, -70), rightWrist: R(-15),
        leftShoulder: R(-50, 0, -10), leftElbow: R(0, 0, 50),  leftWrist: R(15),
      }},
      { t: 1.2, pose: rest() },
    ],
  },

  GO: {
    duration: 0.9,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-80, 0, -5), rightElbow: R(0, 0, -5) } },
      { t: 0.9, pose: rest() },
    ],
  },

  HELP: {
    duration: 1.0,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: {
        rightShoulder: R(-45, 0, 20), rightElbow: R(0, 0, -45), rightWrist: R(0),
        leftShoulder: R(-45, 0, -20), leftElbow: R(0, 0, 45),  leftWrist: R(0),
      }},
      { t: 0.7, pose: {
        rightShoulder: R(-60, 0, 15), rightElbow: R(0, 0, -40), rightWrist: R(0),
        leftShoulder: R(-60, 0, -15), leftElbow: R(0, 0, 40),  leftWrist: R(0),
      }},
      { t: 1.0, pose: rest() },
    ],
  },

  UNDERSTAND: {
    duration: 0.8,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-30, 0, -5), rightElbow: R(-95, 0, -30), rightWrist: R(0, 0, 20) } },
      { t: 0.8, pose: rest() },
    ],
  },

  KNOW: {
    duration: 0.9,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.35, pose: { ...rest(), rightShoulder: R(-30, 0, -10), rightElbow: R(-85, 0, -30) } },
      { t: 0.65, pose: { ...rest(), rightShoulder: R(-60, 0, -10), rightElbow: R(-20, 0, -10) } },
      { t: 0.9, pose: rest() },
    ],
  },

  GOOD: {
    duration: 0.9,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-25, 0, -5), rightElbow: R(-70, 0, -20), rightWrist: R(-10) } },
      { t: 0.7, pose: { ...rest(), rightShoulder: R(-55, 0, -5), rightElbow: R(-10, 0, -5) } },
      { t: 0.9, pose: rest() },
    ],
  },

  BAD: {
    duration: 0.9,
    frames: [
      { t: 0.0, pose: rest() },
      { t: 0.4, pose: { ...rest(), rightShoulder: R(-25, 0, -5), rightElbow: R(-70, 0, -20) } },
      { t: 0.7, pose: { ...rest(), rightShoulder: R(-15, 0, 10), rightElbow: R(0, 0, -20), rightWrist: R(0, 0, 30) } },
      { t: 0.9, pose: rest() },
    ],
  },

  HAPPY: { duration: 1.0, frames: [
    { t: 0, pose: rest() },
    { t: 0.3, pose: { ...rest(), rightShoulder: R(-30, 0, -5), rightElbow: R(-60, 0, -30), rightWrist: R(0, 0, 15) } },
    { t: 0.6, pose: { ...rest(), rightShoulder: R(-35, 0, -5), rightElbow: R(-65, 0, -30), rightWrist: R(0, 0, -15) } },
    { t: 1.0, pose: rest() },
  ]},

  SAD: { duration: 1.0, frames: [
    { t: 0, pose: rest() },
    { t: 0.5, pose: {
      rightShoulder: R(-20, 0, 10), rightElbow: R(-50, 0, -15), rightWrist: R(20),
      leftShoulder: R(-20, 0, -10), leftElbow: R(-50, 0, 15),  leftWrist: R(20),
    }},
    { t: 1.0, pose: rest() },
  ]},

  TODAY: { duration: 0.8, frames: [
    { t: 0, pose: rest() },
    { t: 0.4, pose: { ...rest(), rightShoulder: R(-60, 0, 20), rightElbow: R(0, 0, -50) } },
    { t: 0.8, pose: rest() },
  ]},

  TOMORROW: { duration: 0.9, frames: [
    { t: 0, pose: rest() },
    { t: 0.4, pose: { ...rest(), rightShoulder: R(-55, 0, -15), rightElbow: R(-30, 0, -30) } },
    { t: 0.7, pose: { ...rest(), rightShoulder: R(-65, 0, -15), rightElbow: R(-10, 0, -20) } },
    { t: 0.9, pose: rest() },
  ]},

  YESTERDAY: { duration: 0.9, frames: [
    { t: 0, pose: rest() },
    { t: 0.4, pose: { ...rest(), rightShoulder: R(-55, 10, -15), rightElbow: R(-30, 0, -30) } },
    { t: 0.7, pose: { ...rest(), rightShoulder: R(-45, -10, -10), rightElbow: R(-10, 0, -20) } },
    { t: 0.9, pose: rest() },
  ]},
}

// Fingerspell: right arm raised in spelling position, 6 wrist variants by letter group
const FS_ARM = {
  rightShoulder: R(-50, 0, -30), rightElbow: R(-65, 0, -10), rightWrist: R(0),
  leftShoulder:  R(0),           leftElbow:  R(0),            leftWrist:  R(0),
}
const FS_WRISTS = [
  R( 0,   0,   0),
  R(20,   0,   0),
  R(-20,  0,   0),
  R( 0,  20,   0),
  R( 0, -20,   0),
  R( 0,   0,  20),
]

function getFSAnim(letter) {
  const wrist = FS_WRISTS[(letter.charCodeAt(0) ?? 0) % 6]
  const pose  = { ...FS_ARM, rightWrist: wrist }
  return {
    duration: 0.45,
    frames: [
      { t: 0.00, pose: rest() },
      { t: 0.12, pose },
      { t: 0.33, pose },
      { t: 0.45, pose: rest() },
    ],
  }
}

// Merge generated animations (hand-crafted takes precedence).
// generated_glosses.js is auto-created by: cd backend && python pipeline/generate_glosses_js.py
import { GENERATED_GLOSS_ANIMS } from './generated_glosses.js'
export const ALL_GLOSS_ANIMS = { ...GENERATED_GLOSS_ANIMS, ...GLOSS_ANIMS }

/** Return animation data for a gloss, or a short default if unknown. */
export function getAnim(gloss) {
  if (gloss.startsWith('FS:')) return getFSAnim(gloss.slice(3))
  return ALL_GLOSS_ANIMS[gloss] ?? {
    duration: 0.7,
    frames: [
      { t: 0.0,  pose: rest() },
      { t: 0.35, pose: { ...rest(), rightShoulder: R(-35, 0, -20) } },
      { t: 0.7,  pose: rest() },
    ],
  }
}
