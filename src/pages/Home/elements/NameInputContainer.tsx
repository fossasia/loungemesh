import React, { useState } from 'react';
import { conferenceName } from '../../../components/JitsiConnection/jitsiOptions';
import { useConferenceStore } from '../../../store/ConferenceStore';
import { NameInputForm } from './NameInputForm';
import {useHistory } from 'react-router-dom'

export const NameInputContainer = () => {

  const [sessionName, setName] = useState<string>(conferenceName)
	const setConferenceName = useConferenceStore(state => state.setConferenceName)
	const history = useHistory()

	const handleChange = (e) => {
		setName(e.target.value)
	}

	const onSubmit = (e) => {
		e.preventDefault()
		if(sessionName.length > 0) {
			//set the conference name to use it in enter screen
			//it won't join to conference yet until enter.tsx creates a connection
			setConferenceName(sessionName) 
			history.push(`/session/${sessionName}`)
		}
	}

  return <NameInputForm defaultSessionName={sessionName} onSubmit={onSubmit} handleChange={handleChange} />
}