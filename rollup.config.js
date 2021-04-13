import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

export default [
  {
    input: "src/index.ts",
    output: {
      dir: "lib",
      format: "es",
    },
    plugins: [
      resolve({ extensions: [".js", ".ts"] }),
      typescript({ declaration: true, declarationDir: "lib", rootDir: "." }),
    ],
  },
  {
    input: "src/index.ts",
    output: {
      dir: "dist",
      name: "ApngHandler",
      format: "iife",
      plugins: [terser()],
    },
    plugins: [resolve({ extensions: [".js", ".ts"] }), typescript()],
  },
];
