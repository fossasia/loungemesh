import styled from 'styled-components'

export const AudioRadius = styled.div`
position: absolute;
transform: translate(-50%, -50%);
left: 50%;
top: 50%;
border: 2px dotted #ccc;
width: 1100px;
height: 1100px;
display: block;
border-radius: 800px;
pointer-events: none;
background: radial-gradient();
z-index: -100;
`