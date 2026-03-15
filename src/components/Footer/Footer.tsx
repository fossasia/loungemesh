import React from "react"
import styled from 'styled-components'


const Container = styled.div`
  position: absolute;
  bottom: 0;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content:space-between;
`

const LeftBox = styled.div`
  margin-left: 12px;
`

const CenterBox = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 10px;
  & > button {
    margin: 0 5px;
  }
`
  const RightBox = styled.div`
    margin-right: 12px;
    display: flex;
    flex-direction: row;
    gap:10px;
  `

export const Footer = ({ children, rightBox, leftBox }:{children?:React.ReactNode, rightBox?:React.ReactNode, leftBox?:React.ReactNode}) => {
 
  return (
    <Container>
      <LeftBox>
        {leftBox}
      </LeftBox>
      <CenterBox>
       {children}
      </CenterBox>
      <RightBox>
        {rightBox}
      </RightBox>
    </Container>
  )
}

// const ConnectedFooterAddons = () => {
//   const footerEl = useAddonsStore(
//     useCallback((store) => store.footerElements, []),
//   )
//
//   return (
//     <>
//       {footerEl?.map((b) => {
//         console.log(b)
//         return b?.el
//       })}
//     </>
//   )
// }
