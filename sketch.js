let g_textbox; // Full screen overlay
let g_cam;
let g_flags = [ 0, 0, 0, 0, 0, 0 ]
let g_graph3d;
let g_curr_scene;
let g_animator;

let g_box;
let g_gl;
let g_highlighted = null;

let g_obj_module1;
let g_obj_module2, g_obj_module2_simp;
let g_obj_module3;
let g_gadget1, g_gadget2, g_gadget3;
let g_curr_gadget;

let g_obj_grid;

function unittest() {
  const u = new p5.Vector(1,4,5).normalize();
  const m = Mat3.RotationMatrix(u, 1.234);
  const q = Mat3ToQuaternion(m)
  console.log(q)
  console.log(m)
  const m2 = QuaternionToMat3(q)
  console.log(m2)
}

function setup() {
  displayDensity(2)
  let W = 720, H = 1280;
  if (screen.height < 1280) {
    W = 540; H = 960;
  }
  createCanvas(W, H);
  
  g_animator = new Animator()
  
  g_textbox = createGraphics(width, height);
  g_graph3d = createGraphics(width, height, WEBGL);
  
  g_graph3d.pixelDensity(1) // 强力避免卡顿
  
  //console.log(Mat3.RotationMatrix(new p5.Vector(1,2,3).normalize(), 333))
  //console.log(Mat3.RotationMatrix(new p5.Vector(1,2,3).normalize(), 333).Transpose())
  //console.log(Mat3.RotationMatrix(new p5.Vector(1,2,3).normalize(), 333).Mult(new p5.Vector(3,4,5)))
  
  g_cam = new Camera3()
  g_cam.pos.y = -100
  
  g_box = new Box()
  g_box.pos.x = 0;
  g_box.pos.y = 132.5;
  g_box.pos.z = -200;
  
  g_obj_module1 = loadModel("./module1.obj", false);
  g_obj_module1.bbox = [ 10, 187.5, 30 ];
  g_obj_module2 = loadModel("./module2.obj", false);
  g_obj_module2.bbox = [ 195, 90, 30 ];
  g_obj_module2_simp = loadModel("./module2_simple.obj", false);
  g_obj_module2_simp.bbox = [ 195, 30, 90 ];
  g_obj_module3 = loadModel("./module3.obj", false);
  g_obj_grid = loadModel("./grid.obj", false);
  
  LoadScene()
  
  g_gl = g_graph3d.canvas.getContext("webgl");
}

let gt = 0

