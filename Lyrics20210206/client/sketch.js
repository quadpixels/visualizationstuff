// 2021-02-01

// todo:
// 同步游戏状态
// 操纵游戏玩法
// 5）音符功能 --- MVP
// 加一根红线表示游戏结束的上限 --- MVP
// 
// 1) 球落地会跳起来
// 2) 一个人玩的时候会无法扔
// 3）手臂不能超出范围
// 4）合成时的变化有点快
// 
// 又有感觉：目前的状态、自由度有点过高、合成过于容易
// 
// 如果想突出合作的话：合作的动机在于场景自己会捣乱。
// 方法一：大家都可以动，但是就让房主放
// 方法二：每次只有一个人能动
// 
// 在某些场景中触发墙壁上平移

let socket;
let g_token;
let g_state = {
  game_title: "《合成大音符》",
  cxn_state: "未连接",
  turn_info: "",
};
let g_scene = undefined;
let g_cand = undefined;

const DEBUG_DRAG = true;
let g_flags = [0,0,0];

// 从之前的脚本里来的
let g_btn_connect;
let g_room_buttons = [];
let g_buttons = [], g_textlabels = [];

let g_hovered_block;
let g_viewport;
let g_dirty = 0;

let g_paused = false;

let g_ball;

let SNAPSHOT_INTERVAL = 1000; // 1000ms
let g_snapshot_interval_countdown = SNAPSHOT_INTERVAL;

let THETA_UPDATE_INTERVAL = 100;
let g_theta_update_countdown = THETA_UPDATE_INTERVAL;

// 侯选区
let g_thetas = [3.1415/2, 3.1415*0.75]; // 手臂的角度，顺时针旋转

function setup() {
  createCanvas(400, 720);
  ConnectToServer();

  // 按钮
  g_btn_connect = new PushButton(100, 20, new p5.Vector(8, 32), "连接服务器", function() {
    ConnectToServer();
  }); 
  g_buttons.push(g_btn_connect)

  g_textlabels.push(new TextLabel(100, 20, new p5.Vector(8, 8), "cxn_state", 12));
  g_textlabels.push(new TextLabel(100, 20, new p5.Vector(268, 8), "turn_info", 12));

  g_viewport = new Viewport();
  g_viewport.pos.x = width / 2;
  g_viewport.pos.y = height / 2;
  
  //g_cand = new PoCircle(4);
}

if (!Array.prototype.remove) {
  Array.prototype.remove = function(val) {
    var i = this.indexOf(val);
         return i>-1 ? this.splice(i, 1) : [];
  };
}

// 更新房间列表状态
function SpawnRoomButtons(room_states) {
  const bw = 32, bh = 20, pad = 4;
  const x0 = 8, y0 = 60;
  let x = x0, y = y0;
  
  g_room_buttons.forEach((b) => g_buttons.remove(b));
  g_room_buttons = [];
  for (let i=0; i<room_states.length; i++) {
    const rs = room_states[i];
    let b;
    if (rs == "vacant") {
      b = new PushButton(bw, bh, new p5.Vector(x, y), ""+(i+1), ()=>{
        CreateNewGame(i);
      });
    } else {
      b = new PushButton(bw, bh, new p5.Vector(x, y), ""+(i+1), ()=>{
        JoinRoom(i);
      });
      b.bgcolor = "rgba(128,225,128,1)";
    }
    g_room_buttons.push(b);
    g_buttons.push(b);
    
    x += bw + pad;
    if (x > width - bw - pad) { x = x0; y += pad + bh; }
  }
}

function HideRoomButtons() {
  g_room_buttons.forEach((b) => g_buttons.remove(b));
  g_room_buttons = [];
  g_btn_connect.is_active = false;
}

