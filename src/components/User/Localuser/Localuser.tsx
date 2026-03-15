import React, { useRef } from "react"
import styled from "styled-components"
import { useLocalStore } from "../../../store/LocalStore"
import LocalVideo from "./components/LocalVideo"
import LocalAudio from "./components/LocalAudio"
import { MuteIndicator } from "./components/MuteIndicator"
import { UserBackdrop } from "../components/Backdrop/UserBackdrop"
import { panOptions } from "../../PanWrapper/panOptions"
import { AudioRadius } from "./components/AudioRadius"
import { NameContainer } from "./components/NameContainer"
import LocalDesktop from "../../../addons/Screenshare/components/LocalDesktop"
import { VideoContainer } from "../RemoteUser/DesktopVideo"

const Container = styled.div`
  width: ${panOptions.user.size.x}px;
  height: ${panOptions.user.size.y}px;
  position: absolute;
  border: 4px solid ${(props) => props.theme.base[4]};
  border-radius: 300px;
  cursor: default;
  &:active {
    cursor: default;
  }
`

interface ILocaluser {
  // panChanged: (callback: (params) => void) => void
  audioRadius?: boolean
}


export const Localuser: React.FC<ILocaluser> = ({audioRadius = false}) => {

  const audioTrack = useLocalStore((store) => store.audio)
  const videoTrack = useLocalStore((store) => store.video)
  const videoType = useLocalStore(store => store.videoType)
  const isMute = useLocalStore((store) => store.mute)
  const isOnStage = useLocalStore((store) => store.onStage)

  const localUserNode = useRef<HTMLDivElement>(null)

  return (
    <Container
      ref={localUserNode}
    >
      {audioRadius && <AudioRadius></AudioRadius>}
      <VideoContainer>
      {isOnStage && <UserBackdrop onStage />}

      {!isOnStage && 
        <>
          <UserBackdrop />
          {(videoTrack && videoType === "camera" ) && (
            <LocalVideo key={videoTrack.track.id} track={videoTrack} />
            )}
          {(videoTrack && videoType === "desktop") && (
            <LocalDesktop key={videoTrack.track.id} track={videoTrack} />
            )}
        </>
      }
      </VideoContainer>
      {audioTrack && (
        <LocalAudio key={audioTrack.track.id} track={audioTrack} />
      )}
      {isMute && <MuteIndicator />}
      <NameContainer />
		</Container>
	);
}
