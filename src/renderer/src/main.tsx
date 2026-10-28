import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { ConsoleView } from './console/ConsoleView'
import { OutputWindow } from './views/OutputWindow'
import { StageWindow } from './views/StageWindow'

const role = window.sc.role
if (role !== 'console') document.body.classList.add('output-window')

const view = { console: <ConsoleView />, output: <OutputWindow />, stage: <StageWindow /> }[role]

createRoot(document.getElementById('root')!).render(<StrictMode>{view}</StrictMode>)
