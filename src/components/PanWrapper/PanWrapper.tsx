import React, { useEffect } from "react"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"
import { useLocalStore } from "./../../store/LocalStore"
import { panOptions, transformWrapperOptions} from './panOptions'

const panChange = store => store.onPanChange
const setPos = store => store.setLocalPosition

export const PanWrapper = ({children}) => {

  const onPanChange = useLocalStore(panChange)
  const setLocalPosition = useLocalStore(setPos)
  
  // const throttlePan = useCallback(throttle(onPanChange, 200),[])
  // const throttleSendPos = useCallback(throttle(setLocalPosition, 200),[])
  
  useEffect(() => {
    onPanChange({scale:transformWrapperOptions.scale,positionX:transformWrapperOptions.defaultPositionX,positionY:transformWrapperOptions.defaultPositionY})
    setLocalPosition(panOptions.user.initialPosition)
    // throttlePan({scale:transformWrapperOptions.scale,positionX:transformWrapperOptions.defaultPositionX,positionY:transformWrapperOptions.defaultPositionY})
    // throttleSendPos(panOptions.user.initialPosition)
  },[onPanChange, setLocalPosition])

  return (
    <TransformWrapper 
      {...transformWrapperOptions}
      onZoomChange={onPanChange}
      onPanning={onPanChange}
      onPinchingStop={onPanChange}
    >
      <TransformComponent>
        {children}
      </TransformComponent>
    </TransformWrapper>
  )
}