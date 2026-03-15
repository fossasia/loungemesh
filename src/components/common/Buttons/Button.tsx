import styled, { css } from "styled-components"
import { ThemeType } from "../../../theme/theme"

export interface IButtonProps {
  IconStart?: React.ReactChild
  IconEnd?: React.ReactChild
  warning?: boolean
  primary?: boolean
  active?: boolean
  focus?: boolean
  label?: string
  round?: boolean
  theme: ThemeType
}

//better way would be to set values as val="true" & omit if false
const BaseButton = (props) => {
  const {
    label,
    IconStart,
    IconEnd,
    icon,
    primary,
    active,
    warning,
    focus,
    round,
    small,
    ghost,
    ...rest
  } = props

  return (
    <button {...rest}>
      {IconStart}
      <label>{label}</label>
      {IconEnd}
    </button>
  )
}

export const Button = styled(BaseButton)<IButtonProps>`
  font-size: ${(props) => props.theme.fontSize.body};
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 46px;
  min-width: 48px;
  padding: 12px 20px;
  border-radius: ${(props) =>
    props.round ? "25px" : props.theme.radius.small};
  color: ${(props) => props.theme.button.default.fg};
  border: 2px solid transparent;
  background-color: ${(props) => props.theme.button.default.bg};
  font-weight: normal;

  & svg {
    stroke: ${(props) => props.theme.button.default.fg};
  }
  &:hover {
    background-color: ${(props) => props.theme.button.default.bg_h};
  }
  &:active {
    background-color: ${(props) => props.theme.base["4"]};
  }
  &:focus {
    outline: none;
  }

  // Ghost
  ${(props) =>
    props.ghost &&
    css`
      background-color: transparent;
      &:hover {
        background-color: ${(props) => props.theme.button.default.bg};
      }

    `}
  // Primary
  ${(props) =>
    props.primary &&
    css`
      color: ${(props) => props.theme.button.primary.fg};
      background-color: ${(props) => props.theme.button.primary.bg};
      & svg {
        stroke: ${(props) => props.theme.button.primary.fg};
      }
      &:hover {
        background-color: ${(props) => props.theme.base["6"]};
      }
      &:active {
        background-color: ${(props) => props.theme.base["1"]};
      }
    `}
    
    // Active
    ${(props) =>
    props.active &&
    css`
      color: ${(props) => props.theme.button.active.fg};
      background-color: ${(props) => props.theme.button.active.bg};

      & svg {
        stroke: ${(props) => props.theme.button.active.fg};
      }
      &:hover {
        & svg {
          stroke: ${(props) => props.theme.button.default.fg};
        }
      }
    `}

  // Warning
  ${(props) =>
    props.warning &&
    css`
      color: ${(props) => props.theme.button.warning.fg};
      background-color: ${(props) => props.theme.button.warning.bg};
      & svg {
        stroke: ${(props) => props.theme.button.warning.fg};
      }
      &:hover {
        background-color: ${(props) => props.theme.button.warning.bg_h};
        border: solid 2px ${(props) => props.theme.color["7"]};
      }
      &:active {
        background-color: ${(props) => props.theme.base["1"]};
      }
    `}
  
  // Icon
  ${(props) =>
    props.icon &&
    css`
      padding: 12px;

      & label {
        display: none;
      }
    `}

`

export const GhostButton = styled(Button)`
  background-color: transparent;

  ${(props) =>
    props.warning &&
    css`
      color: ${(props) => props.theme.text.warning};
      background: transparent;
      /* border: 2px solid ${(props) => props.theme.button.warning.bg}; */

      & svg {
        stroke: ${(props) => props.theme.button.warning.bg};
      }
    `}
  &:hover {
    ${(props) =>
      props.warning &&
      css`
        // border: 2px solid ${(props) => props.theme.button.warning.bg};
        background-color: ${(props) => props.theme.button.default.bg};
      `}
  }
`

export const IconButton = styled(Button)`
  padding: 12px;

  & label {
    display: none;
  }
`
