import React, { memo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useConferenceStore } from '../../../../store/ConferenceStore';

const Video = styled.video`
  width: 200px; 
  height: 200px;
  object-position: 50% 50%;
  display: block;
  border-radius: 100px;
  object-fit: cover;
  transform: scaleX(-1);
`

const LocalVideo:React.FC<{track:IVideoTrack}> = memo(({track}) => {
  const myRef:any = useRef()
  const room = useConferenceStore(store => store.conferenceObject)

  useEffect(() => {
    room?.addTrack(track) //TODO should be done in store I think?
      .catch(error => console.log(error))//the track might have been added already, handle the promise error
    return () => {
      // room?.removeTrack(tmpTrack) //we're replacing, not deleting and adding a new one
    }
  },[room, track])

  useEffect(()=> {
    const el = myRef.current
    if(track?.containers?.length === 0) track.attach(el)
    return () => {
      track.detach(el)
    }
  },[track])


  return <Video autoPlay={true} ref={myRef} className={`localTrack videoTrack`} />
})

export default LocalVideo