var g_room_id;
var g_rank; // 房间中的 rank
var g_last_my_theta;
var g_is_host = false;
var g_curr_turn = 0;
var g_num_players = 0;
const GAME_STATUS_LOBBY = "lobby";
const GAME_STATUS_INGAME = "ingame";
var g_game_status = GAME_STATUS_LOBBY;

//var SERVER_ADDR = "http://107.178.219.255:3000";
var SERVER_ADDR = "http://127.0.0.1:3001";

function ConnectToServer() {
  g_room_id = undefined;
  g_is_host = false;
  
  console.log("[ConnectToServer]");
  socket = io(SERVER_ADDR);
  
  socket.on('hello_echo', (token)=>{
    g_token = token;
    OnConnected();
  });
  
  socket.on("roomstate", (room_states)=>{
    console.log("<< roomstate");
    SpawnRoomButtons(room_states);
  });
  
  socket.on("create_new_game_failed", ()=>{
    console.log("房间已经有一场游戏了不能新建游戏");
  });
  
  socket.on("joined_game", (room_id)=>{
    g_state.cxn_state = "房间 " + room_id + "（玩家）";
    g_room_id = room_id;
    HideRoomButtons();
    g_game_status = GAME_STATUS_INGAME;
  });
  
  socket.on("join_game_failed", ()=>{
    console.log("加入房间失败");
  });
  
  socket.on("poscene_snapshot", (snapshot)=>{
    Load(snapshot);
  });
  
  socket.on("become_room_host", (room_id)=>{
      console.log("<< become_room_host");
    g_is_host = true;
    g_state.cxn_state = "房间 " + room_id + "（房主）";
    g_room_id = room_id;
    GenCandidate();
    SendCandidate();
  });
  
  socket.on("initialize_game", ()=>{
    InitializeGame();
  });
  
  socket.on("rank", (rank)=>{
    g_rank = rank;
    console.log("<< rank " + rank);
  });
  
  socket.on("thetas", (thetas) => {
    g_thetas = thetas;
  });
  
  socket.on("theta_one", (theta, rank) => {
    if (rank < g_thetas.length && rank != this.rank) {
      g_thetas[rank] = theta;
    }
  });
  
  socket.on("cand", (cand) => {
    console.log(cand);
    if (cand == null) return;
    
    const j = JSON.parse(cand);
    
    if (j.type == "rect") {
      g_cand = new PoRect();
      Object.assign(g_cand, j);
      console.log(g_cand);
    } else if (j.type == "circle") {
      g_cand = new PoCircle();
      Object.assign(g_cand, j);
      console.log(g_cand);
    }
  });
  
  socket.on("release_candidate", () => {
    if (g_is_host) {
      g_scene.shapes.push(g_cand);
      g_cand = undefined;
    }
  });
  
  socket.on("request_candidate", () => {
    if (g_is_host) {
      GenCandidate();
      SendCandidate();
    }
  });
  
  socket.on("curr_turn", (turn, num_players) => {
    g_curr_turn = turn;
    g_num_players = num_players;
  });
}

function CreateNewGame(rid) {
  console.log(">> [CreateNewGame] " + rid);
  socket.emit("create_new_game", rid);
}

function JoinRoom(rid) {
  console.log(">> [JoinRoom] " + rid);
  socket.emit("join_room", rid);
}

function SendSnapshotToRoom() {
  if (g_room_id != undefined && g_is_host == true) {
    console.log(">> [SendSnapshotToRoom]");
    const snapshot = JSON.stringify(g_scene);
    socket.emit("poscene_snapshot", snapshot);
  }
}

function SendMyThetaIfNeeded(value, g_rank) {
  if (g_last_my_theta != value) {
    console.log(">> theta_one");
    socket.emit("theta_one", value, g_rank);
    g_last_my_theta = value;
  }
}

function RequestReleaseCandidate() {
  socket.emit("request_release_candidate");
}

function SendCandidate() {
  const s = JSON.stringify(g_cand);
  //console.log(">> SendCandidate " + s);
  socket.emit("cand", s);
}