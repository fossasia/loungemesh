import { useCallback, useEffect, useRef } from 'react';
import { useLocalStore } from '../../../store/LocalStore';
import { useConferenceStore } from "../../../store/ConferenceStore";

export const AudioTrack = ({id, volume}) => {
  const audioTrack = useConferenceStore(useCallback(store => store.users[id]['audio'], [id]))
  const myRef:any = useRef()

  const localAudioTrack = useLocalStore((store) => store.audio)


  useEffect(() => {
    myRef.current.volume = volume
  },[volume])

  useEffect(() => {
    const currentElement = myRef.current
    audioTrack?.attach(currentElement)
    return(() => {
      audioTrack?.detach(currentElement)
      audioTrack?.dispose()
    })
  },[audioTrack])

  //On Firefox, if the media permissions are "Allowed Temporarily" ("Remember this decision" is unchecked in permission prompt);
  //then Autoplay will be set to Block Audio; resulting the audio of other users not to be heard.
  //To overcome this problem, we reattach remote audio track on permission is granted. If permission is granted, localAudioTrack is available; so we track its object reference.
  useEffect(() => {
    const currentElement = myRef.current
    audioTrack?.detach(currentElement)
    audioTrack?.attach(currentElement)
  },[localAudioTrack, audioTrack])

  return (
    <audio autoPlay={true} ref={myRef} className={`remoteTrack audioTrack ${id}audio`} id={`${id}audio`} />
  )
}


// const Audio:React.FunctionComponent<{track:any, volume:number} & React.HTMLAttributes<HTMLAudioElement>> = ({track, volume})=> {

//   const myRef:any = useRef()

//   useEffect(() => {
//     const el = myRef.current
//     if(el) {
//       if(el) track?.attach(el)
//     }
//     return(() => {
//       track?.detach(el)
//     })
//   },[track])

//   useEffect(() => {
//     if(myRef.current & myRef.current.volume) myRef.current.volume = volume
//   },[volume])

//   return (<audio ref={myRef} autoPlay={true} />)
// }