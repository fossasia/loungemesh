import { useConferenceStore } from "../../../store/ConferenceStore"
import { useConnectionStore } from "../../../store/ConnectionStore"
import { useLocalStore } from "../../../store/LocalStore"
import { IconButton } from "../../../components/common/Buttons/Button"
import { useCallback, useState } from "react"
import ScreenShareIcon from "../../../assets/icons/ScreenShare"

// TODO Error when alone in call - not sure why - replaceTrack has some empty object
export const ScreenshareButton = (props) => {
  const jsMeet = useConnectionStore((state) => state.jsMeet)
  const setLocalTracks = useLocalStore(
    useCallback((store) => store.setLocalTracks, []),
  )
  const conferenceObject = useConferenceStore((state) => state.conferenceObject)
  const [isSharing, setIsSharing] = useState(false)



  const setNewTracks = (tracks, oldTrack) => {
    const newTrack = tracks[0]
    // const oldTrack = conferenceObject?.getLocalVideoTrack()
    // oldTrack?.dispose()

    let isDesktopTrack = newTrack.videoType === "desktop"
    if (isDesktopTrack) {
      // add stop listener to automatically activate camera again if stopped by browser controls
			// -> but thats why the video track is called two times, manual stop calls it also
      newTrack.addEventListener(jsMeet?.events.track.LOCAL_TRACK_STOPPED, () => createVideoTrack())
    }
    if (oldTrack) {
      conferenceObject?.replaceTrack(oldTrack, newTrack).then(() => {
        setLocalTracks(tracks)
        setIsSharing(isDesktopTrack)
      })
			.catch(err => console.error(err))
    } //else add new Track? 
  }

  const createVideoTrack = () => {
    if (!jsMeet) return // not needed ?

    //delete old Track
    const oldTrack = conferenceObject?.getLocalVideoTrack()
		const type = oldTrack?.videoType === "desktop" ? "video" : "desktop"
    oldTrack?.dispose()

    // create tracks
    jsMeet
      .createLocalTracks({ devices: [type] })
      .then((tracks) => setNewTracks(tracks, oldTrack))
      .catch((error) => {
        console.log(error)
      })
  }

  return (
    <IconButton
      active={isSharing}
      round
      onClick={createVideoTrack}
      IconStart={<ScreenShareIcon />}
      label="Screenshare"
    />
  )
}
