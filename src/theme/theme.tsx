
// this interface describes which variables need to be there
// and what kind of things can be stored in them

export type ThemeType = typeof defaultTheme & typeof warm



const color = {
  mono0: "#000000",
  mono10: "#272625",
  mono30: "#434241",
  mono60: "#9C9B9A",
  mono80: "#D5D4D3",
  mono95: "#F5F4F3",
  mono100: "#FFFFFF",
  orange100: "#E27022",
  orange50: "#F4AA41",
  orange20: "#F8CD90",
  orange10: "#F9E8D1",
  blue100: "#5770EB",
  pink100: "#e67a94",
  red100: "#E15D4C",
  red120: "#f07969",
}

// Theme ------------------------------

const defaultTheme = {
  fontSize: {
    hero: "3rem",
    h1: "1.5rem",
    h2: "1.25rem",
    h3: "1.125rem",
    h4: "1rem",
    strong: "1rem",
    subline: "1.25rem",
    body: "1rem",
    small: "0.875rem",
    tiny: "0.75rem",
  },
  fontWeights: {
    bold: '600',
    medium: '500',
    regular: '400'
  },
  lineHeights: {},
  radius: {
    small: "5px",
  },
}

const warm = {
  name: "warm",
  base: {
    1: color.mono0,
    2: color.mono10,
    3: color.mono30,
    4: color.mono60,
    5: color.mono80,
    6: color.mono95,
    7: color.mono100,
  },
  color: {
    1: color.orange100,
    2: color.orange50,
    3: color.orange20,
    4: color.orange10,
    5: color.blue100,
    6: color.pink100,
    7: color.red100,
    primary:color.blue100,
    auxiliary: color.pink100,
    warning:color.red100,
  },
  text: {
    default: color.mono10,
    light: color.mono60,
    warning: color.red100,
    primary: color.blue100,
  },
  button: {
    default:{
      bg:color.mono100,
      bg_h:color.mono95,
      fg:color.mono30
    },
    warning:{
      bg: color.red100,
      bg_h: color.red120,
      fg: color.mono100
    },
    primary:{
      bg:color.blue100,
      bg_h:color.blue100,
      fg:color.mono100
    },
    active: {
      bg:color.blue100,
      bg_h:color.blue100,
      fg:color.mono100
    }
  },
  input: {
    default:{
      bg:color.mono100,
      bg_h:color.mono95,
      fg:color.mono80
    }
  },
  line: {
    default:color.mono60,
    light:color.mono95,
    dark:color.mono30
  },
  bg: {
    inset: color.mono60,
    card: color.mono100,
  },
}

const dark = {
  ...warm,
  name: "dark",
}

export const lightTheme:ThemeType = { ...defaultTheme, ...warm }
export const darkTheme:ThemeType = { ...defaultTheme, ...dark }
