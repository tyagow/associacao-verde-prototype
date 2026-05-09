import { test } from "node:test";
import assert from "node:assert/strict";

import { pluralize, pluralWord } from "../app/equipe/components/pluralize.js";

test("pluralize uses singular for count === 1", () => {
  assert.equal(pluralize(1, "paciente", "pacientes"), "1 paciente");
  assert.equal(pluralize(1, "lote", "lotes"), "1 lote");
  assert.equal(pluralize(1, "evento", "eventos"), "1 evento");
});

test("pluralize uses plural for count !== 1", () => {
  assert.equal(pluralize(0, "paciente", "pacientes"), "0 pacientes");
  assert.equal(pluralize(2, "paciente", "pacientes"), "2 pacientes");
  assert.equal(pluralize(99, "documento", "documentos"), "99 documentos");
});

test("pluralize coerces non-numeric counts to 0", () => {
  assert.equal(pluralize(undefined, "lote", "lotes"), "0 lotes");
  assert.equal(pluralize(null, "lote", "lotes"), "0 lotes");
  assert.equal(pluralize(NaN, "lote", "lotes"), "0 lotes");
  assert.equal(pluralize("not a number", "lote", "lotes"), "0 lotes");
});

test("pluralize handles -ões plurals correctly when caller passes them", () => {
  assert.equal(pluralize(1, "permissão", "permissões"), "1 permissão");
  assert.equal(pluralize(3, "permissão", "permissões"), "3 permissões");
});

test("pluralWord returns just the noun without the count prefix", () => {
  assert.equal(pluralWord(1, "lote", "lotes"), "lote");
  assert.equal(pluralWord(0, "lote", "lotes"), "lotes");
  assert.equal(pluralWord(7, "lote", "lotes"), "lotes");
});

test("pluralize coerces string-numeric counts via Number()", () => {
  assert.equal(pluralize("1", "lote", "lotes"), "1 lote");
  assert.equal(pluralize("2", "lote", "lotes"), "2 lotes");
});
