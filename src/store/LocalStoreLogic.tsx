import { useCallback, useEffect } from "react"
import { useConferenceStore } from "./ConferenceStore"
import { useConnectionStore } from "./ConnectionStore"
import { useLocalStore } from "./LocalStore"
import { throttle } from "lodash"

const sendPositionToPeers = (pos: string, conferenceObject) => {
  conferenceObject?.sendCommand("pos", { value: pos })
}
//throttle mustnt be rerendered or it wont work
const throttledSendPos = throttle(sendPositionToPeers, 200)

const conferenceSelector = (store) => store.conferenceObject
const idSelector = (store) => store.id
const posSelector = (store) => store.pos
const initSelector = (store) => store.initJitsiMeet
const jsMeetSelector = (store) => store.jsMeet

///LocalStore has dependency on ConferenceStore.
///This component provides the communication from ConferenceStore to LocalStore.
export const LocalStoreLogic = () => {
  const conference = useConferenceStore(conferenceSelector)
  const calculateVolumes = useConferenceStore(
    useCallback((store) => store.calculateVolumes, []),
  )
  const calculateUsersInRadius = useLocalStore(
    useCallback((store) => store.calculateUsersInRadius, []),
  )
  const id = useLocalStore(idSelector)
  const pos = useLocalStore(posSelector)
  const setLocalTracks = useLocalStore(
    useCallback((store) => store.setLocalTracks, []),
  )
  const setMyID = useLocalStore(useCallback((store) => store.setMyID, []))
  const initJitsiMeet = useConnectionStore(initSelector)
  const jsMeet = useConnectionStore(jsMeetSelector)

  useEffect(() => {
    initJitsiMeet()
  }, [initJitsiMeet])

  useEffect(() => {
    if (conference?.myUserId()) setMyID(conference.myUserId())
  }, [conference, setMyID])

  // TODO: Refactor
  useEffect(() => {
    jsMeet
      ?.createLocalTracks({
        devices: ["audio", "video"],
        firePermissionPromptIsShownEvent: true,
      })
      .then((tracks) => {
        setLocalTracks(tracks)
      })
      .catch((error) => {
        console.log(error)
      })
  }, [jsMeet, setLocalTracks])

  useEffect(() => {
    if (id) {
      const newPos = JSON.stringify({ ...pos, id: id })
      throttledSendPos(newPos, conference)
      calculateVolumes(pos)
      calculateUsersInRadius(pos)
    }
  }, [pos, id, conference, calculateVolumes, calculateUsersInRadius])

  return null
}
