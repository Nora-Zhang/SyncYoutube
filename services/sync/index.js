const app = require('express')();
const server = app.listen(8080, () => {
  const host = server.address().address;
  const port = server.address().port;

  console.log("Sync listening at http://%s:%s", host, port);
});

const io = require('socket.io')(server);

let curRoomList = {};

io.on('connection', (socket) => {
  let room;
  console.log('A user connected');

  socket.on('join_room', (data) => {
    room = data.room;
    socket.join(room);
    if (!curRoomList[room]) {
      curRoomList[room] = 1;
    } else {
      ++curRoomList[room];
    }
  });

  socket.on('pause_video', (data) => {
    console.log('video paused');
    socket.broadcast.to(room).emit('pause_video', { time: data.time });
  })

  socket.on('play_video', (data) => {
    console.log('video played');
    socket.broadcast.to(room).emit('play_video', { time: data.time });
  })

  socket.on('change_time', (data) => {
    console.log('time changed');
    socket.broadcast.to(room).emit('change_time', { time: data.time });
  })

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    socket.leave(room);
    curRoomList[room]--;
    if (curRoomList[room] === 0) {
      delete curRoomList[room];
    }
    console.log(curRoomList);
  })
});
