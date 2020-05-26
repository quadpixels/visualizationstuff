const Scene0 = [
  {
    gadget_name: "gadget1",
    pos: [ 0, 0, 0 ],
    shapes: [
      {
        shape: "box",
        pos:   [ -20, 20, 0 ],
        size:  [ 10, 10, 20 ],
      },
      {
        shape: "box",
        pos:   [ 0, 20, 0 ],
        size:  [ 10, 10, 20 ],
      }
    ]
  }
]

const CAM_POS_1        = [ 0,    128,  240 ];
const BILLBOARD_POS_1  = [ 0,    220, -100 ];
const MODULE_POS_1_END = [ 10, 132.5, -200 ];

const CAM_POS_2          = [ 475, 128,  800 ];
const MODULE_POS_2_START = [ 400, 50,  -200 ];
const MODULE_POS_2_END   = [ 475, 250, -200 ];

const BILLBOARD_POS_2 = [ 475, 600, -200 ];

const CAM_POS_3 = [ 2150, 600, 2500 ];
const MODULE_POS_3_START = [ 1400, -150, -200 ];
const MODULE_POS_3_END   = [ 2150, 700, -200 ];

let g_scene1 = {
  watt_hours: 0,
  num_cells:  0,
  num_cells_remaining: 0,
  scene:      undefined,
  module1:    undefined,
  billboard:  undefined,
  OnSceneEnd: function() {
    this.scene.shapes.forEach(function(x) {
      const xcn = x.constructor.name;
      if (xcn == "Box") { x.visible = false; }
      else if (xcn == "ObjModel") { x.visible = true; }
    });
    
    this.module1.update = function(delta_millis) {
      g_scene1.module1.RotateAlongLocalAxis(new p5.Vector(0,1,0),
        delta_millis * 0.001);
    }
    
    this.billboard.SetText("这是一个\nModule");
    
    console.log("scene 1 end");
    
    //this.GotoNextScene();
  },
  OnBatteryUpdate: function() {
    if (this.num_cells_remaining == 0) {
      this.OnSceneEnd();
    }
  },
  
  GotoNextScene: function() {
    g_animator.Animate(this.module1, "pos", "x", [MODULE_POS_1_END[0], MODULE_POS_2_START[0]], [0, 2000],
      function(x) { g_scene1.module1.visible = false; });
    g_animator.Animate(this.module1, "pos", "y", [MODULE_POS_1_END[1], MODULE_POS_2_START[1]], [0, 2000]);
    g_animator.Animate(this.module1, "orientation", undefined,
      [g_scene1.module1.orientation, new Mat3()], [0, 1000],
      function() { g_scene1.module1.update = undefined; } );
    g_animator.AnimateCamera(g_cam, "pos",  "x", [CAM_POS_1[0],  CAM_POS_2[0]], [0, 2000]);
    g_animator.AnimateCamera(g_cam, "pos",  "y", [CAM_POS_1[1],  CAM_POS_2[1]], [0, 2000]);
    g_animator.AnimateCamera(g_cam, "pos",  "z", [CAM_POS_1[2],  CAM_POS_2[2]], [0, 2000]);
    g_curr_gadget = g_gadget2;
  }
}

