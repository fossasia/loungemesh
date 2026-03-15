import React, { useEffect, useRef } from 'react';
import { useConnectionStore } from '../../../../store/ConnectionStore';
import { useConferenceStore } from '../../../../store/ConferenceStore';

const LocalAudio:React.FC<{track:IAudioTrack}> = ({track}) => {
  const myRef:any = useRef()
  const room = useConferenceStore(store => store.conferenceObject)
  const jsMeet = useConnectionStore(store => store.jsMeet)

  // const [audioLevel, setAudioLevel] = useState(0)

  useEffect(() => {
    const el = myRef.current
    if(track?.containers?.length === 0) track.attach(myRef.current)
    // track.addEventListener(jsMeet?.events.track.TRACK_AUDIO_LEVEL_CHANGED, setAudioLevel)
    return (() => {
      // track.removeEventListener(jsMeet?.events.track.TRACK_AUDIO_LEVEL_CHANGED, setAudioLevel)
      track.detach(el)
      // track.dispose()
    })
  },[track,jsMeet])

  useEffect(() => {
    room?.addTrack(track)
      .catch(error => {});//the track might have been added already, handle the promise error
  },[room,track])

  return <audio autoPlay={true} muted={true} id='localAudio' />
}

export default LocalAudio