import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAllowedMime } from "../app/api/team/prescription-documents/route.js";

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HTML = Buffer.from("<!doctype html><html></html>");
const SVG = Buffer.from('<?xml version="1.0"?><svg></svg>');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

test("detectAllowedMime: PDF accepted", () => {
  assert.equal(detectAllowedMime(PDF), "application/pdf");
});
test("detectAllowedMime: JPEG accepted", () => {
  assert.equal(detectAllowedMime(JPEG), "image/jpeg");
});
test("detectAllowedMime: PNG accepted", () => {
  assert.equal(detectAllowedMime(PNG), "image/png");
});
test("detectAllowedMime: HTML rejected (returns null)", () => {
  assert.equal(detectAllowedMime(HTML), null);
});
test("detectAllowedMime: SVG rejected", () => {
  assert.equal(detectAllowedMime(SVG), null);
});
test("detectAllowedMime: ZIP rejected", () => {
  assert.equal(detectAllowedMime(ZIP), null);
});
