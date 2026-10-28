// Decides which display each window goes on. Pure, so it is testable without
// real monitors; main/windows.ts feeds it Electron's screen data.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayInfo {
  id: number
  bounds: Rect
  workArea: Rect
}

export interface Placement {
  display: DisplayInfo
  /** Full screen on its own display, or a normal window for testing. */
  fullscreen: boolean
}

export interface OutputPlan {
  console: DisplayInfo
  main: Placement
  /** null means the stage display is not opened automatically. */
  stage: Placement | null
}

/**
 * 1 display:  console + both outputs as normal windows on it (testing).
 * 2 displays: main output full screen on the second; stage on request.
 * 3+:         main output on the second, stage display on the third.
 */
export function planOutputs(displays: DisplayInfo[], primaryId: number): OutputPlan {
  if (displays.length === 0) throw new Error('No displays detected')
  const primary = displays.find((d) => d.id === primaryId) ?? displays[0]
  // Left-to-right order so "second display" matches what the operator sees.
  const others = displays.filter((d) => d.id !== primary.id).sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)

  if (others.length === 0) {
    return {
      console: primary,
      main: { display: primary, fullscreen: false },
      stage: { display: primary, fullscreen: false }
    }
  }
  return {
    console: primary,
    main: { display: others[0], fullscreen: true },
    stage: others[1] ? { display: others[1], fullscreen: true } : null
  }
}

/** Where the stage display goes when the operator opens it by hand. */
export function manualStagePlacement(plan: OutputPlan): Placement {
  return plan.stage ?? { display: plan.console, fullscreen: false }
}
