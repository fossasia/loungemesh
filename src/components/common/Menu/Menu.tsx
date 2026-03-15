import styled from "styled-components"
import Card from "../Card/Card"
import { useState } from "react"
import { IconButton } from "../Buttons/Button"

export const MenuCard = styled(Card)`
  width: 270px;
  padding: 15px;
  top: 15px;
  right: 15px;
  bottom: 80px;
`

interface MenuProps {
	title: string
	label?: string
	icon?: React.ReactNode
	children: React.ReactNode
}

export const Menu = ({ title, label="", icon=undefined, children }:MenuProps) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      {open && (
        <MenuCard title={title} onClose={() => setOpen(false)}>
          {children}
        </MenuCard>
      )}
      <IconButton
        IconStart={icon}
        label={label}
				active={open}
        round
        ghost
        onClick={() => setOpen(!open)}
      />
    </>
  )
}


export const List = styled.ul`
	padding: 0;
	`
export const ListItem = styled.li`
	width: 100%;
	list-style: none;
	> * {
		padding: 5px 0;
	}
`
const StyledLink = styled.a`
	width: 100%;
	display: flex;
	flex-direction: row;
	gap: 15px;
	align-items: center;
	text-decoration: none;
	border-bottom: 1px solid transparent;
	border-radius: ${(props) => props.theme.radius.small};
	color: ${(props) => props.theme.base[2]};

	&:visited {
		color: ${(props) => props.theme.base[2]};
	}
	&:active {
		color: ${(props) => props.theme.color.primary};
	}
	&:hover {
		/* border-bottom: 1px solid ${(props) => props.theme.line.light}; */
		background-color: ${(props) => props.theme.button.default.bg_h};
		svg {
			fill: ${(props) => props.theme.color[3]};
			/* filter: brightness(1.1); */
			transform: scale(1.1);
		}
	}
	svg {
	}
`
export const ListLink = ({href, children, ...rest}) => (
	<ListItem>
		<StyledLink {...rest} href={href}>{children}</StyledLink>
	</ListItem>
)
export const ListSeparator = styled.hr`
	width: 100%;
	border-top: 1px solid ${(props) => props.theme.line.light};
`


// const Select = ({name, callback=()=>null, children}:{name:string, callback?:()=>void, children:React.ReactNode}) => {
// 	return (
// 		<span>
// 			<input type="checkbox" name={name} />
// 			<label htmlFor={name}>{children}</label>
// 		</span>
// 	)
// }
