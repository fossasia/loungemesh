import { MouseEventHandler } from "react"
import { Maximize2 } from "react-feather"
import styled from "styled-components"

const ResizeContainer = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
	& div {
		display: none;
	}
  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
		& div {
			display: block;
		}
  }
`

const ResizeElement = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.5);
	padding: 15px;
	border-radius: 50%;
  & svg {
		stroke:white;
	}
`

export const ResizeControl = ({callback=()=>null}:{callback:MouseEventHandler<HTMLDivElement>|undefined}) => {
  return (
    <ResizeContainer onClick={callback}>
      <ResizeElement>
        <Maximize2 />
      </ResizeElement>
    </ResizeContainer>
  )
}
