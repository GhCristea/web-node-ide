import { onMount, onCleanup } from 'solid-js'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { TerminalHandle } from './types'

export function TerminalComponent(props: { ref?: (handle: TerminalHandle) => void }) {
  let terminalDiv: HTMLDivElement | undefined
  let xterm: Terminal | null = null
  let fitAddon: FitAddon | null = null

  onMount(() => {
    if (!terminalDiv) return

    xterm = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e' },
      fontSize: 12,
      fontFamily: 'monospace',
      convertEol: true
    })

    fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(terminalDiv)

    setTimeout(() => {
      fitAddon?.fit()
    }, 0)

    xterm.writeln('\x1b[1;32m⚡ Terminal Ready\x1b[0m')

    const resizeObserver = new ResizeObserver(() => {
      fitAddon?.fit()
    })

    resizeObserver.observe(terminalDiv)

    if (props.ref) {
      props.ref({ write: text => xterm?.write(text), clear: () => xterm?.reset() })
    }

    onCleanup(() => {
      resizeObserver.disconnect()
      xterm?.dispose()
    })
  })

  return (
    <div
      ref={terminalDiv}
      style={{ height: '100%', width: '100%', 'background-color': '#1e1e1e', padding: '1px', overflow: 'hidden' }}
    />
  )
}
