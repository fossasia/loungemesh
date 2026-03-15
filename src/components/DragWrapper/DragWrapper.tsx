import React, { useEffect, useRef } from 'react'
import styled from 'styled-components'

export interface DragProps {
  initPos:Point
  children:any
  currentScale:number
  panOffset:Point
  callback: (Point)=>void
}

interface Point {
  x:number,
  y:number
}
 
const DragElement = styled.div`
  position: absolute;
`

const DragWrapper = ({initPos={x:0,y:0}, children, callback=(pos)=>null, currentScale = 1, panOffset}:DragProps) => {
  panOffset = panOffset || {x:0,y:0}
  const clickDelta:any = useRef()
  const element:any = useRef()

  const onDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if(element.current !== undefined) {
      const xPos = Math.trunc((e.clientX) / currentScale - clickDelta.current.x)
      const yPos = Math.trunc((e.clientY) / currentScale - clickDelta.current.y)
      // element?.current?.setAttribute('style', `left:${xPos}px; top:${yPos}px`)
      element?.current?.setAttribute('style', `transform:translate(${xPos}px, ${yPos}px);`)
      callback({x:xPos, y:yPos})
    }
  }

  const onUp = (e) => {
    e.preventDefault()
    document.removeEventListener("mouseup", onUp)
    document.removeEventListener("mousemove", onDrag)
  }

  const onDown = (e) => {
    e.preventDefault()
    const boundingRect = e.currentTarget.getBoundingClientRect()
    clickDelta.current = {
      x: Math.trunc((e.clientX - boundingRect.x + panOffset.x) / currentScale),
      y: Math.trunc((e.clientY - boundingRect.y + panOffset.y) / currentScale),
    }
    document.addEventListener("mouseup", onUp)
    document.addEventListener("mousemove", onDrag)
  }

  useEffect(() => {
    // element?.current?.setAttribute('style', `left:${initPos.x}px; top:${initPos.y}px`)
    element?.current?.setAttribute('style', `transform:translate(${initPos.x}px, ${initPos.y}px);`)
    // this is by purpose & needed to set the pos once only initially
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  return (
    <DragElement ref={element} onMouseDown={onDown} id="DragElement">
      {children}
    </DragElement>
  )
}

export default DragWrapper