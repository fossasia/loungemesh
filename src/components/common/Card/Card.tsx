import { X } from 'react-feather'
import styled from 'styled-components'

const Box = styled.div`
	position: fixed;
	z-index:10001;
  border-radius:${props => props.theme.radius.small};
  background: rgba(255, 255, 255, 1);
  box-shadow: 0px 4px 8px 0px rgba(0, 0, 0, 0.2);
	display:flex;
	flex-direction: column;
`

const Header = styled.div`
	padding: 8px 0;
	display: flex;
	flex-direction: row;
	justify-content: space-between;
`
const Title = styled.span`
	font-weight: ${props => props.theme.fontWeights.medium};
`
const Close = styled.button`
	border: none;
	background: transparent;
	padding: 8px;
	width: 40px;
	height: 40px;
	transform: translate(0, -8px);
	border-radius: 50px;
	& label {
		display:none;
	}

	&:hover {
		background-color: ${props => props.theme.button.default.bg_h};
		& svg {
		}
	}
`

export const Card = ({title, onClose=():void|null=>null, className="", children}) => {

	return (
	<Box className={className}>
		<Header>
			<Title>{title}</Title>
			<Close onClick={onClose}><X/><label>Close</label></Close>
		</Header>
		{children}
	</Box>
	)
}

export default Card;