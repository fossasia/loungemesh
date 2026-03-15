import create from "zustand";


type IInfoStore = {
  show: boolean
  setHidden: () => void
  setVisible: () => void
  toggleVisible: () => void
}

export const useInfoStore = create<IInfoStore>(set => ({
  show: true,
  setHidden: ():void => set({show: false}),
  setVisible: ():void => set({show:true}),
  toggleVisible: ():void => set(state => ({show: !state.show}))
}))