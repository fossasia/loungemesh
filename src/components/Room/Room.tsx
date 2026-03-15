import React, { useEffect, useState } from "react"
import { ReactNode } from "react"
import styled from "styled-components"
import { panOptions } from "../PanWrapper/panOptions"

/* fixed size won't work, because when scale is 1 there will be room to pan; but the plugin won't allow it because scale is 1. 
the fix is to set the size of the react-transform-component and react-transform-element exlusively (see App.css) */

const RoomContainer = styled.div<{ bg: string }>`
  width: ${panOptions.room.size.x}px;
  height: ${panOptions.room.size.y}px;
  box-sizing: border-box;
  display: block;
  background-image: ${(props) =>
    props.bg ? "url(props.bg)" : "none"};
`

// const Background = styled.div`
//   background-image:url("/build/favicon.ico");
//   opacity:0.1;
//   width:100%;
//   height:100%;
// `

interface Props {
  children?: ReactNode
  identifier?: string
}

export const Room: React.FC<Props> = ({ children, identifier }) => {
  const [background, setBackground] = useState("")
  useEffect(() => {
    const getBg = async () => {
      const data = await fetch(
        `https://api.eventyay.com/v1/events/${identifier}/chatmosphere`,
        {
          headers: {
            Accept: "application/vnd.api+json",
          },
        },
      ).then((res) => res.json())
      const bg = data["data"]["attributes"]["bg-img-url"].toString()
      console.log(bg)
      setBackground(bg)
    }

    getBg().catch(console.error)
  }, [])

  return (
    <RoomContainer bg={background}>
      {/* <Background /> */}
      {children}
    </RoomContainer>
  )
}
