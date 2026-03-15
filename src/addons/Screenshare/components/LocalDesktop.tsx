import { memo, useEffect, useRef } from "react"
import styled from "styled-components"
import { useConferenceStore } from "../../../store/ConferenceStore"

const StyledVideo = styled.video`
  width: auto; 
  height: 200px;
  display: block;
`

const LocalDesktop:React.FC<{track:IVideoTrack}> = memo(({track}) => {
  const myRef:any = useRef()
  const room = useConferenceStore(store => store.conferenceObject)

  useEffect(() => {
    room?.addTrack(track) //TODO should be done in store I think?
      .catch(error => console.log(error))//the track might have been added already, handle the promise error
    return() => {
      // room?.removeTrack(track) // we're replacing, not deleting & adding new one;
    }
  },[room, track])

  useEffect(()=> {
    const el = myRef.current
    if(track?.containers?.length === 0) track.attach(el)
    return (() => {
      track.detach(el)
    })
  },[track])


  return <StyledVideo autoPlay={true} ref={myRef} className={`localTrack desktopTrack`} />
})

export default LocalDesktop