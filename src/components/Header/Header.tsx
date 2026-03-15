import * as React from 'react';
import styled from "styled-components";
import kissingCat from './../../assets/kissingCat.svg'
import loveCat from './../../assets/loveCat.svg'

const StyledHeader = styled.a`
  &:before {
    content: url(${kissingCat});
    margin-right: 5px;
  }
  &:after {
    display:none;
    content: url(${loveCat});
  }
  display: flex;
  flex-direction: row;
  align-items: center;
  position: fixed;
  margin: 10px 0;
  right: 10px;
  /* background: ${props => props.theme.base['6']}; */
  padding: 10px;
  border-radius: 5px; 
  z-index: 10000;
  font-weight: 500;
  font-size: 1.25rem;
  text-decoration: none;
  color:#000;
  height: 40px;
  &:hover {
    /* background-color: ${props => props.theme.base['4']}; */
    &:before {
      content: url(${loveCat});
      margin-right: 5px;
    }
  }
`

export const Header = ({children=""}) => (
  <StyledHeader target="_blank" href="http://chatmosphere.cc">{children}</StyledHeader>
)