// Stub loader: maps any *.module.css (or *.css) import to a Proxy module
// that returns the requested key as a string. Lets us import "use client"
// React components in node:test without bundler help.
//
// Used by primitive component tests that render via react-dom/server.
import { pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".css")) {
    return {
      url: pathToFileURL("/__css-stub__/" + specifier).href,
      shortCircuit: true,
      format: "module",
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:///__css-stub__/")) {
    return {
      format: "module",
      shortCircuit: true,
      source:
        "export default new Proxy({}, { get: (_t, prop) => typeof prop === 'string' ? prop : '' });",
    };
  }
  return nextLoad(url, context);
}
