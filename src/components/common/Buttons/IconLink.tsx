import * as React from 'react'
import styled from 'styled-components'

const Link = styled.a`
	font-size: 1.4rem;
	display: flex;
	flex-direction: row;
	align-items: flex-start;
	padding: 10px;
  color: ${props => props.theme.text.default};
  &:hover {
		color:${props => props.theme.text.primary};
  }
`

export const IconLink = (props) => {
	return <Link target="_blank" href={props.url}>{props.children}</Link>
}
