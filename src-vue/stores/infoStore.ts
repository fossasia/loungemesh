import { defineStore } from 'pinia';

/** Matches legacy `useInfoStore` for the prototype banner (dismiss on click). */
export const useInfoStore = defineStore('info', {
  state: () => ({
    /** Visible on first load — dismiss sets false. */
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
