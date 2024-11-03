#EMINC="/opt/homebrew/Cellar/emscripten/3.1.56/libexec/cache/sysroot/include/"
EMINC="$HOME/Downloads/emsdk/upstream/emscripten/cache/sysroot/include/"

LLVM_DIR="/usr"

source $HOME/Downloads/emsdk/emsdk_env.sh

$LLVM_DIR/bin/clang++-18 -I$EMINC -O0 -g -emit-llvm --target=wasm32 -c ./convert1darrayto2d.cpp -o convert1darrayto2d.bc
$LLVM_DIR/bin/opt-18 -load-pass-plugin ./llvm_pass/build/libInjectFuncCall.so --passes='inject-func-call' --target-abi=wasm32 convert1darrayto2d.bc -o instrumented.bc
$LLVM_DIR/bin/llvm-dis-18 instrumented.bc
em++ -O0 -sMODULARIZE -sEXPORTED_FUNCTIONS=_MyEmFunc,_main -sEXPORTED_RUNTIME_METHODS=ccall,cwrap -s WASM=0 instrumented.bc runtime.cpp -o a.out.js

$LLVM_DIR/bin/clang++-18 -I$EMINC -O0 -g -emit-llvm --target=wasm32 -c ./quicksort.cpp -o quicksort.bc
$LLVM_DIR/bin/opt-18 -load-pass-plugin ./llvm_pass/build/libInjectFuncCall.so --passes='inject-func-call' --target-abi=wasm32 quicksort.bc -o instrumented.bc
$LLVM_DIR/bin/llvm-dis-18 instrumented.bc
em++ -O0 -sMODULARIZE -sEXPORTED_FUNCTIONS=_MyEmFunc,_main -sEXPORTED_RUNTIME_METHODS=ccall,cwrap -sEXPORTED_FUNCTIONS=_DoIt -s WASM=0 instrumented.bc runtime.cpp -o b.out.js