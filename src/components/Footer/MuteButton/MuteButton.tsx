import React from 'react';
import { IconButton } from './../../common/Buttons/Button';
import { useLocalStore } from './../../../store/LocalStore';
import MicIcon from '../../../assets/icons/MicIcon';
import MicOff from '../../../assets/icons/MicOff';



export const MuteButton = () => {

  const toggleMute = useLocalStore(store => store.toggleMute)
  const mute = useLocalStore(store => store.mute)

  if(mute) {
    return <IconButton round warning onClick={toggleMute} IconStart={<MicOff/>} label="Unmute" />
  } else {
    return <IconButton round small onClick={toggleMute} IconStart={<MicIcon/>} label="Mute" />
  }
}