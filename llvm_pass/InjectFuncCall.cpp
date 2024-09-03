//========================================================================
// FILE:
//    InjectFuncCall.cpp
//
// DESCRIPTION:
//    For each function defined in the input IR module, InjectFuncCall inserts
//    a call to printf (from the C standard I/O library). The injected IR code
//    corresponds to the following function call in ANSI C:
//    ```C
//      printf("(llvm-tutor) Hello from: %s\n(llvm-tutor)   number of arguments: %d\n",
//             FuncName, FuncNumArgs);
//    ```
//    This code is inserted at the beginning of each function, i.e. before any
//    other instruction is executed.
//
//    To illustrate, for `void foo(int a, int b, int c)`, the code added by InjectFuncCall
//    will generated the following output at runtime:
//    ```
//    (llvm-tutor) Hello World from: foo
//    (llvm-tutor)   number of arguments: 3
//    ```
//
// USAGE:
//      $ opt -load-pass-plugin <BUILD_DIR>/lib/libInjectFunctCall.so `\`
//        -passes=-"inject-func-call" <bitcode-file>
//
// License: MIT
//========================================================================

/*

My usage

cd ~/Downloads/llvm-tutor/build
make
/opt/homebrew/opt/llvm/bin/clang -O0 -g -emit-llvm -c ../inputs/input_for_hello.c -o input_for_hello.bc
/opt/homebrew/opt/llvm/bin/opt -load-pass-plugin ./libInjectFuncCall.dylib --passes='inject-func-call' input_for_hello.bc -o instrumented.bin

*/


#include "InjectFuncCall.h"

#include "llvm/IR/IRBuilder.h"
#include "llvm/Passes/PassPlugin.h"
#include "llvm/Passes/PassBuilder.h"
#include "llvm/IR/Instructions.h"

using namespace llvm;

#define DEBUG_TYPE "inject-func-call"

#include <unordered_map>

