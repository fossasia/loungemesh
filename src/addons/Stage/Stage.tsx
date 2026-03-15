import { useCallback, useEffect } from "react"
import styled from "styled-components"
import { useConferenceStore } from "../../store/ConferenceStore"
import { useConnectionStore } from "../../store/ConnectionStore"
import { useLocalStore } from "../../store/LocalStore"
import { LocalUser } from "./components/StageUser"
import { StageUsers } from "./components/StageUsers"
import { GhostButton} from "../../components/common/Buttons/Button"
import { EyeOff, VolumeX } from "react-feather"

const Container = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: auto;
  height: auto;
  /* top: 24px;
  left: 24px; */
`
const ScrollContainer = styled.div`
  position: absolute;
  top: 24px;
  left: 0;
  bottom: 24px;
  padding-right: 60px;
  padding-left: 24px;
  width: 12%;
  overflow-y: auto;
  overflow-x: visible;
`

//TODO cleaner way would be to handle the whole stage management here and refactor calculateUsersOnScreen
// Actually that would be much better - no need to loop all users in localstore on each user movement to recalculate who is on stage
// in set last-n we would just set calculated visible user array and stage user array that is set here only on participantpropertychange
// const onParticipantPropertyChange = (e) => {
// 	useLocalStore.getState().calculateUsersOnScreen()
// }  

const userOnScreenSelector = (store) => store.calculateUsersOnScreen
const ids_OnStageSelector = (store) => store.usersOnStage

const ConnectedStage = () => {
  const stageVisible = useLocalStore(
    useCallback((store) => store.stageVisible, []),
  )
  const stageMute = useLocalStore(useCallback((store) => store.stageMute, []))
  const localUserOnStage = useLocalStore((store) => store.onStage)
  const conference = useConferenceStore((store) => store.conferenceObject)
  const JSMeet = useConnectionStore((store) => store.jsMeet)
  const calculateUsersOnScreen = useLocalStore(userOnScreenSelector)
  const usersOnStage = useLocalStore(ids_OnStageSelector)

  useEffect(() => {
    conference?.on(
      JSMeet?.events.conference.PARTICIPANT_PROPERTY_CHANGED,
      calculateUsersOnScreen,
    )

    return () => {
      conference?.off(
        JSMeet?.events.conference.PARTICIPANT_PROPERTY_CHANGED,
        calculateUsersOnScreen,
      )
    }
  }, [conference, JSMeet, calculateUsersOnScreen])

  return (
    <>
      {(usersOnStage.length > 0 || localUserOnStage) && (
        <Stage>
          {localUserOnStage && <LocalUser />}
          {stageVisible && <StageUsers volume={stageMute ? 0 : 0.8} />}
        </Stage>
      )}
    </>
  )
}

export const Stage = ({ children }) => (
  <ScrollContainer>
    <Container>
      <StageControls />
      {children}
    </Container>
  </ScrollContainer>
)



const StageControls = () => {
  const toggleMute = useLocalStore((store) => store.toggleStageMute)
  const toggleStage = useLocalStore((store) => store.toggleStage)
  const mute = useLocalStore((store) => store.stageMute)
  const visible = useLocalStore((store) => store.stageVisible)

  return (
    <StageControlsBox>
      {!visible && (
        <HideStageButton
          onClick={toggleStage}
          label="show"
          round
          icon
          ghost
          warning
          IconStart={<EyeOff />}
        />
      )}
      {visible && (
        <HideStageButton
          onClick={toggleStage}
          label="hide"
          round
          icon
          ghost
          IconStart={<EyeOff />}
        />
      )}
      {visible && mute && (
        <MuteStageButton
          onClick={toggleMute}
          label="unmute"
          round
          icon
          ghost
          warning
          IconStart={<VolumeX />}
        />
      )}
      {visible && !mute && (
        <MuteStageButton
          onClick={toggleMute}
          label="mute"
          round
          icon
          ghost
          IconStart={<VolumeX />}
        />
      )}
    </StageControlsBox>
  )
}

const StageControlsBox = styled.div`
  display: flex;
  flex-direction: row;
`

const MuteStageButton = styled(GhostButton)``

const HideStageButton = styled(GhostButton)``

export default ConnectedStage
