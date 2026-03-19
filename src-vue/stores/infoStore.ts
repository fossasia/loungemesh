import { defineStore } from 'pinia';

/** Matches legacy `useInfoStore` for the prototype banner (dismiss on click). */
export const useInfoStore = defineStore('info', {
  state: () => ({
    /** Visible on first load like https://app.chatmosphere.cc — dismiss sets false. */
    show: true,
  }),
  actions: {
    setHidden() {
      this.show = false;
    },
    setVisible() {
      this.show = true;
    },
    toggleVisible() {
      this.show = !this.show;
    },
  },
});
