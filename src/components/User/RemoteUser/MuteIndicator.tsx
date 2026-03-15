import * as React from 'react';
import styled from 'styled-components';
import {ReactComponent as MuteCatSmall} from '../../../assets/muteCatSmall.svg'

export const MuteContainer = styled.div`
  position:absolute;
  top: 170px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 2.5rem;
`

export const MuteIndicator = () => (
  <MuteContainer>
    <MuteCatSmall />
  </MuteContainer>
)