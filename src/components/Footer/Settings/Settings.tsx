import { MdMoreVert } from "react-icons/md"
import styled from "styled-components"
import { Menu } from "../../common/Menu/Menu"
import { useSettingsStore } from "./SettingsStore"

export const Settings = () => {
  const elements = useSettingsStore((store) => store.elements)

  return (
    <Menu title="Settings" label="Settings" icon={<MdMoreVert />}>
      <StyledContentBox>
        {elements.map((element) => element)}
        <Select name="whut">test</Select>
      </StyledContentBox>
    </Menu>
  )
}

const Select = ({
  name,
  callback = () => null,
  children,
}: {
  name: string
  callback?: () => void
  children: React.ReactNode
}) => {
  return (
    <StyledSelect>
      <input type="checkbox" name={name} />
      <StyledLabel htmlFor={name}>{children}</StyledLabel>
    </StyledSelect>
  )
}

const StyledSelect = styled.div`
  display: flex;
  flex-direction: row;
  gap: 10px;
  padding: 5px 0;
  text-align: left;
  border-bottom: 1px solid ${(props) => props.theme.line.light};
`

const StyledLabel = styled.label`
  font-size: ${(props) => props.theme.fontSize.strong};
`

const StyledContentBox = styled.section`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: scroll;
`