function LoadScene1() {
  g_gadget1 = new Gadget();
  g_scene1.scene = g_gadget1;
  
  // cells
  let billboard = new Billboard();
  billboard.SetText("点击组装电池");
  billboard.pos.x = BILLBOARD_POS_1[0];
  billboard.pos.y = BILLBOARD_POS_1[1];
  billboard.pos.z = BILLBOARD_POS_2[2];
  g_scene1.billboard = billboard;
  
  const X0LB = -70, X0UB = 70, X0DELTA = 14;
  let x0 = X0LB; y0 = -25; z0 = -10;
  let i = 0;
  
  // Battery --> Module1
  
  let cb = function() {
    g_scene1.watt_hours += 12.2;
    g_scene1.num_cells_remaining --;
    billboard.SetText(g_scene1.watt_hours.toFixed(2) + " Wh\n"
                    + g_scene1.num_cells + " cells")
    g_scene1.OnBatteryUpdate();
  }
  
  for (let x=-150; x<=210; x+=10) {
    for (let y=-5; y<=5; y+=10) {
      let b = new Box()
      g_scene1.num_cells   += 1;
      g_scene1.num_cells_remaining ++;
      
      const tx = y, ty = x+100+y/2, tz = -200;
      
      b.pos.x = x0; b.pos.y = y0; b.pos.z = z0;
      b.onhover = function(x) {
        if (x.scene1_flag == true) { return; }
        else {
          x.scene1_flag = true;
          g_animator.Animate(x, "pos", "x", [x.pos.x, tx], [0, 500], cb);
          g_animator.Animate(x, "pos", "y", [x.pos.y, ty], [0, 500]);
          g_animator.Animate(x, "pos", "z", [x.pos.z, tz], [0, 500]);
          g_animator.Animate(x, "orientation", null, [x.orientation, 
            Mat3.RotationMatrix(new p5.Vector(0,1,0),0)], [0, 500]);
        }
      }
      b.RotateAlongLocalAxis(new p5.Vector(1,0,0).normalize(), PI/2);
      
      b.update = function(x, delta_millis) {
        //x.RotateAlongGlobalAxis(new p5.Vector(0,1,0), delta_millis*0.001);
      }
      
      x0 = x0 + X0DELTA;
      if (x0 > X0UB) {
        x0 = X0LB; z0 -= 10;
      }
      i++;
      b.hw = 5; b.hh = 5;
      g_gadget1.shapes.push(b)
    }
  }
  
  let module1 = new ObjModel(g_obj_module1);
  module1.pos.x = 0;
  module1.pos.y = 132.5;
  module1.pos.z = -200;
  module1.visible = false;
  g_gadget1.shapes.push(module1);
  g_scene1.module1 = module1;
  
  g_gadget1.shapes.push(billboard);
  
  const cp = g_cam.pos;
  /*
  g_animator.AnimateCamera(g_cam, "pos", "x", [cp.x, CAM_POS_1[0]], [0, 2000])
  g_animator.AnimateCamera(g_cam, "pos", "y", [0,    CAM_POS_1[1]], [0, 2000])
  g_animator.AnimateCamera(g_cam, "pos", "z", [0,    CAM_POS_1[2]],  [0, 2000])
  */
  
  g_curr_gadget = g_gadget1;
}

let g_scene2 = { 
  num_modules: 0,
  num_modules_remaining: 0,
  watt_hours: 0,
  module2: undefined,
  OnModuleUpdate: function() {
    this.num_modules_remaining --;
    this.num_modules ++;
    
    this.watt_hours += 12.2 * 74;
    this.billboard.SetText(
      (g_scene2.watt_hours/1000).toFixed(2) + " KWh\n" +
      g_scene2.num_modules + " rows");
    
    if (this.num_modules_remaining <= 0) {
      this.OnSceneEnd();
    }
  },
  
  OnSceneEnd: function() {
    this.module2.update = function(delta_millis) {
      g_scene2.module2.RotateAlongLocalAxis(new p5.Vector(0,1,0),
        delta_millis * 0.001);
    }
    g_gadget2.shapes.forEach(function(s) {
      if (s.constructor.name == "ObjModel" && s.obj == g_obj_module1) {
        s.visible = false;
      }
    })
    g_scene2.module2.visible = true;
    console.log("scene 2 done");
  },
  
  GotoNextScene: function() {
    g_animator.Animate(this.module2, "pos", "x", [MODULE_POS_2_END[0], MODULE_POS_3_START[0]], [0, 2000],
      function(x) { g_scene1.module1.visible = false; });
    g_animator.Animate(this.module2, "pos", "y", [MODULE_POS_2_END[1], MODULE_POS_3_START[1]], [0, 2000]);
    g_animator.Animate(this.module2, "pos", "z", [MODULE_POS_2_END[2], MODULE_POS_3_START[2]], [0, 2000]);
    g_animator.Animate(this.module2, "orientation", undefined,
      [g_scene2.module2.orientation, Mat3.Mult(
            Mat3.RotationMatrix(new p5.Vector(1,0,0), PI/2),
            Mat3.RotationMatrix(new p5.Vector(0,1,0), PI/2) // 注意：是Local叠加
          )
      ], [0, 1000],
      function() { g_scene2.module2.update = undefined; } );
    g_animator.AnimateCamera(g_cam, "pos",  "x", [CAM_POS_2[0],  CAM_POS_3[0]], [0, 2000]);
    g_animator.AnimateCamera(g_cam, "pos",  "y", [CAM_POS_2[1],  CAM_POS_3[1]], [0, 2000]);
    g_animator.AnimateCamera(g_cam, "pos",  "z", [CAM_POS_2[2],  CAM_POS_3[2]], [0, 2000]);
    g_curr_gadget = g_gadget3;
  }
}

