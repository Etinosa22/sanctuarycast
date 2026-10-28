import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Background, Frame, Theme } from '../../../shared/types'

const W = 1920
const H = 1080

export interface Masks {
  blanked: boolean
  clearText: boolean
  logo: boolean
}

const NO_MASKS: Masks = { blanked: false, clearText: false, logo: false }

export const mediaUrl = (file: string) => `sc-media://bg/${encodeURIComponent(file)}`

/**
 * Background layer. Video only plays where `animate` is set (the projector);
 * console thumbnails show a still frame to save CPU on the operator laptop.
 */
export function BackgroundLayer({ background, animate = false }: { background: Background; animate?: boolean }) {
  if (background.kind === 'colour') return <div className="absolute inset-0" style={{ background: background.colour }} />
  const fill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
  if (background.kind === 'image') return <img src={mediaUrl(background.file)} style={fill} draggable={false} alt="" />
  return animate ? (
    <video key={background.file} src={mediaUrl(background.file)} style={fill} autoPlay loop muted playsInline />
  ) : (
    <video key={background.file} src={`${mediaUrl(background.file)}#t=0.5`} style={fill} muted preload="metadata" />
  )
}

function textStyle(t: Theme): CSSProperties {
  return {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    color: t.colour,
    textAlign: t.align,
    lineHeight: 1.25,
    whiteSpace: 'pre-line',
    textShadow: t.shadow ? '0 4px 12px rgba(0,0,0,0.85)' : undefined,
    WebkitTextStroke: t.outline ? `${Math.max(1, t.fontSize / 30)}px #000` : undefined,
    paintOrder: 'stroke fill'
  }
}

const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const

/** Renders one slide on a 1920x1080 canvas scaled to fit its container. */
export function SlideCanvas({ frame, masks = NO_MASKS, animate = false }: { frame: Frame | null; masks?: Masks; animate?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  let content: ReactNode = null
  if (masks.blanked) {
    content = <div className="absolute inset-0 bg-black" />
  } else if (masks.logo) {
    content = (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div style={{ fontSize: 120, letterSpacing: 8, color: '#e8d9a8', fontFamily: 'Georgia, serif' }}>✝ SanctuaryCast</div>
      </div>
    )
  } else if (frame) {
    const t = frame.theme
    content = (
      <div className="absolute inset-0 flex flex-col" style={{ justifyContent: justify[t.position], padding: t.margin }}>
        <BackgroundLayer background={frame.background} animate={animate} />
        {!masks.clearText && (
          <>
            <div className="relative" style={textStyle(t)}>{frame.slide.text}</div>
            {frame.slide.label && (
              <div className="relative" style={{ ...textStyle(t), fontSize: t.fontSize * 0.5, marginTop: t.fontSize * 0.4, opacity: 0.85 }}>{frame.slide.label}</div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden bg-black">
      <div
        className="absolute"
        style={{
          width: W,
          height: H,
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`
        }}
      >
        {content}
      </div>
    </div>
  )
}
