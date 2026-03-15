import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import reportWebVitals from './reportWebVitals'
import { ThemeProvider } from 'styled-components'
import { lightTheme } from './theme/theme'
import { GlobalStyles } from './theme/GlobalStyles/GlobalStyles'

ReactDOM.render(
	<React.StrictMode>
		<ThemeProvider theme={lightTheme}>
			<>
      <GlobalStyles/>
			<App />
			</>
		</ThemeProvider>
	</React.StrictMode>
	,
	document.getElementById('root'),
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
