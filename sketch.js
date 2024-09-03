// 2024-09-02

let g_frame_count = 0;

class ArrayViz {
  constructor(m, n) {
    this.elts = Array(m);
    for (let i=0; i<m; i++) { this.elts[i] = Array(n); }
    this.x = 8;
    this.y = 8;
    this.nrows = m;
    this.ncols = n;
  }

  Render() {
    const L = 16;
    push();
    noFill(); stroke(224);
    translate(this.x, this.y);
    for (let i=0; i<=this.ncols; i++) {
      const dx = i*L;
      line(dx, 0, dx, L*this.nrows);
    }
    for (let i=0; i<=this.nrows; i++) {
      const dy = i*L;
      line(0, dy, L*this.ncols, dy);
    }
    noStroke(); fill(255, 255, 0);
    textAlign(CENTER, CENTER);
    let idx = 0;
    for (let r=0; r<this.nrows; r++) {
      for (let c=0; c<this.ncols; c++) {
        const dx = L*(c+0.5), dy = L*(r+0.5);
        const e = this.elts[r][c];
        if (e != undefined) {
          text("" + e, dx, dy); 
        }
      }
    }
    pop();
  }
}

async function f() {
  g_module = await Module();
}

let g_a;
let g_b;

function setup() {
  createCanvas(400, 400);
  g_a = new ArrayViz(1, 6);
  g_b = new ArrayViz(2, 3);
  g_a.x = 8; g_a.y = 32;
  g_b.x = 8; g_b.y = 80;
  f();
}

function draw() {
  background(32);
  push();
  noStroke();
  textAlign(LEFT, TOP);
  fill(255, 255, 0);
  //text(g_frame_count + "", 16, 16);
  g_frame_count ++;

  g_a.Render();
  g_b.Render();

  pop();
}

function UpdateArrayA(idx, val) {
  console.log("A " + idx + " " + val);
  g_a.elts[0][idx] = val;
}

function UpdateArrayB(r, c, val) {
  console.log("B " + r + " " + c + " " + val);
  g_b.elts[r][c] = val;
}