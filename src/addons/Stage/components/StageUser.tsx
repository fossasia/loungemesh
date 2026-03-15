import { memo} from "react"
import { createPortal } from "react-dom"
import styled from "styled-components"
import { useLocalStore } from "../../../store/LocalStore"
import { ResizeControl } from "./ResizeControl"
import { AudioComponent } from "./StageAudio"
import { VideoComponent } from "./StageVideo"

type IStageContainer = {
  readonly width?: string
  readonly toggle?: boolean
}

const UserContainer = styled.div<IStageContainer>`
  width: 100%;
  height: auto;
  background-color: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0px 24px 48px 0px rgba(0, 0, 0, 0.25);
  position: relative;
`


const SelectedUserContainer = styled(UserContainer)`
  position: absolute;
  width: auto;
  max-width: 90%;
  height: 50%;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  & > div {
    width: auto;
    height: 100%;
  }
`

const setSelector = (store) => store.setSelectedUserOnStage

const RemoteUser = ({ video, audio, volume, id, selected = false }) => {
  const setSelectedUser = useLocalStore(setSelector)

  if (selected) {
    return createPortal(
      <SelectedUserContainer>
        <UserContainer>
          <AudioComponent audio={audio} volume={volume} />
          <VideoComponent className="stage_video" video={video} />
          <ResizeControl callback={() => setSelectedUser(id)} />
        </UserContainer>
      </SelectedUserContainer>,
      document.body,
    )
  }
  return (
    <UserContainer>
      <AudioComponent audio={audio} volume={volume} />
      <VideoComponent className="stage_video" video={video} />
      <ResizeControl callback={() => setSelectedUser(id)} />
    </UserContainer>
  )
}
//memo prevents rerender of stage users on move -> TODO: check if maybe should be solved up in the tree
export const User = memo(RemoteUser)

export const LocalUser = () => {
  const localVideo = useLocalStore((store) => store.video)
  const videoType = useLocalStore((store) => store.videoType)

  return (
    <UserContainer>
      {localVideo && videoType === "camera" && (
        <VideoComponent mirrored id="local_video" video={localVideo} />
      )}
      {localVideo && videoType === "desktop" && (
        <VideoComponent id="local_video" video={localVideo} />
      )}
    </UserContainer>
  )
}
