import React from "react"
import create from "zustand"

type ISettingsStore = {
	elements: Array<React.ReactNode>
	addElement:(el:React.ReactNode)=>void
	removeElement:(el:React.ReactNode)=>void
}

export const useSettingsStore = create<ISettingsStore>(set => ({
  elements: [],
  addElement: (el) => {
    set((state) => ({
      elements: [...state.elements, el],
    }))
  },
	removeElement:(el) => {
		set(state => ({
			elements: [state.elements.filter(setting => setting !== el)]
		}))
	}
}))


