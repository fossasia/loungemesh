import * as React from 'react';
import { useEffect, useRef } from "react"
import styled from "styled-components"
import { useLocalStore } from '../../../store/LocalStore';


const Video = styled.video`
  background: none;
  width: 200px;
  height: 200px;
  object-position: 50% 50%;
  display: block;
  border-radius: 100px;
  object-fit: cover;
  transform: scaleX(1);
`

export const VideoContainer = styled.div`
  width: auto;
  height: 200px;
  border-radius: 100px;
`

export const VideoTrack:React.FC<{id:number, videoTrack:IMediaTrack}> = React.memo(({id, videoTrack}) => {

  // const videoTrack = useConferenceStore(useCallback(store => store.users[id]?.video, [id]))
  const myRef:any = useRef()

  const localVideoTrack = useLocalStore((store) => store.video)

  //For some reason; when camera permission is not granted yet, not only the local video track, but also the remote video tracks aren't rendered.
  //The solution is to reattach the remote tracks once local track is available.
  useEffect(() => {
    const currentElement = myRef.current
    videoTrack?.attach(currentElement)
    return(() => {
      videoTrack?.detach(currentElement)
      // videoTrack?.dispose() // is this causing trouble? 
    })
  },[videoTrack, localVideoTrack])

   //Fix if Video not shown - reattaching works quite well
  //  const onVideoClicked = (e) => {
  //   videoTrack?.detach(e.target)
  //   videoTrack?.attach(e.target)
  // }

  return (
    <Video autoPlay={true} ref={myRef} className={`remoteTrack videoTrack ${id}video`} id={`${id}video`} />
  )
})