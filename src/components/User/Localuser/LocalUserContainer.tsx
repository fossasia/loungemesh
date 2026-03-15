import React from 'react'
import { useLocalStore } from '../../../store/LocalStore'
import DragWrapper from '../../DragWrapper/DragWrapper'

export const UserDragContainer = ({children}) => {

  const pos = useLocalStore(store => store.pos)
  const zoomTransformPan = useLocalStore(store => store.pan)
  const zoomTransformScale = useLocalStore(store => store.scale)
  const setLocalPosition = useLocalStore(store => store.setLocalPosition)

  // const throttledSendPos = useCallback(throttle(setLocalPosition, 200),[]) //this works pretty well; TODO: test & implement

  return (
    <DragWrapper initPos={pos} currentScale={zoomTransformScale} panOffset={zoomTransformPan} callback={setLocalPosition}>
      {children}
    </DragWrapper>
  )
} 