let g_last_millis = 0;
function draw() {
  const ms = millis();
  const delta_ms = ms - g_last_millis;
  g_last_millis = ms;
  background(220);
  
  // Update UI event
  if (g_flags[0] != 0 && g_rank != undefined) {
    let t = g_thetas[g_rank] + g_flags[0] * delta_ms / 1000 * 3.14 / 2;
    if (t < 0) t = 0;
    if (t > PI) t = PI;
    g_thetas[g_rank] = t;
  }
  
  g_theta_update_countdown -= delta_ms;
  if (g_theta_update_countdown < 0) {
    g_theta_update_countdown = THETA_UPDATE_INTERVAL;
    SendMyThetaIfNeeded(g_thetas[g_rank], g_rank);
  }
  
  UpdateHover();
  if (DEBUG_DRAG) {
    push();
    
    pop();
  }
  
  // phys
  if (g_scene != undefined) {
    const dt = min(0.5, delta_ms / 200);
    const N = 3;
    if (!g_paused) {
      for (let i=0; i<N; i++) {
        g_scene.Step(dt / N);
      }
    }
    g_scene.Render();
    
    if (g_is_host) {
      g_snapshot_interval_countdown -= delta_ms;
      if (g_snapshot_interval_countdown < 0) {
        SendSnapshotToRoom();
        g_snapshot_interval_countdown = SNAPSHOT_INTERVAL;
      }
    }
  }
  
  // 手臂
  push();
  fill("#AAA"); stroke(0);
  if (g_thetas.length > 0) {
    let pts = [];
    let p0 = new p5.Vector(width/2, 0);
    pts.push(p0);
    const L = width / 2 / g_thetas.length;
    for (let i=0; i<g_thetas.length; i++) {
      const a = g_thetas[i];
      let delta = new p5.Vector(L*cos(a), L*sin(a));
      
      p0 = p0.copy().add(delta);
      pts.push(p0);
    }
    push();
    for (let i=0; i<pts.length-1; i++) {
      if (i == g_rank) { stroke("#33F"); } else { stroke("#333"); }
      line(pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y); 
    } 
    pop();
    for (let i=0; i<pts.length; i++) { circle(pts[i].x, pts[i].y, 5); }
    if (g_cand != undefined) {
      g_cand.pos = p0.copy();
      g_cand.Render();
    }
  }
  pop();
  
  // 行动次序
  if (g_rank != undefined && g_curr_turn != undefined) {
    let txt = "";
    let n = g_rank - g_curr_turn;
    if (n < 0) n += g_num_players;
    if (n == 0) { txt = "轮到你扔下音符了"; }
    else if (n == 1) { txt = "下一轮就该你了"; }
    else { txt = "还有 " + n + " 轮到你"; }
    g_state.turn_info = txt;
  }

  g_buttons.forEach((b) => { b.Render(); });
  g_textlabels.forEach((l) => { l.Render(); });
  
//  if (g_scene && !g_paused)
//    console.log(g_ball.v);
}

function keyPressed() {
  if (key == 's') {
    if (socket == undefined) {
      ConnectToServer();
    }
  }
  else if (key == 'a') {
    socket.emit('key', 'a');
  }
}

function OnConnected() {
  g_btn_connect.is_enabled = false;
  g_state.cxn_state = "已连接，请选择一个房间以开始或加入游戏";
}

function InitializeGame() {
  g_scene = new PoScene();
  g_scene.LoadDefaultScene();
  
  // 测试用场景
  if (true) {
    for (let i=0; i<1; i++) {
      let c = new PoCircle(12);
      
      c.pos.x = i*32+44//random() * width;
      c.pos.y = 200//random() * height;
      c.tag = 1;
      g_ball = c;
      /*
      let r = random();
      if (r < 0.2) { c.tex = g_xcjc_textures[0]; }
      else if (r < 0.6) { c.tex = g_xcjc_textures[1]; }
      else if (r < 0.8) { c.tex = g_xcjc_textures[2]; }
      else if (r < 1) { c.tex = g_xcjc_textures[3]; }
      g_circle = c;
      */
      g_scene.shapes.push(c);
    }
  } else {
  }
}

// Tag
function GenCandidate() {
  let avg_tag = 0, n = 1;
  if (g_scene != undefined) {
    g_scene.shapes.forEach((s) => {
      if (s.tag != undefined) {
        avg_tag += s.tag;
        n ++;
      }
    });
  } else { avg_tag = 1; }
  
  avg_tag /= n;
  const tag = 1 + parseInt(random(1+avg_tag));
  
  let cand;
  if (Math.random() < 0.5) {
    cand = new PoRect(Math.random()*30 + 20, Math.random()*30 + 20);
  } else {
    cand = new PoCircle(Math.random()*30 + 20);
  }
  cand.tag = tag;
  g_cand = cand;
}

var test0;

function Foo() {
  BecomeRoomHost();
  Save();
  Load(test0);
}

function ToP5Vector(s) {
  let ret = new p5.Vector();
  Object.assign(ret, s);
  return ret;
}

function Save() {
  test0 = JSON.stringify(g_scene);
  return test0;
}

function Load(snapshot) {
  let x = new PoScene();
  Object.assign(x, JSON.parse(snapshot));
  
  let shapes = [];
  for (let i=0; i<x.shapes.length; i++) {
    let s = x.shapes[i];
    if (s.type == "rect") {
      let s1 = new PoRect();
      // 需要手工重建这些个object，不能直接反序列化 :(
      Object.assign(s1, s);
      ["pos", "v", "pos_prev", "v_q", "v_prev", "j_q"].forEach((key) => {
        s1[key] = ToP5Vector(s[key]);
      });
      shapes.push(s1);
    } else if (s.type == "circle") {
      let c1 = new PoCircle();
      Object.assign(c1, s);
      ["pos", "v", "pos_prev", "v_q", "v_prev", "j_q"].forEach((key) => {
        c1[key] = ToP5Vector(s[key]);
      });
      shapes.push(c1);
    }
  }
  x.shapes = shapes;
  
  g_scene = x;
}

function keyPressed() {
  if (key == "a") { g_flags[0] = 1; }
  else if (key == "d") { g_flags[0] = -1; }
  else if (key == ' ') {
    socket.emit("request_release_candidate");
  } else if (key == 'p') {
    g_paused = !g_paused;
  }
}

function keyReleased() {
  if (key == "d" || key == "a") { g_flags[0] = 0; }
}