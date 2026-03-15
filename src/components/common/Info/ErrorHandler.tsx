import React from "react"
import { useConferenceStore } from "../../../store/ConferenceStore"
import { useConnectionStore } from "../../../store/ConnectionStore"
import { Info } from "./Info"

export const ErrorHandler = () => {
  const connectionError = useConnectionStore(store=>store.error)
  const conferenceError = useConferenceStore(store=>store.error)
  const errors = [connectionError, conferenceError]
  
  return <>{errors.filter(error=>error).map(error=><Info>{error}</Info>)}</>
}
