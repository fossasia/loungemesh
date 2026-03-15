import { IconButton } from "../../../components/common/Buttons/Button"
import { useConferenceStore } from "../../../store/ConferenceStore"
import { useLocalStore } from "../../../store/LocalStore"
import { useEffect } from "react"
import StageIcon from "../../../assets/icons/StageIcon"

export const StageButton = ({callback=()=>null}) => {
	const conference = useConferenceStore(store => store.conferenceObject)
	const onStage = useLocalStore(store => store.onStage)
	const setOnStage = useLocalStore(store => store.setOnStage)

	const onClick = () => {
		const tmpStage = !onStage
		setOnStage(tmpStage)
		conference?.setLocalParticipantProperty('onStage', tmpStage)
	}

	useEffect(()=>{
		return(() => {
			setOnStage(false)
		})
	},[setOnStage])

	return (
		<IconButton active={onStage} onClick={onClick} round label="Stage" IconStart={<StageIcon />} />
	)

}