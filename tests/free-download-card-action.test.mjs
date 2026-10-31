import assert from "node:assert/strict";
import { Module, createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { jsx } from "react/jsx-runtime";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../components/product/FreeDownloadAction.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;

let state;
let hookIndex;
let tasks;
let result;
let checkoutCalls;
let navigation;
const reactStub = {
  useState(initial) {
    const index = hookIndex++;
    if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
    return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
  },
  useTransition() { return [false, (callback) => { tasks.push(Promise.resolve(callback())); }]; },
};
const stubs = {
  react: reactStub,
  "next/navigation": { useRouter: () => ({ push: (path) => navigation.push(path) }) },
  "@/app/checkout/free/actions": { startFreeCheckout: async (...args) => { checkoutCalls.push(args); return result; } },
  "@/components/ui": { Icon: ({ name }) => jsx("svg", { "data-icon": name, "aria-hidden": true }) },
  "./ProductCard.module.css": { default: new Proxy({}, { get: (_target, key) => String(key) }) },
};
const actionModule = new Module("free-download-card-action-test");
actionModule.require = (name) => stubs[name] ?? require(name);
actionModule._compile(compiled, "free-download-card-action-test.cjs");
const { FreeDownloadAction } = actionModule.exports;

function reset(nextResult = { url: "/checkout/free/session" }) {
  state = [];
  hookIndex = 0;
  tasks = [];
  result = nextResult;
  checkoutCalls = [];
  navigation = [];
}

function render(props) {
  hookIndex = 0;
  return FreeDownloadAction(props);
}

test("free product action starts the existing default-variation checkout and does not claim direct download", async () => {
  reset();
  const product = {
    slug: "free-art", title: "Free Art",
    priceOptions: [
      { id: 5, name: "Basic", price: { amount: 0, currency: "INR" }, isDefault: false },
      { id: 19, name: "Standard", price: { amount: 0, currency: "INR" }, isDefault: true },
    ],
  };
  let tree = render(product);
  const button = tree.props.children[0];
  assert.equal(button.type, "button");
  assert.equal(button.props["aria-label"], "Download Free Art");
  assert.equal(button.props.title, "Download");
  assert.equal(button.props.children.props.name, "download");
  assert.equal(button.props.children.props.size, 18);
  let prevented = false;
  let stopped = false;
  button.props.onClick({ preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  await Promise.all(tasks);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.deepEqual(checkoutCalls, [["free-art", 19]]);
  assert.deepEqual(navigation, ["/checkout/free/session"]);

  reset();
  tree = render({ slug: "fixed-free", title: "Fixed Free" });
  tree.props.children[0].props.onClick({ preventDefault() {}, stopPropagation() {} });
  await Promise.all(tasks);
  assert.deepEqual(checkoutCalls, [["fixed-free", null]]);
});

test("checkout failure is announced inline and does not navigate", async () => {
  reset({ error: "This free download is currently unavailable." });
  const props = { slug: "unavailable", title: "Unavailable Art" };
  let tree = render(props);
  tree.props.children[0].props.onClick({ preventDefault() {}, stopPropagation() {} });
  await Promise.all(tasks);
  tree = render(props);
  assert.equal(tree.props.children[1].props.role, "alert");
  assert.match(tree.props.children[1].props.children, /currently unavailable/);
  assert.deepEqual(navigation, []);
});
