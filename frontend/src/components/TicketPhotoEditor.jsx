import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_CANVAS_W = 920
const MAX_CANVAS_H = 580

/** @param {CanvasRenderingContext2D} ctx */
function drawOp(ctx, op) {
  if (op.type === 'path') {
    if (op.points.length < 2) return
    ctx.save()
    ctx.strokeStyle = op.color
    ctx.lineWidth = op.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(op.points[0][0], op.points[0][1])
    for (let i = 1; i < op.points.length; i++) {
      ctx.lineTo(op.points[i][0], op.points[i][1])
    }
    ctx.stroke()
    ctx.restore()
  } else if (op.type === 'circle') {
    ctx.save()
    ctx.strokeStyle = op.color
    ctx.lineWidth = op.lineWidth
    ctx.beginPath()
    ctx.ellipse(
      op.cx,
      op.cy,
      Math.max(op.rx, 0.5),
      Math.max(op.ry, 0.5),
      0,
      0,
      Math.PI * 2,
    )
    ctx.stroke()
    ctx.restore()
  }
}

/**
 * Modal: annotate ticket photo with highlight (brush) and circle before upload.
 */
export function TicketPhotoEditor({ open, file, onClose, onSave }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const layoutRef = useRef({ cw: 0, ch: 0 })
  const opsRef = useRef([])
  const dragRef = useRef(null)

  const [tool, setTool] = useState('highlight')
  const [ops, setOps] = useState([])

  useEffect(() => {
    opsRef.current = ops
  }, [ops])

  const redraw = useCallback((preview) => {
    const canvas = canvasRef.current
    const img = imgRef.current
    const { cw, ch } = layoutRef.current
    if (!canvas || !img || !cw) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, 0, 0, cw, ch)
    for (const op of opsRef.current) drawOp(ctx, op)
    if (preview) drawOp(ctx, preview)
  }, [])

  useEffect(() => {
    if (!open || !file) return
    let cancelled = false
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const w = img.naturalWidth
      const h = img.naturalHeight
      const scale = Math.min(MAX_CANVAS_W / w, MAX_CANVAS_H / h, 1)
      const cw = Math.round(w * scale)
      const ch = Math.round(h * scale)
      layoutRef.current = { cw, ch }
      imgRef.current = img
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = cw
        canvas.height = ch
      }
      setOps([])
      dragRef.current = null
      requestAnimationFrame(() => redraw())
    }
    img.src = url
    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [open, file, redraw])

  useEffect(() => {
    if (open && imgRef.current && layoutRef.current.cw) redraw()
  }, [open, ops, redraw])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const canvasPoint = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return [0, 0]
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    return [(e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy]
  }

  const onPointerDown = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)
    const [x, y] = canvasPoint(e)
    if (tool === 'highlight') {
      dragRef.current = { type: 'highlight', points: [[x, y]] }
    } else {
      dragRef.current = { type: 'circle', x0: x, y0: y, x1: x, y1: y }
    }
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const [x, y] = canvasPoint(e)
    if (d.type === 'highlight') {
      d.points.push([x, y])
      redraw({
        type: 'path',
        color: 'rgba(255, 235, 100, 0.55)',
        width: 22,
        points: d.points,
      })
    } else {
      d.x1 = x
      d.y1 = y
      const cx = (d.x0 + d.x1) / 2
      const cy = (d.y0 + d.y1) / 2
      const rx = Math.abs(d.x1 - d.x0) / 2
      const ry = Math.abs(d.y1 - d.y0) / 2
      redraw({ type: 'circle', color: '#c7ff2f', lineWidth: 3, cx, cy, rx, ry })
    }
  }

  const endDrag = (e) => {
    const canvas = canvasRef.current
    const d = dragRef.current
    dragRef.current = null
    if (canvas && e?.pointerId != null) {
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    if (!d) {
      redraw()
      return
    }
    if (d.type === 'highlight') {
      if (d.points.length >= 2) {
        setOps((prev) => [
          ...prev,
          {
            type: 'path',
            color: 'rgba(255, 235, 100, 0.5)',
            width: 22,
            points: d.points.map((p) => [...p]),
          },
        ])
      }
    } else {
      const cx = (d.x0 + d.x1) / 2
      const cy = (d.y0 + d.y1) / 2
      const rx = Math.abs(d.x1 - d.x0) / 2
      const ry = Math.abs(d.y1 - d.y0) / 2
      if (rx > 2 || ry > 2) {
        setOps((prev) => [
          ...prev,
          { type: 'circle', color: '#c7ff2f', lineWidth: 3, cx, cy, rx, ry },
        ])
      }
    }
    requestAnimationFrame(() => redraw())
  }


  const undo = () => {
    setOps((prev) => prev.slice(0, -1))
  }

  const clearMarkup = () => {
    setOps([])
    requestAnimationFrame(() => redraw())
  }

  const apply = () => {
    const canvas = canvasRef.current
    if (!canvas || !file) return
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
        const out = new File([blob], `${base}-annotated.png`, { type: 'image/png' })
        onSave(out)
      },
      'image/png',
      0.92,
    )
  }

  if (!open) return null

  return (
    <div className="ticket-photo-editor-backdrop" role="presentation" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}>
      <div
        className="ticket-photo-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-photo-editor-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="ticket-photo-editor-title" className="ticket-photo-editor-title">
          Edit photo — highlight &amp; circle
        </h3>
        <p className="ticket-photo-editor-hint small">
          Draw on the image with the highlight brush or drag a circle. Undo or clear markup, then
          Apply to use this version on your ticket.
        </p>
        <div className="ticket-photo-editor-toolbar">
          <span className="ticket-photo-editor-tool-label">Tool:</span>
          <button
            type="button"
            className={`btn ghost ticket-photo-editor-tool ${tool === 'highlight' ? 'active' : ''}`}
            onClick={() => setTool('highlight')}
          >
            Highlight
          </button>
          <button
            type="button"
            className={`btn ghost ticket-photo-editor-tool ${tool === 'circle' ? 'active' : ''}`}
            onClick={() => setTool('circle')}
          >
            Circle
          </button>
          <button type="button" className="btn ghost" onClick={undo} disabled={ops.length === 0}>
            Undo
          </button>
          <button type="button" className="btn ghost" onClick={clearMarkup} disabled={ops.length === 0}>
            Clear markup
          </button>
        </div>
        <div className="ticket-photo-editor-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="ticket-photo-editor-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        </div>
        <div className="ticket-photo-editor-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={apply}>
            Apply to ticket
          </button>
        </div>
      </div>
    </div>
  )
}
