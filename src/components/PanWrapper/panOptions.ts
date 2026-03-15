import { PropsList } from "react-zoom-pan-pinch/dist/store/interfaces/propsInterface"

export const panOptions = {
  room: { size: { x: 6000, y: 6000 } },
    get user() {
      return {
        //center the room
        initialPosition: { x: this.room.size.x / 2 - (Math.random() * 200 - 100), y: this.room.size.y / 2 - (Math.random() * 200 - 100) },
        size: { x: 200, y: 200 },
      }
    },
}

export const transformWrapperOptions: PropsList = {
  wheel: { step: 50 },
  scale: 1.0,
  //center the window, considering the size of the user view
  defaultPositionX: -panOptions.user.initialPosition.x +(window.innerWidth-panOptions.user.size.x)/2,
  defaultPositionY: -panOptions.user.initialPosition.y+(window.innerHeight-panOptions.user.size.y)/2,
  positionX: 0,
  positionY: 0,
  options: {
    centerContent: false,
    limitToBounds: true,
    limitToWrapper: true,
    minScale: 0.3,
    maxScale: 3,
    // maxPositionX:500, maxPositionY:500,
    // minPositionX:0, minPositionY:0
  },
  // scalePadding:{animationTime:10},
  pan: { 
    velocityEqualToMove: true,
  },
  pinch: { disabled: true },
}