function LoadScene2() {
  g_gadget2 = new Gadget();
  
  const center_x = MODULE_POS_2_START[0] + 30 * 2.5;
  g_scene2.num_modules = 0;
  
  let cb = function() {
    g_scene2.OnModuleUpdate();
  }
  
  for (let i=0; i<6; i++) {
    let module1 = new ObjModel(g_obj_module1);
    module1.pos.x = MODULE_POS_2_START[0] + 30 * i;
    module1.pos.y = MODULE_POS_2_START[1];
    module1.pos.z = MODULE_POS_2_START[2];
    
    const ty = MODULE_POS_2_END[1] + 30 * i;
    
    module1.onclick = function(x) {
      if (x.scene2_flag == true) { return; }
      else {
        x.scene2_flag = true;
        g_animator.Animate(x, "pos", "x", [x.pos.x, MODULE_POS_2_END[0]], [0, 500], cb);
        g_animator.Animate(x, "pos", "y", [x.pos.y, ty], [0, 500]);
        g_animator.Animate(x, "pos", "z", [x.pos.z, MODULE_POS_2_END[2]], [0, 500]);
        g_animator.Animate(x, "orientation", undefined, [
          x.orientation, Mat3.RotationMatrix(new p5.Vector(0,0,1), PI/2)], [0, 500]);
      }
    }
    g_gadget2.shapes.push(module1);
    g_scene2.num_modules_remaining ++;
  }
  
  // Destination
  let module2 = new ObjModel(g_obj_module2);
  module2.pos.x = MODULE_POS_2_END[0];
  module2.pos.y = MODULE_POS_2_END[1] + 30 * 2.5;
  module2.pos.z = MODULE_POS_2_END[2];
  g_gadget2.shapes.push(module2);
  
  // cells
  let billboard = new Billboard();
  billboard.SetText("5.2 KWh\nModule");
  billboard.pos.x = MODULE_POS_2_START[0] + 30 * 2.5;
  billboard.pos.y = BILLBOARD_POS_2[1];
  billboard.pos.z = MODULE_POS_2_START[2];
  billboard.scale = new p5.Vector(3, 3, 3);
  g_scene2.billboard = billboard;
  module2.visible = false;
  g_scene2.module2 = module2;
  g_gadget2.shapes.push(billboard);
  
  // For DBG
  //g_cam.pos.x = 400
}

function LoadScene() {
  LoadScene1();
  LoadScene2();
  LoadScene3();
}

let g_scene3 = {
  num_modules: 0,
  num_modules_remaining: 0,
  watt_hours: 0,
  module3: undefined,
  billboard: undefined,
  OnModuleUpdate: function() {
    this.num_modules_remaining --;
    if (this.num_modules_remaining <= 0) {
      this.module3.visible = true;
      this.module3.update = function(delta_millis) {
        g_scene3.module3.RotateAlongGlobalAxis(new p5.Vector(0,1,0),
          delta_millis * 0.001);
      }
      
      g_gadget3.shapes.forEach(function(s) {
        if (s.constructor.name == "ObjModel" && s.obj == g_obj_module2_simp) {
          s.visible = false;
        }
      })
      g_scene3.module3.visible = true;
      console.log("scene 3 done");
    }
  },
  
  ShowEnding() {
    console.log("Ending")
  }
};

