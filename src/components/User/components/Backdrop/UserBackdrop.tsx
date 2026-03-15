import * as React from 'react'
import { RefreshCcw } from 'react-feather'
import styled from 'styled-components'
import StageIcon from '../../../../assets/icons/StageIcon'
import {ReactComponent as ReloadIcon} from '../../../../assets/reloadIcon.svg'

export const ReloadHint = ({children=null,callback=()=>null}) => {

	return <Reload onClick={callback}><ReloadIcon />{children}</Reload>
}


const BaseBackdrop = styled.div`
	position: absolute;
  top: 0;
  z-index: -1;
	width: 200px;
	height: 200px;
	border-radius: 50%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	background: ${props => props.theme.color.primary};
  color: white;
  font-weight: bold;
  & svg {
    margin: 5px;
		width: 32px;
		height: 32px;
  }
`

const Reload = styled(BaseBackdrop)`
	background: ${props => props.theme.color.primary};
  color: white;
`

const OnStage = styled(BaseBackdrop)`
	background: ${(props) => props.theme.bg.inset};
  color: white;
	& svg {
		stroke: white;
	}
`

export const UserBackdrop = ({onStage=false, ...props}) => {
	return <>{onStage ? <OnStage {...props}><StageIcon />Presenting</OnStage> : <Reload {...props}><RefreshCcw />Maybe try a reload?</Reload>}</>
}

