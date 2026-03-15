import * as React from 'react'
import { FaVideo } from 'react-icons/fa'
import { Button } from '../../common/Buttons/Button'

export const VideoButton = ({ callback = () => null }) => {
	const [ active, setActive ] = React.useState(true)

	const onClick = () => {
		setActive(!active)
		callback()
	}

	return (
		<Button type="secondary" onClick={onClick}>
			<FaVideo />Video
		</Button>
	)
}
