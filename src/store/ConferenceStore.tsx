import produce from 'immer';
import { mountStoreDevtool } from 'simple-zustand-devtools';
import create from 'zustand';
import { conferenceOptions } from '../components/JitsiConnection/jitsiOptions';
import { getVolumeByDistance } from '../utils/VectorHelpers';
import { useConnectionStore } from './ConnectionStore';
import { useLocalStore } from './LocalStore';
import { secureConferenceName } from "../utils/secureConferenceName"

// # TS DEFINITIONS *******************************************

declare global {
  interface Window {
    JitsiMeetJS: any
  }
}

// # IMPLEMENTATIONS *******************************************

export const useConferenceStore = create<IConferenceStore>((set,get) => {

  const initialState = {
    conferenceObject:undefined,
    conferenceName: process.env.REACT_APP_DEMO_SESSION || "chatmosphere",
    isJoined:false,
    users:{},
    displayName:"Friendly Sphere",
    error:undefined,
    messages:[]
  }

  const produceAndSet = (callback:(newState:IConferenceStore)=>void)=>set(state => produce(state, newState => callback(newState)))

  // Private Helper Functions *******************************************
  const _addUser = (id:ID, user?:any) :void => produceAndSet (newState => {
    newState.users[id] = {id:id, user:user, mute:false, properties:{}, volume:1, pos:{x:0, y:0}}
  })
  const _removeUser = (id:ID) :void => produceAndSet (newState => {
    delete newState.users[id]
  })
  const _addAudioTrack = (id:ID, track:IMediaTrack) => produceAndSet (newState => {
    if(newState.users[id]) 
    {
      const JitsiMeetJS = useConnectionStore.getState().jsMeet 
      track.addEventListener(JitsiMeetJS?.events.track.TRACK_AUDIO_OUTPUT_CHANGED,deviceId =>console.log(`track audio output device was changed to ${deviceId}`))
      newState.users[id].audio = track
      newState.users[id]['mute'] = track.isMuted()
    }
  })
  // const _removeAudioTrack = (id:ID):void => produceAndSet (newState => {
  //   if(newState.users[id]) newState.users[id].audio = undefined
  // })
  const _addVideoTrack = (id:ID, track:IMediaTrack):void => produceAndSet (newState => {
    if(newState.users[id]) {
      const JitsiMeetJS = useConnectionStore.getState().jsMeet 
      track.addEventListener(JitsiMeetJS?.events.track.TRACK_VIDEOTYPE_CHANGED, (e)=>_onVideoTypeChanged(e, id))
      newState.users[id].video = track
      newState.users[id].videoType = track.videoType === "desktop" ? "desktop" : "camera" //set videoType directly
    }
  })
  // const _removeVideoTrack = (id:ID):void => produceAndSet (newState => {
  //   if(newState.users[id]) {
  //     newState.users[id].video = undefined
  //     newState.users[id].videoType = undefined //remove VideoType
  //   }
  // })
  const _onPositionReceived = (e:any):void => {
    const pos = JSON.parse(e.value)
    _updateUserPosition(pos.id, {x:pos.x, y:pos.y})
  }
  const _updateUserPosition = (id:ID, pos:IVector2):void => produceAndSet (newState => {
    if(newState.users[id]) newState.users[id]['pos'] = pos
  })
  const _onTrackMuteChanged = (track:IMediaTrack):void => {
    if(track.getType() === 'video') return
    const tmpID = track.getParticipantId()
    set(state => produce(state, newState => {
      if(newState.users[tmpID]) newState.users[tmpID]['mute'] = track.isMuted() //check in beginning sucks
    }))
  }

  const _onConferenceError = (e) => {
    const connection = useConnectionStore.getState().connection
    // console.log("tmpConnection:",get().connection)
    set({ conferenceObject: undefined, error:connection?.xmpp.lastErrorMsg })
  }

  const _onRemoteTrackAdded = (track:IMediaTrack):void => {
    if(track.isLocal()) return // also run on your own tracks so exit
    const id = track.getParticipantId() // get user id of track
    track.getType() === "audio" ? _addAudioTrack(id, track) : _addVideoTrack(id, track)
  }
  const _onRemoteTrackRemoved = (track:IMediaTrack):void => {
    // TODO: Remove track from user Object
    // if(track.isLocal()) return
    // const id = track.getParticipantId() // get user id of track
    // track.getType() === 'audio' ? _removeAudioTrack(id) : _removeVideoTrack(id) // do we need that? maybe if user is still there but closes video?
    // track.dispose()
  }

  const _onVideoTypeChanged = (type:string, id) => produceAndSet (newState => {
      newState.users[id].videoType = type === "desktop" ? "desktop" : "camera" //set videoType directly
      // alternative implementation if updating jitsi jvb doesnt fix current delay on switch of cam & screenshare
      // remove track from conference and add again
  })

  const _onConferenceJoined = () => {
    set({isJoined:true})//only Local User -> could be in LocalStore
    const conference = get().conferenceObject
    conference?.setDisplayName(get().displayName)
  }

  const _onMessageReceived = (id:string, text:string, nr:number) => {
    set((store) => ({messages: [...store.messages, {id:id, text:text, nr:nr}]}))
  }

  const _onParticipantPropertyChanged = (e:any) => {
    const id = e._id
    const props = e._properties
    produceAndSet (newState => {
      const tmpState = newState.users[id].properties
      newState.users[id].properties = {...tmpState,...props}
    })
  }

  const _onUserNameChanged = (e, t) => {
    // TODO Implement singular event when user changes name (now its updating every letter)
  }


  // # Public functions *******************************************
  const initConference = (conferenceID:string):void => {
    const JitsiMeetJS = useConnectionStore.getState().jsMeet 
    const connection = useConnectionStore.getState().connection //TODO: either move to ConnectionStore or handle undefined here
    // make sure there is a conference Name
    const enteredConferenceName = process.env.REACT_APP_DEMO_SESSION || conferenceID.length > 0 ? conferenceID : get().conferenceName || "chatmosphere"
    set({conferenceName:enteredConferenceName})
    const conferenceName = secureConferenceName(enteredConferenceName, process.env.REACT_APP_SESSION_PREFIX)
    if(connection && JitsiMeetJS && conferenceName) {
      const conference = connection.initJitsiConference(conferenceName, conferenceOptions) //TODO before unload close connection
      conference.on(JitsiMeetJS.events.conference.USER_JOINED, _addUser)
      conference.on(JitsiMeetJS.events.conference.USER_LEFT, _removeUser)
      conference.on(JitsiMeetJS.events.conference.TRACK_ADDED, _onRemoteTrackAdded)
      conference.on(JitsiMeetJS.events.conference.TRACK_REMOVED, _onRemoteTrackRemoved)
      conference.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, _onConferenceJoined)
      conference.on(JitsiMeetJS.events.conference.TRACK_MUTE_CHANGED, _onTrackMuteChanged);
      conference.on(JitsiMeetJS.events.conference.CONFERENCE_ERROR, _onConferenceError);
      conference.on(JitsiMeetJS.events.conference.MESSAGE_RECEIVED, _onMessageReceived);
      //conference.on(JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED, onUserNameChanged);
      conference.on(JitsiMeetJS.events.conference.PARTICIPANT_PROPERTY_CHANGED, _onParticipantPropertyChanged)
      conference.on(JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED, _onUserNameChanged);
      // conference.on(JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED, on_remote_track_audio_level_changed);
      //conference.on(JitsiMeetJS.events.conference.PHONE_NUMBER_CHANGED, onPhoneNumberChanged);
      conference.addCommandListener("pos", _onPositionReceived)
      window.addEventListener('beforeunload', leaveConference) //does this help?  
      window.addEventListener('unload', leaveConference) //does this help?
      conference.join()
      set({conferenceObject:conference,error:undefined})
    } else {
      throw new Error('Jitsi Server connection has not been initialized or failed :( - did you call initJitsiMeet on ConnectionStore yet?')
    }
  }

  const join = () => {

  }
  const leaveConference = () => { 
    const conference = get().conferenceObject
    conference?.leave()
  }
  const setConferenceName = (name = "chatmosphere") => {
    const newName = name
    set({conferenceName:newName})
    return newName
  }

  const setDisplayName = (name) => {
    set({displayName:name})
    const conference = get().conferenceObject
    conference?.setDisplayName(name)
  }
  const calculateVolume = (id:ID):void => produceAndSet (newState => {
    const localUserPosition:IVector2 = useLocalStore.getState().pos //check if this is updated or kept by closure
    if(newState.users[id]) {
      newState.users[id]['volume'] = getVolumeByDistance(localUserPosition, newState.users[id]['pos'])
    }
  })
  const calculateVolumes = (localPos:IVector2) => produceAndSet (newState => {
    const users = newState.users
    Object.keys(users).map(key => {
      const user = users[key]
      newState.users[key]['volume'] = getVolumeByDistance(localPos, user.pos)
      return null
    })
  })

  // TODO: Not used yet
  const addLocalTrackToConference = (newTrack:IMediaTrack) => {
    const conference = get().conferenceObject
    conference?.addTrack(newTrack)
      .catch(error => console.log(error))
  }
  // not used currently - stub for alternative implementation if replacing streams doesnt fix delay; else remove
  // const replaceLocalTrackInConference = (newTrack:IMediaTrack, oldTrack:IMediaTrack) => {
  //   const conference = get().conferenceObject
  //   conference?.removeTrack(oldTrack)
  //     .then(()=>addLocalTrackToConference(newTrack))
  //     .catch(error => console.log(error))
  // }

  // Return Object *******************************************
  return {
    ...initialState,
    initConference,
    joinConference: join,
    leaveConference,
    setConferenceName,
    setDisplayName,
    calculateVolume,
    calculateVolumes,
    addLocalTrackToConference
  }
})

if(process.env.NODE_ENV === 'development') {
  // @ts-ignore: Unreachable code error
	mountStoreDevtool('ConferenceStore', useConferenceStore)
}
