import { useConferenceStore } from "../../../store/ConferenceStore"
import { useLocalStore } from "../../../store/LocalStore"
import { User as StageUser } from "./StageUser"

const userSelector = store => store.users

export const StageUsers = ({volume}:{volume:number}) => {
  const users: IUsers = useConferenceStore(userSelector)
  const selectedUsersOnStage = useLocalStore(store => store.selectedUsersOnStage)
  return (
    <>
      {Object.entries(users).map(user => {
        if (user[1]?.properties?.onStage) {
          /**
           * Quick Fixed by memo to remote User; still this might be better fixed up in the tree
           TODO: this is rerendering on every move, even though react will diff it out, Im not sure thats cool;
           we only need updates if properties change so we could have a stageusers array instead;
           -> could also have a "users Visible" array to only render them on stage at all
           */
          
          return <StageUser key={user[0]} selected={user[0] === selectedUsersOnStage[0]} id={user[0]} volume={volume} audio={user[1].audio} video={user[1].video} />
        }
        return null
      })}
    </>
  )
}