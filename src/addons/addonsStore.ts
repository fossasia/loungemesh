import create from "zustand"

export const useAddonsStore = create((set:any, get:any) => {
	return ({
		addonElements: [],
		footerElements:[] as Array<{id:string, el:any}>,
		settingsElements: [],
		addFooterElement: (el) => set(state => ({footerElements:[...state.footerElements, el]})),
		removeFooterElement: (el) => set(state => ({footerElements:state.footerElements.filter(e => e.id !== el.id)})),
		addAddon: (el) => set(state => ({addonElements:[...state.addonElements, el]})),
		removeAddon: (el) => set(state => ({addonElements:state.addonElements.filter(e => e.id !== el.id)})),
		addSettingsElement: (el) => set(state => ({settingsElements:[...state.settingsElements, el]})),
		removeSettingsElement: (el) => set(state => ({settingsElements:state.settingsElements.filter(e => e.id !== el.id)}))
	})
})