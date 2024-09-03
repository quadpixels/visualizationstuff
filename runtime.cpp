#include <stdio.h>
#include <emscripten.h>

extern "C" void MyEmFunc() {
  EM_ASM({
    console.log("[MyEmFunc]");
  });
}

extern "C" void UpdateArrayA(int idx, int value) {
  EM_ASM({
    UpdateArrayA($0, $1);
  }, idx, value);
}

extern "C" void UpdateArrayB(int r, int c, int value) {
  EM_ASM({
    UpdateArrayB($0, $1, $2);
  }, r, c, value);
}