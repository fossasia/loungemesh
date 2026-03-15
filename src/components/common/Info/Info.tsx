import * as React from 'react'
import styled from 'styled-components'
import {IoMdClose} from 'react-icons/io'
import { useInfoStore } from './InfoStore'


const InfoBox = styled.div`
  user-select: none;
	padding: 15px 25px;
	position: fixed;
	margin: 10px auto;
	left: 50%;
	transform: translateX(-50%);
	font-size: 0.9rem;
	font-weight: normal;
	background-color: #fff;
	border-radius: 5px;
	box-shadow: 0px 0px 4px rgba(0, 0, 0, 0.25);
  z-index: 10001;
	color: #555;
	b {
		color: #000;
	}
  &:hover {
    background-color: #fefefe;
    box-shadow: 0px 0px 1px rgba(0, 0, 0, 0.7);
  }
`

const StyledClose = styled(IoMdClose)`
  position: absolute;
  right: 5px;
  top: 5px;
`

export const Info = ({ children }) => {
	// const [ visible, toggleVisible ] = React.useState(true)
	const visible = useInfoStore(store => store.show)
	const setHidden = useInfoStore(store => store.setHidden)

	if (visible) {
		return (
			<div onClick={setHidden}>
				<InfoBox>
          {children}
          <StyledClose />
        </InfoBox>
			</div>
		)
	} else {
		return null
	}
}
