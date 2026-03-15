import { useLocalStore } from '../../../../store/LocalStore';
import {ReactComponent as MuteCat} from '../../../../assets/muteCatSmall.svg'
import { MuteContainer } from '../../RemoteUser/MuteIndicator';



export const MuteIndicator = () => {

  const {toggleMute} = useLocalStore()

  const handleClick = () => {
    toggleMute()
  } 

  return (
    <MuteContainer onClick={handleClick}>
      <MuteCat />
    </MuteContainer>
  )
}

