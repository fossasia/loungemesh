import * as React from 'react'
import { LocalStoreLogic } from '../../store/LocalStoreLogic'
import { Room } from '../../components/Room/Room'
import { ReactComponent as Wave } from './../../assets/wave.svg'

import { Footer } from '../../components/Footer/Footer'
import { PanWrapper } from '../../components/PanWrapper/PanWrapper'
import { UserDragContainer } from '../../components/User/Localuser/LocalUserContainer'
import { Localuser } from '../../components/User/Localuser/Localuser'
import { JoinButton } from '../../components/Footer/JoinButton/JoinButton'
import { MuteButton } from '../../components/Footer/MuteButton/MuteButton'

import { useParams } from 'react-router-dom'
import { useConferenceStore } from '../../store/ConferenceStore'
import styled from 'styled-components'
import { BigHeadline } from '../../components/common/BigHeadline'
import { SubHeadline } from '../../components/common/SubHeadline'
import { ErrorHandler } from '../../components/common/Info/ErrorHandler'
import { Info } from '../../components/common/Info/Info'

const BigHeadContainer = styled.div`
	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
`

const CenterContainer = styled.div`
	position: fixed;
  top: 200px;
  width: 100%;
	display: flex;
	flex-direction: column;
	justify-content: center;
  z-index: 1;
`

export const Enter = () => {
	const { id } = useParams() //get Id from url, should error check here I guess
	const setConferenceName = useConferenceStore(React.useCallback(store => store.setConferenceName,[]))

	React.useEffect(
		() => {
			setConferenceName(id)
		},
		[ id, setConferenceName ],
	)

	return (
		<React.Fragment>
			<Info>
				Welcome to our Prototype
				<br />
				Please use <b>Safari</b> or <b>Chrome</b> for now for a stable Experience
			</Info>
			<LocalStoreLogic />
			<PanWrapper>
				<Room>
					<UserDragContainer>
						<Localuser />
					</UserDragContainer>
				</Room>
			</PanWrapper>
			<ErrorHandler />
			<CenterContainer id="centerContainer">
				<BigHeadContainer>
					<Wave />
					<BigHeadline>Welcome to Chatmosphere</BigHeadline>
				</BigHeadContainer>
				<SubHeadline>The Open Source Videochat for Cozy Talks</SubHeadline>
			</CenterContainer>
			<Footer>
				<MuteButton />
				<JoinButton />
				{/* <VideoButton /> */}
			</Footer>
		</React.Fragment>
	)
}