let g_last_millis = 0
function draw() {
  const m = millis();
  const delta_millis = m - g_last_millis;
  g_last_millis = m;
  
  // Intersect
  {
    g_highlighted = g_curr_gadget.IntersectWithMouse(g_cam.GetPos(), g_cam.GetPickRay(mouseX, mouseY));
  }
  g_curr_gadget.Update(delta_millis);
  
  g_animator.Update()
  // 在自身坐标系中移动
  {
    g_cam.MoveInLocalSpace(new p5.Vector(g_flags[0] * 2, 0, 0));
    g_cam.MoveInLocalSpace(new p5.Vector(0, g_flags[1] * 2, 0));
    g_cam.MoveInLocalSpace(new p5.Vector(0, 0, g_flags[2] * 2));
  }
  // 绕自身坐标系旋转
  {
    g_cam.RotateAlongLocalAxis(new p5.Vector(1, 0, 0), g_flags[3] * 0.03);
    g_cam.RotateAlongLocalAxis(new p5.Vector(0, 1, 0), g_flags[4] * 0.03);
    g_cam.RotateAlongLocalAxis(new p5.Vector(0, 0, 1), g_flags[5] * 0.03);
  }
  
  // Apply first, then scale(1,-1)
  g_cam.Apply(g_graph3d)
  //g_graph3d.lights();
  
  g_graph3d.scale(1, -1);
  
  g_graph3d.background(33);
  g_graph3d.fill(255);
  g_graph3d.stroke(128);
  
  if (false) {
    g_box.RotateAlongLocalAxis(new p5.Vector(2,3,1).normalize(), delta_millis*0.001)
    const q0 = Mat3ToQuaternion(Mat3.RotationMatrix(new p5.Vector(1,2,3).normalize(), 1.2));
    const q1 = Mat3ToQuaternion(Mat3.RotationMatrix(new p5.Vector(1,2,3).normalize(), 1.5));
    gt = gt + delta_millis / 1000.0
    const ccc = gt - parseInt(gt)
    g_box.orientation = QuaternionToMat3(Quaternion.Slerp(q0, q1, ccc));
    g_box.Render(g_graph3d);
  }
  
  //g_graph3d.box(50, 50, 50);
  g_gadget1.Render(g_graph3d);
  g_gadget2.Render(g_graph3d);
  g_gadget3.Render(g_graph3d);
  
  if (false) {
    g_graph3d.beginShape(LINES);
    g_graph3d.stroke(255, 0, 0); g_graph3d.vertex(0, 0, 0); g_graph3d.vertex(100, 0, 0); // +X
    g_graph3d.endShape();
    g_graph3d.beginShape(LINES);
    g_graph3d.stroke(0, 255, 0); g_graph3d.vertex(0, 0, 0); g_graph3d.vertex(0, 100, 0); // +Y
    g_graph3d.endShape();
    g_graph3d.beginShape(LINES);
    g_graph3d.stroke(0, 0, 255); g_graph3d.vertex(0, 0, 0); g_graph3d.vertex(0, 0, 100); // +Z
    g_graph3d.endShape();
  }
  
  if (false) {
    g_graph3d.translate(10, 122.5, -200);
    g_graph3d.push();
    g_graph3d.noStroke();
    g_graph3d.lights();
    let locX = mouseX - width / 2;
    let locY = mouseY - height / 2;
    g_graph3d.pointLight(250, 250, 250, locX, locY, 50);
    g_graph3d.model(g_teapot);
    g_graph3d.pop();
  }
  
  // Grid on the ground
  DrawGrid(g_cam.pos.x, g_cam.pos.z, 50, g_graph3d)
  
  g_graph3d.stroke(0);
  
  g_graph3d.resetMatrix();
  g_graph3d.camera();

  
  image(g_graph3d, 0, 0)
  
  textFont("Source Code Pro");
  noStroke()
  fill(255)
  textAlign(LEFT, TOP);
  
  /*
  let t = g_cam.GetStatusString()
  text(t, 2, 8)
  */
}

function keyPressed() {
  // WSADQE: 移动
  // FHTGRY：旋转g
  if      (key == 'w') g_flags[2] = -1; // 前进(-Z)
  else if (key == 's') g_flags[2] =  1; // 后退(+Z)
  else if (key == 'a') g_flags[0] = -1; // 向左(-X)
  else if (key == 'd') g_flags[0] =  1; // 向右(+X)
  else if (key == 'q') g_flags[1] =  1; // 向下(+Y)
  else if (key == 'e') g_flags[1] = -1; // 向上(-Y)
  else if (key == 't') g_flags[3] = -1; // 朝上看
  else if (key == 'g') g_flags[3] =  1; // 朝下看
  else if (key == 'f') g_flags[4] =  1; // 朝左看
  else if (key == 'h') g_flags[4] = -1; // 朝右看
  else if (key == 'r') g_flags[5] = -1; // 把头偏向左边(绕自身+Z逆时针旋转)
  else if (key == 'y') g_flags[5] =  1; // 朝头偏向右边(绕自身+Z顺时针旋转)
  else if (key == ' ') g_flags[6] =  1
}

function keyReleased() {
  if      (key == 'w' || key == 's') { g_flags[2] = 0; }
  else if (key == 'a' || key == 'd') { g_flags[0] = 0; }
  else if (key == 'q' || key == 'e') { g_flags[1] = 0; }
  else if (key == 't' || key == 'g') { g_flags[3] = 0; }
  else if (key == 'f' || key == 'h') { g_flags[4] = 0; }
  else if (key == 'r' || key == 'y') { g_flags[5] = 0; }
  else if (key == ' ') { g_flags[6] = 0; }
}

function mouseMoved() {
  if (g_highlighted != null) {
    g_highlighted.OnHover();
  }
}

function mouseClicked(event) {
  //console.log(event)
  if (g_highlighted != null) {
    g_highlighted.OnClick();
  }
}