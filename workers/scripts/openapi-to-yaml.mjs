#!/usr/bin/env node
/**
 * BINOFIT — Génère specs/openapi.yml à partir de specs/openapi.json.
 *
 * specs/openapi.json reste la source de vérité : ne jamais modifier openapi.yml à la
 * main, relancer ce script après chaque modification du .json. Conversion fidèle
 * (mêmes clés, mêmes valeurs, même ordre), sans dépendance : les chaînes qui ne sont
 * pas des mots simples sont écrites entre guillemets doubles (échappements JSON,
 * valides en YAML), les clés numériques comme "200" restent des chaînes.
 *
 * Usage (depuis workers/) :
 *   node scripts/openapi-to-yaml.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SPECS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../specs')
const INPUT = resolve(SPECS_DIR, 'openapi.json')
const OUTPUT = resolve(SPECS_DIR, 'openapi.yml')

// Mots que YAML interpréterait comme booléen ou null s'ils n'étaient pas entre guillemets.
const RESERVED = /^(true|false|null|yes|no|on|off|y|n|~)$/i
const PLAIN = /^[A-Za-z_][A-Za-z0-9_.\/-]*$/

function scalar(value) {
  if (value === null) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (PLAIN.test(value) && !RESERVED.test(value)) return value
  return JSON.stringify(value)
}

function isContainer(value) {
  return value !== null && typeof value === 'object'
}

function isEmpty(value) {
  return Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
}

/** Renvoie les lignes YAML d'une valeur, indentée de `indent` espaces. */
function emit(value, indent) {
  const pad = ' '.repeat(indent)
  const lines = []
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isContainer(item) && !isEmpty(item)) {
        const inner = emit(item, indent + 2)
        inner[0] = `${pad}- ${inner[0].slice(indent + 2)}`
        lines.push(...inner)
      } else {
        lines.push(`${pad}- ${isContainer(item) ? (Array.isArray(item) ? '[]' : '{}') : scalar(item)}`)
      }
    }
    return lines
  }
  for (const [key, child] of Object.entries(value)) {
    const k = scalar(key)
    if (isContainer(child) && !isEmpty(child)) {
      lines.push(`${pad}${k}:`, ...emit(child, indent + 2))
    } else {
      lines.push(`${pad}${k}: ${isContainer(child) ? (Array.isArray(child) ? '[]' : '{}') : scalar(child)}`)
    }
  }
  return lines
}

const spec = JSON.parse(readFileSync(INPUT, 'utf8'))
const header = '# Fichier généré depuis specs/openapi.json par workers/scripts/openapi-to-yaml.mjs.\n# Ne pas modifier à la main : modifier openapi.json puis relancer le script.\n'
writeFileSync(OUTPUT, `${header}${emit(spec, 0).join('\n')}\n`)
console.log(`specs/openapi.yml régénéré depuis specs/openapi.json`)
