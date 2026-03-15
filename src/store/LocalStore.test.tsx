import React from 'react';
import {renderHook, act} from "@testing-library/react-hooks"
import { useLocalStore } from './LocalStore';


jest.mock("../store/LocalStore", () => {
	const originalMod = jest.requireActual('../store/LocalStore')
	return {
		__esModule: true,
		...originalMod,
		id:'peter',
		audio: "t"
	}
})
const setLocalTracks = useLocalStore.getState().setLocalTracks

it('returns true', () => {
	setLocalTracks([])
	const tmpVideo = useLocalStore.getState().video
	expect(tmpVideo).toBe(undefined)
})

it("has new position", () => {
	const tmpPos = {x:10,y:10}
	const setLocalPosition = useLocalStore.getState().setLocalPosition
	setLocalPosition(tmpPos)
	const newPos = useLocalStore.getState().pos
	expect(newPos).toBe(tmpPos)
})



// using react-testing-hooks library makes testing zustand stores quite nice :)
// thx <3: https://github.com/testing-library/react-hooks-testing-library
// also thx to https://dev.to/emmanuilsb/stop-overcomplicating-your-state-try-zustand-39p4
it("toggles mute", () => {
	const {result } = renderHook(() => useLocalStore((state) => state))

	expect(result.current.mute).toBe(false)

	act(() => {
		result.current.audio = {
			isMuted:jest.fn(() => false),
			mute: jest.fn(),
			unmute: jest.fn()
		} as unknown as IMediaTrack

		result.current.toggleMute()
	})
	expect(result.current.mute).toBe(true)

})