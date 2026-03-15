import { mountStoreDevtool } from "simple-zustand-devtools"
import create from "zustand"
import {
  getConnectionOptions,
  jitsiInitOptions,
} from "./../components/JitsiConnection/jitsiOptions"

// ****************************************************************
// CONNECTION STORE
// ****************************************************************
export const useConnectionStore = create<IConnectionStore>((set, get) => {
  const initialState = {
    serverUrl: process.env.REACT_APP_SERVICE_URL || "meet.jit.si",
    jsMeet: undefined,
    room: null,
    connection: undefined,
    connected: false,
    error:""
  }

  // # Private Functions
  const _setConnected = () => set({ connected: true, error:undefined }) //actually this should initiate a new conference object without joining it
  const _setDisconnected = () => set({ connected: false })
  var jitsiMeetPromise

  // # Public Functions
  const initJitsiMeet = async () => {
    const jsMeet = get().jsMeet
    if (jsMeet) return jsMeet
    // not sure if most elegant but now returns jitsi object and we can initialize conference nicely after server
    jitsiMeetPromise = new Promise((res, rej) => {
      const jitsiMeet = async () => window.JitsiMeetJS
      jitsiMeet().then((jsMeet) => {
        jsMeet.setLogLevel(jsMeet.logLevels.ERROR)
        //without init you can not create local tracks
        jsMeet.init(jitsiInitOptions)
        set({ jsMeet: jsMeet })
        // get().connectServer()
        res(jsMeet)
      })
    })
    // const result = await promise
    return await jitsiMeetPromise
  }
  
  const connectServer = () => {
    //Since jsMeet object is async (Promise), we should use also Promise to create a connection and connect. Because this is depandent to jsMeet object
    //But this function should be called only once if there is a current connection object.
    const connection = get().connection
    if (connection) {
      //It might be that the object is created but the connection failed. Try again, until we handle the errors better.
      if (!get().connected) connection.connect()
      return
    }
    jitsiMeetPromise.then((jsMeet) => {
      const connectionOptions = getConnectionOptions()
      const tmpConnection = new jsMeet.JitsiConnection(
        null,
        null,
        connectionOptions,
      ) //should be callable to init new connection to different servers
      tmpConnection.addEventListener(
        jsMeet.events.connection.CONNECTION_ESTABLISHED,
        _setConnected,
      )
      tmpConnection.addEventListener(
        jsMeet.events.connection.CONNECTION_FAILED,
        (e) => {
          console.log("tmpConnection:",tmpConnection.xmpp.lastErrorMsg)
          // console.log("tmpConnection:",get().connection)
          set({ connection: undefined, error:tmpConnection.xmpp.lastErrorMsg })
        },
      )
      tmpConnection.addEventListener(
        jsMeet.events.connection.CONNECTION_DISCONNECTED,
        _setDisconnected,
      )
      // TODO separate in own function to connect & disconnect to different servers or call connection.connect() / connection.disconnect() from components?
      // The above TODO is valid, but a connection to public jitsi server requires the connectionOptions, because the conference name is passed through the url.
      // Therefore, for now; connection object is created and connected; disconnect will disconnect and destroy the connection object.
      tmpConnection.connect()
      set({ connection: tmpConnection, error:undefined })
      
    })
  }

  return {
    ...initialState,
    initJitsiMeet,
    connectServer,
    disconnectServer: () => {
      get().connection?.disconnect()
      set({ connection: undefined })
    },
    setConnected: () => set({ connected: true }), //actually this should initiate a new conference object without joining it
    setDisconnected: () => set({ connected: false }),
  }
})

if (process.env.NODE_ENV === "development") {
  let root = document.createElement('div');
  root.id = 'simple-zustand-devtools2';
  document.body.appendChild(root);
  // @ts-ignore: Unreachable code error
  mountStoreDevtool("ConnectionStore", useConnectionStore, root)
}
