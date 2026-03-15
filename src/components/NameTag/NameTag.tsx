import styled from "styled-components";

export const NameTag = styled.div`
  margin-top: 5px;
  border-radius: ${props => props.theme.radius.small};
  font-weight: 500;
  color:${props => props.theme.base['1']};
  background: ${props => props.theme.base['5']};
  text-align: center;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 8px 5px;
  &:hover {
    background: ${props => props.theme.base['4']};
    border: 1px solid ${props => props.theme.base['4']};
  }
`;
