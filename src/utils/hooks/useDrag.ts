import { useRef, useState } from "react"

export const useDrag = ({initPos, scale, callback}) => {
  const [dragInfo, setDragInfo] = useState({
    isActive: false,
    pos: initPos || { x: 0, y: 0 },
  })
  const oldPos = useRef({ x: 0, y: 0 })
  const clickPos = useRef({ x: 0, y: 0 })

  const onDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const delta = {
      x: e.clientX / scale - clickPos.current.x,
      y: e.clientY / scale - clickPos.current.y,
    }
    const newPos = {
      x: oldPos.current.x + delta.x,
      y: oldPos.current.y + delta.y,
    }
    setDragInfo({
      ...dragInfo,
      pos: newPos,
    })
    if(callback) callback(newPos)
  }

  const onUp = (e) => {
    const delta = {
      x: e.clientX - clickPos.current.x,
      y: e.clientY - clickPos.current.y,
    }
    const newPos = {
      x: oldPos.current.x + delta.x,
      y: oldPos.current.y + delta.y,
    }
    setDragInfo({
      ...dragInfo,
      pos: newPos,
    })
    document.removeEventListener("pointerup", onUp)
    document.removeEventListener("pointermove", onDrag)
  }

  const onDown = (e) => {
    e.preventDefault()
    debugger
    oldPos.current = {
      x: e.currentTarget.offsetLeft,
      y: e.currentTarget.offsetTop,
    }
    clickPos.current = {
      x: e.clientX,
      y: e.clientY,
    }
    setDragInfo({
      ...dragInfo,
      isActive: true,
    })
    document.addEventListener("pointerup", onUp)
    document.addEventListener("pointermove", onDrag)
  }

  const position = {
    x: dragInfo.pos.x,
    y: dragInfo.pos.y,
  }

  return { onDown, onDrag, onUp, position }
}
