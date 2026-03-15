import { GitHub, Heart, MessageCircle, MoreVertical, Twitter } from "react-feather"
import styled from "styled-components"
import { List, ListLink, Menu } from "../../common/Menu/Menu"

const parameters = {
  title: "More",
  label: "More",
  icon: <MoreVertical />
}

const StyledHeart = styled(Heart)`
  /* fill: ${(props) => props.theme.color[7]}; */
`
const StyledTwitter = styled(Twitter)`
  /* fill: ${(props) => props.theme.color[5]}; */
`
const StyledGitHub = styled(GitHub)`
  /* fill: ${(props) => props.theme.base[5]}; */
`
const StyledMessageCircle = styled(MessageCircle)`
  /* fill: ${(props) => props.theme.color[4]}; */
`

export const MoreTab = (props) => {
  return (
  <Menu {...parameters}>
    <List>
      <ListLink href="https://opencollective.com/chatmosphere" target="_blank"><StyledHeart  /> Spenden</ListLink>
      <ListLink href="https://twitter.com/chatmospherecc" target="_blank"><StyledTwitter /> Twitter</ListLink>
      <ListLink href="https://github.com/Chatmosphere/chatmosphere-app" target="_blank"><StyledGitHub /> GitHub</ListLink>
      <ListLink href="https://www.allourideas.org/ChatmosphereFeedback/" target="_blank"><StyledMessageCircle /> Feedback</ListLink>
    </List>
  </Menu>
  )
}

export {}