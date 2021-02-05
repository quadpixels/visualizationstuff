// 2021-02-01

// 导入一些东西
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http, {
  cors: {
    origin: ["http://edgeofmap.com:*",
             "https://editor.p5js.org", // TODO：加入服务端的HTTPS
             "http://localhost:3001" ],
    methods: ["GET", "POST"]
   }
});


if (!Array.prototype.remove) {
  Array.prototype.remove = function(val) {
    var i = this.indexOf(val);
         return i>-1 ? this.splice(i, 1) : [];
  };
}

// 簿记
const NUM_ROOMS = 16;
var g_rooms = [];
class Room {
  constructor() {
    this.state = "vacant";
    this.game = undefined;
    this.name = "room" + (g_rooms.length + "");
    this.sockets = [];
    this.host = undefined;
    this.snapshot = "";
    this.thetas = []; // 手臂的角度
    this.curr_turn = 0; // 该谁扔球了？
    this.cand = undefined;
  }
  
  AddPlayer(socket) {
    const rank = this.sockets.length;
    socket.rank = rank;
    socket.emit("rank", rank);
    this.sockets.push(socket);
    this.thetas.push(3.1415 / 2);
    if (rank > 0)
      socket.emit("cand", this.cand);
  }
  
  RemovePlayer(socket) {
    this.sockets.remove(socket);
    this.thetas.pop();
  }
  
  // 注意：发起变化的人就不用修改自己的了，在客户端上处理
  BroadcastThetas() {
    io.to(this.name).emit("thetas", this.thetas);
  }
  
  BroadcastCand() {
    io.to(this.name).emit("cand", this.cand);
  }
  
  ReassignRanks() {
    const N = Math.min(this.sockets.length, this.thetas.length);
    for (let i=0; i<N; i++) {
      this.sockets[i].rank = i;
      this.sockets[i].emit("rank", i);
    }
  }
  
  CreateNewGame(socket) {
    if (this.state == "vacant") {
      console.log("<< [CreateNewGame] vacant");
      
      this.state = "occupied";
      io.emit("roomstate", Room.GetRoomStates());
      socket.emit("joined_game", this.name);
      socket.emit("become_room_host", this.name);
      socket.emit("initialize_game");
      socket.join(this.name);
      socket.room = this;
      this.host = socket;
      this.AddPlayer(socket);
      this.BroadcastThetas();
    } else {
      console.log("<< [CreateNewGame] occupied");
      io.emit("create_new_game_failed");
    }
  }
  
  // 加入房间 可能是指在没有 host 的情况下拯救一下房间里的状况，不一定是加入一场正在进行
  // 中的游戏。所以叫这个名称
  JoinRoom(socket) {
    if (this.sockets.length < 1) {
      socket.emit("join_game_failed");
      return;
    }
    console.log("<< [JoinRoom]");
    socket.room = this;
    socket.join(this.name);
    socket.emit("joined_game", this.name);
    this.AddPlayer(socket);
    this.BroadcastThetas();
    socket.emit("cand", this.cand);
  }
  
  OnRoomSnapshot(socket, snapshot) {
    this.snapshot = snapshot;
    if (socket == this.host)
      socket.to(this.name).emit('poscene_snapshot', snapshot);
  }
  
  OnDisconnect(socket) {
    this.RemovePlayer(socket);
    if (this.host == socket) {
      this.host = undefined;
    }
    
    if (this.sockets.length > 0) {
      let new_host = this.sockets[0];
      new_host.emit("become_room_host", this.name);
      this.host = new_host;
      this.ReassignRanks();
      this.BroadcastThetas();
      this.curr_turn %= this.sockets.length;
    } else {
      this.Cleanup();
    }
  }
  
  Cleanup() {
    this.sockets = [];
    this.state = "vacant";
    this.game = undefined;
    this.host = undefined;
    this.snapshot = "";
    io.emit("roomstate", Room.GetRoomStates());
  }
  
  OnThetaChangedOne(socket, value, rank) {
    socket.to(this.name).emit("theta_one", value, rank);
  }
  
  SetCand(socket, cand) {
    this.cand = cand;
    socket.to(this.name).emit("cand", cand);
  }
  
  OnRequestReleaseCandidate(socket) {
    if (socket.rank == this.curr_turn) {
      this.host.emit("release_candidate");
      this.curr_turn = (this.curr_turn + 1) % (this.sockets.length);
      this.host.emit("request_candidate");
      io.to(this.name).emit("curr_turn", this.curr_turn, this.sockets.length);
    }
  }
  
  static GetRoomStates() {
    let ret = [];
    for (let i=0; i<g_rooms.length; i++) { ret.push(g_rooms[i].state); }
    return ret;
  }
};

class GameState {
};

var g_token = 1;

app.get("/", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.sendFile(__dirname + "/client/index.html");
})

app.use(express.static(__dirname + "..")); // 让app能够回传各种静态资源
app.use(express.static(__dirname + "/client")); // 让app能够回传各种静态资源

// 初始化房间
for (let i=0; i<NUM_ROOMS; i++) { g_rooms.push(new Room()); }

io.on('connection', function(socket) {
  const tok = g_token++;
  console.log("new connection, tok=" + tok);
  
  // 欢迎
  socket.emit("hello_echo", tok);
  socket.emit("roomstate", Room.GetRoomStates());

  // 请求在房间中开始一场新游戏
  socket.on("key", (k) => { console.log("key=" + k + " from " + tok); });
  socket.on("create_new_game", (rid) => { g_rooms[rid].CreateNewGame(socket); });
  socket.on("join_room", (rid) => { console.log(rid); g_rooms[rid].JoinRoom(socket); });
  socket.on("poscene_snapshot", (snapshot) => {
    if (socket.room != undefined)
      socket.room.OnRoomSnapshot(socket, snapshot); 
  });
  socket.on("disconnect", () => {
    if (socket.room != undefined) {
      socket.room.OnDisconnect(socket);
    }
  });
  socket.on("theta_one", (value, rank) => {
    if (socket.room != undefined) {
      socket.room.OnThetaChangedOne(socket, value, rank);
    }
  });
  socket.on("cand", (cand) => { socket.room.SetCand(socket, cand); });
  
  // 请求扔下来。
  // 因为是房主负责计算，所以如果房主的窗口被遮挡住，房主的计算就会停下，从而导致其它玩家也停下。
  socket.on("request_release_candidate", () => {
    if (socket.room != undefined)
      socket.room.OnRequestReleaseCandidate(socket);
  });
});

http.listen(3001, function() {
  console.log("Listening on port 3001");
});