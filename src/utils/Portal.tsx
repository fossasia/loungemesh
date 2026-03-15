import { useEffect, useState } from "react"
import ReactDom from 'react-dom'

export const Portal = ({children, element}) => {
	const [hasMounted, setHasMounted] = useState(false)

	useEffect(() => {
		if(element) setHasMounted(true)
	},[element])

	if(!hasMounted) return null

	return (
		ReactDom.createPortal(
			children,
			element
		)
	)
}