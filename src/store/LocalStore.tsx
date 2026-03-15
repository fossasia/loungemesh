import produce from "immer"
import create from "zustand"
import { useConferenceStore } from "./ConferenceStore"
import { panOptions, transformWrapperOptions } from "../components/PanWrapper/panOptions"
import { mountStoreDevtool } from "simple-zustand-devtools"
import { getVectorDistance, isOnScreen } from "../utils/VectorHelpers"
import { audioRadius } from "../utils/LookupTable"


export const useLocalStore = create<ILocalStore>((set, get) => {

  const state = {
    id: "",
    mute: false,
    volume: 1,
    video: undefined,
    audio: undefined,
    pos: panOptions.user.initialPosition,
    pan: { x: transformWrapperOptions.defaultPositionX || 0, y: transformWrapperOptions.defaultPositionY || 0 },
    scale: 1,
    onStage: false,
    stageVisible: true,
    stageMute: false,
    usersInRadius: [],
    visibleUsers: [],
    usersOnStage: [],
    selectedUsersOnStage: [],
  }

  // # Private Functions
  const _produceAndSet = (callback: (newState: ILocalStore) => void) => set(state => produce(state, newState => callback(newState)))

  // # Public Functions
  const setLocalPosition = (newPosition) => {
    set({ pos: newPosition })
  }

  const toggleMute = () => {
    const audioTrack = get().audio
    if (!audioTrack) return
    if (audioTrack.isMuted()) {
      audioTrack.unmute()
      set({ mute: false })
    } else {
      audioTrack.mute()
      set({ mute: true })
    }
  }

  const setLocalTracks = tracks => _produceAndSet(newState => {
    const audioTrack = tracks.find(t => t.getType() === "audio")
    const videoTrack = tracks.find(t => t.getType() === "video") // second array el should be video

    newState.videoType = videoTrack?.videoType === "desktop" ? "desktop" : "camera" //set videoType
    if(videoTrack) newState.video = videoTrack
    if(audioTrack) newState.audio = audioTrack
  })

  const clearLocalTracks = () => _produceAndSet(newState => {
    // newState.audio?.dispose() //these throw errors on reconnection - some event handlers still leftover
    // newState.video?.dispose()
    newState.audio = undefined
    newState.video = undefined
  })

  const setMyID = (id: string) => set({ id: id })

  const onPanChange = ({ scale, positionX, positionY }) => {
    const viewport = {
      x: panOptions.room.size.x * scale,
      y: panOptions.room.size.y * scale,
    }
    const panLimit = {
      x: viewport.x - window.innerWidth,
      y: viewport.y - window.innerHeight,
    }
    const panPosition = {
      x: Math.max(-panLimit.x, Math.min(0, positionX)),
      y: Math.max(-panLimit.y, Math.min(0, positionY)),
    }
    calculateUsersOnScreen()
    set({ scale: scale, pan: panPosition })
  }

  const calculateUsersInRadius = (myPos: IVector2) => {
    const users = useConferenceStore.getState().users
    const usersInRadius = Object.keys(users).filter(key => {
      const user = users[key]
      if (getVectorDistance(myPos, user.pos) < audioRadius) return true
      return false
    })
    _setUsersInRadius(usersInRadius)
  }
  // if user moves it can be calculated cheaper
  const calculateUserInRadius = (id: ID) => {
    const usersInRadius = get().usersInRadius
    const user = useConferenceStore.getState().users[id]
    if (!user) return
    const localUserPosition: IVector2 = get().pos //check if this is updated or kept by closure
    if (getVectorDistance(user.pos, localUserPosition) < audioRadius) {
      //user is within radius
      if (usersInRadius.indexOf(user.id) === -1) _pushSelectedUser(user.id)
    } else {
      //not in radius but in array -> remove from array
      if (usersInRadius.includes(user.id)) {
        const clearedUsers = usersInRadius.filter(el => el !== user.id)
        _setUsersInRadius(clearedUsers)
      }
    }
  }

  //check if property "onStage" is set -> addd to onStage Array, else remove form array if exists
  // TODO this could also be done in the Stage addon iself; it feels as if it should be there; otherhand its good to have all logic in store somehow
  const _setUserOnStage = (user) => {
    const stageUsers = get().usersOnStage
    if (user.properties?.onStage) {
      set(state => ({ usersOnStage: [...state.usersOnStage, user.id] }))
    } else {
      if (stageUsers.includes(user.id)) {
        const clearedUsers = stageUsers.filter(el => el !== user.id)
        set(() => ({ usersOnStage: [...clearedUsers] }))
      }
    }
  }

  const calculateUsersOnScreen = () => {
    const els = document.querySelectorAll(".userContainer")
    const users = useConferenceStore.getState().users
    const visibleUserIds: Array<string> = []
    els.forEach(element => {
      _setUserOnStage(users[element.id])
      const tmpPos = element.getBoundingClientRect()
      if (isOnScreen({ x: tmpPos.x, y: tmpPos.y }, tmpPos.width, tmpPos.height)) visibleUserIds.push(element.id)
    })
    _setVisibleUsers(visibleUserIds)
  }
  //
  const calculateUserOnScreen = (user: IUser, el: HTMLDivElement) => {
    const visibleUsers = get().visibleUsers
    _setUserOnStage(user)
    const pos = el.getBoundingClientRect()
    if (isOnScreen({ x: pos.x, y: pos.y }, pos.width, pos.height)) {
      if (visibleUsers.indexOf(user.id) === -1) {
        _pushVisibleUser(user.id)
      }
    } else {
      //not on screen
      if (visibleUsers.includes(user.id)) {
        const clearedUsers = visibleUsers.filter(el => el !== user.id)
        _setVisibleUsers(clearedUsers)
      }
    }
  }

  const _setUsersInRadius = (ids) => _produceAndSet(store => {
    store.usersInRadius = [...ids]
  })
  const _pushSelectedUser = (id) => _produceAndSet(store => {
    store.usersInRadius.push(id)
  })
  const _setVisibleUsers = (ids) => {
    _produceAndSet(store => {
      store.visibleUsers = [...ids]
    })
    _setConstraint()
  }
  const _pushVisibleUser = (id) => {
    _produceAndSet(store => {
      store.visibleUsers.push(id)
    })
    _setConstraint()
  }

  const _setConstraint = () => {
    const conference = useConferenceStore.getState().conferenceObject
    const visibleUsers = get().visibleUsers
    const usersOnStage = get().usersOnStage
    conference?.setReceiverConstraints({
      "colibriClass": "SelectedEndpointsChangedEvent",
      "selectedEndpoints": [...visibleUsers, ...usersOnStage],
      "lastN": visibleUsers.length + usersOnStage.length,
      "onStageEndpoints": [...usersOnStage], // The endpoint ids of the participants that are prioritized up to a higher resolution.
      "defaultConstraints": { "maxHeight": 200 }, // Default resolution requested for all endpoints.
      "constraints": { // Endpoint specific resolution.
      },
    })
  }

  const setOnStage = (state: boolean) => {
    set({ onStage: state })
  }

  const toggleStage = () => {
    set(store => ({ stageVisible: !store.stageVisible }))
  }
  const toggleStageMute = () => {
    set(store => ({stageMute: !store.stageMute}))
  }

  const setSelectedUserOnStage = (id:ID) => {
    _produceAndSet(store => {
      if(store.selectedUsersOnStage[0] === id) {
        store.selectedUsersOnStage = []
      } else {
        store.selectedUsersOnStage = [id]
      }
    })
  }

  return {
    ...state,
    setLocalPosition,
    setLocalTracks,
    toggleMute,
    clearLocalTracks,
    setMyID,
    calculateUsersOnScreen,
    calculateUserOnScreen,
    calculateUsersInRadius,
    calculateUserInRadius,
    onPanChange,
    setOnStage,
    toggleStage,
    toggleStageMute,
    setSelectedUserOnStage,
  }
})


// const unsub1 = useLocalStore.subscribe((i) => globalThis.globalStore = i)


if (process.env.NODE_ENV === "development") {
  let root = document.createElement("div")
  root.id = "simple-zustand-devtools-3"
  document.body.appendChild(root)
  // @ts-ignore: Unreachable code error
  mountStoreDevtool("LocalStore", useLocalStore, root)
}