function LoadScene3() {
  g_gadget3 = new Gadget();
  
  const tdeltas = [
    [-200, -665, 0], [200, -665, 0],
    [-200, -475, 0], [200, -475, 0],
    [-200, -285, 0], [200, -285, 0],
    [-200, -95, 0], [200,  -95, 0],
    [-200, 95, 0], [200,    95, 0],
    [-200, 285, 0], [200,  285, 0],
    [-200, 475, 0], [200,  475, 0],
    [   0, 665, 0], [  0,  665, 80],
  ];
  
  const cb = function() {
    g_scene3.OnModuleUpdate();
  }
  
  for (let i=0; i<16; i++) {
    let module2 = new ObjModel(g_obj_module2_simp);
    module2.pos.x = MODULE_POS_3_START[0] + 100 * i;
    module2.pos.y = MODULE_POS_3_START[1];
    module2.pos.z = MODULE_POS_3_START[2];
    module2.RotateAlongGlobalAxis(new p5.Vector(0,0,1),PI/2)
    //module2.RotateAlongGlobalAxis(new p5.Vector(1,0,0),PI/2)
    g_gadget3.shapes.push(module2);
    
    const tx = MODULE_POS_3_END[0] + tdeltas[i][1];
    const ty = MODULE_POS_3_END[1] + tdeltas[i][0];
    const tz = MODULE_POS_3_END[2] + tdeltas[i][2];
    module2.onclick = function(x) {
      if (x.scene3_flag == true) { return; }
      else {
        x.scene3_flag = true;
        g_animator.Animate(x, "pos", "x", [x.pos.x, tx], [0, 500], cb);
        g_animator.Animate(x, "pos", "y", [x.pos.y, ty], [0, 500]);
        g_animator.Animate(x, "pos", "z", [x.pos.z, tz], [0, 500]);
        g_animator.Animate(x, "orientation", undefined, [
          x.orientation, 
          Mat3.Mult(
            Mat3.RotationMatrix(new p5.Vector(1,0,0), PI/2),
            Mat3.RotationMatrix(new p5.Vector(0,1,0), PI/2) // 注意：是Local叠加
          )], [0, 500]);
      }
    }
    
    g_scene3.num_modules_remaining ++;
  }
  
  // Billboard
  let billboard = new Billboard();
  billboard.SetText("Battery Pack");
  billboard.pos.x = MODULE_POS_3_END[0];
  billboard.pos.y = MODULE_POS_3_END[1] + 800;
  billboard.pos.z = MODULE_POS_3_END[2];
  billboard.scale = new p5.Vector(6, 6, 6);
  g_gadget3.shapes.push(billboard);
  g_scene3.billboard = billboard;
  
  // entire battery pack
  let module3 = new ObjModel(g_obj_module3);
  module3.pos.x = MODULE_POS_3_END[0];
  module3.pos.y = MODULE_POS_3_END[1];
  module3.pos.z = MODULE_POS_3_END[2];
  module3.RotateAlongGlobalAxis(new p5.Vector(1,0,0), PI/2);
  module3.RotateAlongGlobalAxis(new p5.Vector(0,0,1),-PI/2);
  module3.visible = false;
  g_gadget3.shapes.push(module3);
  g_scene3.module3 = module3;
}


// For testing
function Done1() {
  g_gadget1.shapes.forEach(function(x) {
    if (x.constructor.name == "Box") x.OnClick();
  });
}

function Goto2() {
  g_scene1.GotoNextScene();
}

function JumpTo2() {
  g_cam.pos.x =  CAM_POS_2[0];
  g_cam.pos.y = -CAM_POS_2[1];
  g_cam.pos.z =  CAM_POS_2[2];
  g_curr_gadget = g_gadget2;
}

function Done2() {
  g_gadget2.shapes.forEach(function(x) {
    x.OnClick();
  });
}

function Goto3() {
  g_scene2.GotoNextScene();
}

function JumpTo3() {
  g_cam.pos.x =  CAM_POS_3[0];
  g_cam.pos.y = -CAM_POS_3[1];
  g_cam.pos.z =  CAM_POS_3[2];
  g_curr_gadget = g_gadget3;
}