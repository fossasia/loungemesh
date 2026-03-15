import { useEffect } from 'react'
import { useConnectionStore } from './../../store/ConnectionStore'
import { useConferenceStore } from './../../store/ConferenceStore'
import {useParams} from 'react-router-dom'

 /* globals: JitisMeetJS */

 //no reload?
const getConnection = store => store.connected
const getInitJitsi = store => store.initJitsiMeet
const getConnectServer = store => store.connectServer
const getJitsiMeet = store => store.initJitsiMeet
const getDisconnectServer = store => store.disconnectServer
const getInitConference  = store => store.initConference

const JitsiConnection = () => {
  const disconnectServer = useConnectionStore(getDisconnectServer)
  const jsMeet = useConnectionStore(getJitsiMeet)
  const connectServer = useConnectionStore(getConnectServer)
  const initJitsiMeet = useConnectionStore(getInitJitsi)
  const connected = useConnectionStore(getConnection)
  const initConference = useConferenceStore(getInitConference)
  const {id} = useParams() //get Id from url, should error check here I guess

  useEffect(() => {
    //jitsi might have been initialized in enter.tsx.
    //But session "/session/:id" might have been called directly, so initJitsiMeet should be called.
    initJitsiMeet()
  },[initJitsiMeet])

  useEffect(() => {
    connectServer()
    return ()=> disconnectServer()
  },[connectServer, disconnectServer])

  useEffect(() => {
    if(jsMeet && connected) {
      initConference(id)
    }
  },[jsMeet, connected, initConference, id])


  return (
    null
  )
}


export default JitsiConnection