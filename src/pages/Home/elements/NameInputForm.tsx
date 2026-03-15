import * as React from 'react'
import styled from 'styled-components'
import { Info } from '../../../components/common/Info/Info'

const Form = styled.form`
  width: 340px;
  margin: auto;
  text-align: left;
`
const Fieldset = styled.fieldset`
  border: none;
  padding: 0;
  margin: 10px 0 0 0;
  display: flex;
  flex-direction: row;
`

const Label = styled.label`
  font-size: ${props => props.theme.fontSize.small};
  color: ${props => props.theme.base['2']};
`

const InputField = styled.input`
	height: 50px;
	background: ${props => props.theme.input.default.bg};
  color: ${props => props.theme.text.default};
	border: 1px solid ${props => props.theme.line.dark};
  font-size: ${props => props.theme.fontSize.body};
	box-sizing: border-box;
	border-radius: ${props => props.theme.radius.small} 0 0 ${props => props.theme.radius.small};
  padding-left: 20px;
  width: 100%;
  &:hover {
    border: 1px solid ${props => props.theme.color['5']};
    &::placeholder {
      color: ${props => props.theme.color['5']};
    }
  }
  &:focus {
    outline: none;
    font-size:${props => props.theme.fontSize.body};
  }
  &::placeholder {
    font-size: ${props => props.theme.fontSize.body};
  }
  &:disabled {
    background-color: ${props => props.theme.base["3"]};
  }
`

const JoinButton = styled.input`
  height: 50px;
  background: ${props => props.theme.button.primary.bg};
  border-radius: 0 ${props => props.theme.radius.small} ${props => props.theme.radius.small} 0;
  width: 111px;
  color: ${props => props.theme.button.primary.fg};
  font-size: ${props => props.theme.fontSize.body};
  border: none;
  &:hover {
    background-color: ${props => props.theme.button.primary.bg_h};
  }
`

const InfoBubble = styled(Info)`

`

export const NameInputForm = ({ defaultSessionName, onSubmit, handleChange }) => {
	return (
		<Form onSubmit={onSubmit}>
			<Label htmlFor="sessionName">Set Session Name</Label>
			<Fieldset>
				<InputField
					name="sessionName"
					type="text"
          placeholder={defaultSessionName}
					onChange={handleChange}
          id="sessionName"
          disabled={process.env.REACT_APP_DEMO_SESSION ? true : false}
				/>
				<JoinButton name="joinButton" type="submit" value="Join" />
			</Fieldset>
        {process.env.REACT_APP_DEMO_SESSION && <InfoBubble>Only Demo Session Available</InfoBubble>}
		</Form>
	)
}
