import { audioRadius } from "./LookupTable"

export const getVectorDistance = (p1:IVector2, p2:IVector2):number => {
	const a = p1.x - p2.x
	const b = p1.y - p2.y
	const c = Math.sqrt(a*a + b*b)
	return c
}

export const mapVolumeToDist = (max:number, dist:number):number => {
	const volume = 1 - dist/max
	const p = volume > 0 ? volume : 0
	return p
}

export const getVolumeByDistance = (p1:IVector2, p2:IVector2):number => {
	const d = getVectorDistance(p1, p2)
	// const dWidth = document.body.clientWidth / 2 // relative distance based on screen size
	const v = mapVolumeToDist(audioRadius, d)
	return v
}

export const isOnScreen = (pos:IVector2, width:number, height:number):boolean => {
	const x = pos.x
	const y = pos.y
	const isX = x > -width && x < window.innerWidth
	const isY = y > -height && y < window.innerHeight
	return isX && isY
}