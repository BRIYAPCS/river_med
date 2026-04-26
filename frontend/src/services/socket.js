import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? ''

let _socket = null

export function getSocket() {
  if (!_socket) {
    _socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
  }
  return _socket
}
