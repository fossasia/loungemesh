declare type JitsiMeetJS = any

declare type IMediaTrack = {
  track:{id:string}
  containers:any[]
  videoType?:string
  getType: () => deviceType
  dispose: () => promise
  isLocal: () => boolean
  isMuted: () => boolean
  mute: () => void
  unmute: () => void
  addEventListener: (eventType:string,callback:(...rest)=>void) => boolean
  removeEventListener: (eventType:string,callback:(...rest)=>void) => boolean
  getParticipantId: () => ID
  attach: (element:HTMLElement) => void
  detach: (element:HTMLElement) => void
}
declare type IAudioTrack = IMediaTrack
declare type IVideoTrack = IMediaTrack 

declare type IVector2 = {x:number, y:number}


declare type IJitsiConference={
  on: (eventType:string,callback:(...rest)=>void) => boolean
  off: (eventType:string,callback:(...rest)=>void) => boolean
  addCommandListener: (command:string,callback:(e:any)=>void) => boolean
  sendCommand: (command:string,payload:any) => boolean
  join:()=>void
  setDisplayName:(name:string)=>void
  addTrack:(track:IMediaTrack)=>Promise<any>
  removeTrack:(track:IMediaTrack)=>Promise<any>
  myUserId:()=>ID
  setReceiverConstraints:(object)=>void
  leave:()=>void
  setLocalParticipantProperty:(key:string,value:any)=>void
  sendTextMessage:(txt:string)=>void
  getLocalTracks: () => IMediaTrack[]
  getLocalVideoTrack: () => IVideoTrack
  replaceTrack:(oldTrack:IMediaTrack,newTrack:IMediaTrack)=>Promise<any>
}

declare interface IJitsiEvents {
  track: {
    LOCAL_TRACK_STOPPED
    TRACK_AUDIO_OUTPUT_CHANGED
    TRACK_AUDIO_LEVEL_CHANGED
    TRACK_VIDEOTYPE_CHANGED
  }
  conference: {
    USER_JOINED
    USER_LEFT
    TRACK_ADDED
    TRACK_REMOVED
    CONFERENCE_JOINED
    TRACK_MUTE_CHANGED
    CONFERENCE_ERROR
    PARTICIPANT_PROPERTY_CHANGED
    DISPLAY_NAME_CHANGED
    MESSAGE_RECEIVED
  }
  connection: {
    CONNECTION_ESTABLISHED
    CONNECTION_FAILED
    CONNECTION_DISCONNECTED
  }
}

declare type Vector2 = {x:number, y:number}

//Feels like ZoomPan doesnt belong to LocalStore; maybe state of panHandler or own store?
 declare type ZoomPan = {
  pos:Vector2
  pan:Vector2 
  scale:number
  onPanChange: (params:any) => void
} 

declare type ILocalStore = {
  setLocalPosition: (newPosition:IVector2) => void
  setLocalTracks: (tracks:Track[]) => void
  toggleMute: () => void
  clearLocalTracks: () => void
  setMyID: (id:string) => void
  calculateUsersInRadius:(myPos:IVector2)=>void
  calculateUserInRadius:(id:ID)=>void
  calculateUsersOnScreen:()=>void
  calculateUserOnScreen:(user:IUser, el:HTMLDivElement)=>void
  usersInRadius: Array<string>
  visibleUsers: Array<string>
  usersOnStage: Array<string>
  setOnStage: (state:boolean) => void
  toggleStage: () => void
  toggleStageMute: ()=>void
  onStage: boolean
  selectedUsersOnStage: Array<string>
  setSelectedUserOnStage: (id:ID)=>void
  stageVisible: boolean
  stageMute: boolean
} & IUser & ZoomPan

declare type deviceType = "audio" | "video" | "desktop"

declare type IMediaDevices = {
  isDevicePermissionGranted: (type?: deviceType) => Promise<boolean>
}

declare type IJsMeet = {
  init: (options: IJitsiInitOptions) => void
  addTrack: (track: IMediaTrack) => void
  events: IJitsiEvents
  mediaDevices: IMediaDevices
  createLocalTracks: (
    options: { devices: deviceType[] }
  ) => Promise<IMediaTrack[]>
  JitsiConnection: any
}
declare type IJitsiConnection = {
  initJitsiConference: (
    conferenceName: string,
    conferenceOptions,
  ) => IJitsiConference
  connect: () => void
  disconnect: () => void
  xmpp:any
}

// should be connected with connection store 
declare type IConferenceStore = {
  conferenceObject?: IJitsiConference
  conferenceName: string|undefined
  isJoined: boolean
  users: IUsers
  displayName:string
  error:any
  serverUrl?: string // not used
  jsMeet?: IJsMeet // not used
  serverConnection?: IJitsiConnection //used?
  isConnectedToServer?: boolean // used?
  initConference: (conferenceID:sring) => void //
  joinConference?: () => void // Not Used 
  leaveConference: () => void
  setConferenceName: (name:string) => string
  connectServer?: (conferenceName: string) => void
  disconnectServer?: () => void
  setDisplayName:(name:string)=>void //why here?
  calculateVolume: (id:ID) => void // why here?
  calculateVolumes: (localPos:IVector2) => void // why here?
  replaceLocalTrackInConference?: (newTrack:IMediaTrack, oldTrack:IMediaTrack) => void
  addLocalTrackToConference?: (newTrack:IMediaTrack) => void
  messages: Array<{id:string, text:string, nr:number}>
}

declare type IConnectionStore = {
  serverUrl: string
  jsMeet?: IJsMeet
  connection?: IJitsiConnection
  connected: boolean
  error:any
  initJitsiMeet: () => any
  setConnected: () => void
  setDisconnected: () => void
  connectServer: (conferenceName: string) => void
  disconnectServer: () => void
}

declare interface IJitsiInitOptions {
  disableAudioLevels?: boolean
  disableSimulcast?: boolean
  useIPv6?: boolean
  enableWindowOnErrorHandler?: boolean
  disableThirdPartyRequests?: boolean
  enableAnalyticsLogging?: boolean
  preferredCodec?: string
  disabledCodec?: string
  preferH264?: boolean //deprecated
}

// Conference STore
//TODO: VideoType should be used to determine if desktop or camera is show 
declare type IUser = { id:ID, user?:any, mute:boolean, volume:number, pos:Point, properties?:IUserProperties, audio?:IAudioTrack, video?:IVideoTrack, videoType?:string, onStage?:boolean }
declare type IUsers = { [id:string]:IUser }
declare type ID = string
declare type IUserProperties = Record<string, string>

type ConferenceStore = {
  conferenceObject?: IJitsiConference
  conferenceName: string|undefined
  isJoined: boolean
  users: IUsers
  displayName:string
  error:any
} & ConferenceActions & UserActions

type ConferenceActions = {
  init: (conferenceID:string) => void
  join: () => void
  leave: () => void
  setConferenceName: (name:string) => boolean
}

type UserActions = {
  setDisplayName:(name:string)=>void
  calculateVolume: (id:ID) => void
  calculateVolumes: (localPos:Vector2) => void
}