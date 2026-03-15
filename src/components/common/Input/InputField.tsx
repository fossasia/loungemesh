import styled from "styled-components";

export const InputField:any = styled.input`
  margin-top: 5px;
  padding: 8px 5px;
  border: 1px solid ${props => props.theme.line.default};
  border-radius: ${props => props.theme.radius.small};
  text-align: center;
  font-weight: 400;
  font-size: ${props => props.theme.fontSize.body};

  &:focus {
    outline: none;
    border: 1px solid ${props => props.theme.color.primary};
  }
`;
