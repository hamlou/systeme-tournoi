/* eslint-disable */
import { Server } from 'socket.io';

export default function SocketHandler(req: any, res: any) {
  if (res.socket.server.io) {
    console.log('Socket is already running');
  } else {
    console.log('Socket is initializing');
    const io = new Server(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
    });
    res.socket.server.io = io;

    io.on('connection', socket => {
      socket.on('send-event', obj => {
        socket.broadcast.emit('receive-event', obj);
      });
    });
  }
  res.end();
}