//-----------------------------------------------------------------------------
// InjectFuncCall implementation
//-----------------------------------------------------------------------------
bool InjectFuncCall::runOnModule(Module &M) {
  bool InsertedAtLeastOnePrintf = false;

  auto &CTX = M.getContext();
  PointerType *PrintfArgTy = PointerType::getUnqual(Type::getInt8Ty(CTX));

  // STEP 1: Inject the declaration of printf
  // ----------------------------------------
  // Create (or _get_ in cases where it's already available) the following
  // declaration in the IR module:
  //    declare i32 @printf(i8*, ...)
  // It corresponds to the following C declaration:
  //    int printf(char *, ...)
  FunctionType *PrintfTy = FunctionType::get(
      IntegerType::getInt32Ty(CTX),
      PrintfArgTy,
      /*IsVarArgs=*/true);

  FunctionCallee Printf = M.getOrInsertFunction("printf", PrintfTy);

  // Set attributes as per inferLibFuncAttributes in BuildLibCalls.cpp
  Function *PrintfF = dyn_cast<Function>(Printf.getCallee());
  PrintfF->setDoesNotThrow();
  PrintfF->addParamAttr(0, Attribute::NoCapture);
  PrintfF->addParamAttr(0, Attribute::ReadOnly);

  // Inject the declaration of our EmScripten run-time funcs
  FunctionType *MyEmFuncTy = FunctionType::get(
    Type::getVoidTy(CTX),
    {},
    false
  );
  FunctionCallee MyEmFunc = M.getOrInsertFunction("MyEmFunc", MyEmFuncTy);

  FunctionType* UpdateArrayATy = FunctionType::get(
      Type::getVoidTy(CTX),
      {
        IntegerType::getInt32Ty(CTX),
        IntegerType::getInt32Ty(CTX)
      },
      false
  );
  FunctionCallee UpdateArrayA = M.getOrInsertFunction("UpdateArrayA", UpdateArrayATy);

  FunctionType* UpdateArrayBTy = FunctionType::get(
      Type::getVoidTy(CTX),
      {
        IntegerType::getInt32Ty(CTX),
        IntegerType::getInt32Ty(CTX),
        IntegerType::getInt32Ty(CTX)
      },
      false
  );
  FunctionCallee UpdateArrayB = M.getOrInsertFunction("UpdateArrayB", UpdateArrayBTy);

  // STEP 2: Inject a global variable that will hold the printf format string
  // ------------------------------------------------------------------------
  llvm::Constant *PrintfFormatStr = llvm::ConstantDataArray::getString(
      CTX, "(llvm-tutor) Hello from: %s\n(llvm-tutor)   number of arguments: %d\n");

  Constant *PrintfFormatStrVar =
      M.getOrInsertGlobal("PrintfFormatStr", PrintfFormatStr->getType());
  dyn_cast<GlobalVariable>(PrintfFormatStrVar)->setInitializer(PrintfFormatStr);

  Constant* WriteVarFormatStr = llvm::ConstantDataArray::getString(
      CTX, "[llvm-tutor] Write local variable %s, value %d\n");
  Constant *WriteVarFormatStrVar =
      M.getOrInsertGlobal("WriteVarFormatStr", WriteVarFormatStr->getType());
  dyn_cast<GlobalVariable>(WriteVarFormatStrVar)->setInitializer(WriteVarFormatStr);

  Constant* WriteArrayFormatStr = llvm::ConstantDataArray::getString(
      CTX, "[llvm-tutor] Write local 1d array %s, offset %d, value %d\n");
  Constant *WriteArrayFormatStrVar =
      M.getOrInsertGlobal("WriteArrayFormatStr", WriteArrayFormatStr->getType());
  dyn_cast<GlobalVariable>(WriteArrayFormatStrVar)->setInitializer(WriteArrayFormatStr);

  Constant* Write2DArrayFormatStr = llvm::ConstantDataArray::getString(
      CTX, "[llvm-tutor] Write local 2d array %s, offset %d,%d, value %d\n");
  Constant *Write2DArrayFormatStrVar =
      M.getOrInsertGlobal("Write2DArrayFormatStr", Write2DArrayFormatStr->getType());
  dyn_cast<GlobalVariable>(Write2DArrayFormatStrVar)->setInitializer(Write2DArrayFormatStr);

  // STEP 3: For each function in the module, inject a call to printf
  // ----------------------------------------------------------------
  for (auto &F : M) {
    if (F.isDeclaration())
      continue;

    std::unordered_map<AllocaInst*, StringRef> alloca_to_varname_map;

    for (auto& BB : F) {
        errs() << "Func: " << F.getName() << "\n";
        for (auto &I : BB) {
            if (auto* dbgDeclare = dyn_cast<DbgDeclareInst>(&I)) {
                if (auto* ai = dyn_cast<AllocaInst>(dbgDeclare->getAddress())) {
                    if (const auto& dv = dbgDeclare->getVariable()) {
                        errs() << "Local var: " << dv->getName() << "(" << *ai << ")\n";
                        alloca_to_varname_map[ai] = dv->getName();
                    }
                }
            }
        }
    }
    for (auto& BB : F) {
        for (auto& I : BB) {
            if (auto* SI = dyn_cast<StoreInst>(&I)) {
                errs() << "PointerOp " << (*(SI->getPointerOperand())) << "\n";
                if (auto* gep = dyn_cast<GetElementPtrInst>(SI->getPointerOperand())) {
                    Value* ptr = gep->getPointerOperand();

                    if (auto* ai = dyn_cast<AllocaInst>(ptr)) {
                        auto it = alloca_to_varname_map.find(ai);
                        if (it != alloca_to_varname_map.end()) {
                            errs() << "Write local array: " << it->second << " at instr: "
                                   << I << ", indices:";
                            errs() << *(gep->getOperand(2)) << " ";
                            errs() << "\n";

                            IRBuilder<> B(&I);
                            llvm::Constant* zero = llvm::ConstantInt::get(llvm::Type::getInt32Ty(CTX), 0);
                            llvm::Value *format_str_ptr =
                                B.CreateGEP(
                                    dyn_cast<GlobalVariable>(WriteArrayFormatStrVar)->getValueType(),
                                    dyn_cast<GlobalVariable>(WriteArrayFormatStrVar),
                                    {zero, zero},
                                    "formatStr");
                            auto VarName = B.CreateGlobalStringPtr(it->second);
                            B.CreateCall(
                                Printf, {format_str_ptr, VarName, gep->getOperand(2), SI->getValueOperand()});
                            if (std::string(it->second) == "a") {
                                B.CreateCall(UpdateArrayA, { gep->getOperand(2), SI->getValueOperand() });
                            }
                        }
                    } else if (auto* gep2 = dyn_cast<GetElementPtrInst>(ptr)) {
                        ptr = gep2->getPointerOperand();
                        errs() << "GEP2 " << *ptr << "\n";
                        if (auto* ai = dyn_cast<AllocaInst>(ptr)) {
                            auto it = alloca_to_varname_map.find(ai);
                            if (it != alloca_to_varname_map.end()) {
                                errs() << "Write local 2d array: " << it->second << " at instr: "
                                    << I << ", indices: ";
                                errs() << *(gep2->getOperand(2)) << ", " << *(gep->getOperand(2));
                                errs() << "\n";

                                llvm::Constant* zero = llvm::ConstantInt::get(llvm::Type::getInt32Ty(CTX), 0);
                                

                                IRBuilder<> B(&I);
                                llvm::Value *format_str_ptr =
                                    B.CreateGEP(
                                        dyn_cast<GlobalVariable>(Write2DArrayFormatStrVar)->getValueType(),
                                        dyn_cast<GlobalVariable>(Write2DArrayFormatStrVar),
                                        {zero, zero},
                                        "formatStrPtr");
                                auto VarName = B.CreateGlobalStringPtr(it->second);
                                B.CreateCall(
                                    Printf, {format_str_ptr, VarName, gep2->getOperand(2), gep->getOperand(2), SI->getValueOperand()});
                                if (std::string(it->second) == "b") {
                                    B.CreateCall(UpdateArrayB, { gep2->getOperand(2), gep->getOperand(2), SI->getValueOperand() });
                                }
                            }
                        }
                    }
                } else if (auto* ptr = dyn_cast<AllocaInst>(SI->getPointerOperand())) {
                    auto it = alloca_to_varname_map.find(ptr);
                    if (it != alloca_to_varname_map.end()) {
                        errs() << "Write to local var: " << it->second << " at instr: " << I
                               << ", value operand: " << *(SI->getValueOperand()) << "\n";
                        IRBuilder<> B(&I);
                        llvm::Value *format_str_ptr =
                            B.CreatePointerCast(WriteVarFormatStrVar, PrintfArgTy, "formatStr");
                        auto VarName = B.CreateGlobalStringPtr(it->second);
                        //auto b32 = B.getInt32(SI->getValueOperand());
                        B.CreateCall(
                            Printf, {format_str_ptr, VarName, SI->getValueOperand()});
                    }
                }
            }
        }
    }

    // Get an IR builder. Sets the insertion point to the top of the function
    IRBuilder<> Builder(&*F.getEntryBlock().getFirstInsertionPt());

    // Inject a global variable that contains the function name
    auto FuncName = Builder.CreateGlobalStringPtr(F.getName());

    // Printf requires i8*, but PrintfFormatStrVar is an array: [n x i8]. Add
    // a cast: [n x i8] -> i8*
    llvm::Value *FormatStrPtr =
        Builder.CreatePointerCast(PrintfFormatStrVar, PrintfArgTy, "formatStr");

    // The following is visible only if you pass -debug on the command line
    // *and* you have an assert build.
    LLVM_DEBUG(dbgs() << " Injecting call to printf inside " << F.getName()
                      << "\n");

    // Finally, inject a call to printf
    Builder.CreateCall(
        Printf, {FormatStrPtr, FuncName, Builder.getInt32(F.arg_size())});
    Builder.CreateCall(
        MyEmFunc, {});

    InsertedAtLeastOnePrintf = true;
  }

  return InsertedAtLeastOnePrintf;
}

PreservedAnalyses InjectFuncCall::run(llvm::Module &M,
                                       llvm::ModuleAnalysisManager &) {
  bool Changed =  runOnModule(M);

  return (Changed ? llvm::PreservedAnalyses::none()
                  : llvm::PreservedAnalyses::all());
}


//-----------------------------------------------------------------------------
// New PM Registration
//-----------------------------------------------------------------------------
llvm::PassPluginLibraryInfo getInjectFuncCallPluginInfo() {
  return {LLVM_PLUGIN_API_VERSION, "inject-func-call", LLVM_VERSION_STRING,
          [](PassBuilder &PB) {
            PB.registerPipelineParsingCallback(
                [](StringRef Name, ModulePassManager &MPM,
                   ArrayRef<PassBuilder::PipelineElement>) {
                  if (Name == "inject-func-call") {
                    MPM.addPass(InjectFuncCall());
                    return true;
                  }
                  return false;
                });
          }};
}

extern "C" LLVM_ATTRIBUTE_WEAK ::llvm::PassPluginLibraryInfo
llvmGetPassPluginInfo() {
  return getInjectFuncCallPluginInfo();
}