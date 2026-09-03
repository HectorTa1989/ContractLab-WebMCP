import type { InputSchema, SchemaProperty, ToolContract } from '../types'

export interface ValidationIssue {
  path: string
  message: string
}

const validateProperty = (value: unknown, definition: SchemaProperty, path: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  if (definition.type === 'array') {
    if (!Array.isArray(value)) issues.push({ path, message: 'must be an array' })
    return issues
  }
  if (definition.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) issues.push({ path, message: 'must be an object' })
    return issues
  }
  if (typeof value !== definition.type) {
    issues.push({ path, message: `must be a ${definition.type}` })
    return issues
  }
  if (typeof value === 'string') {
    if (definition.enum && !definition.enum.includes(value)) issues.push({ path, message: `must be one of ${definition.enum.join(', ')}` })
    if (definition.minLength !== undefined && value.length < definition.minLength) issues.push({ path, message: `must contain at least ${definition.minLength} characters` })
    if (definition.maxLength !== undefined && value.length > definition.maxLength) issues.push({ path, message: `must contain at most ${definition.maxLength} characters` })
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) issues.push({ path, message: 'must be finite' })
    if (definition.minimum !== undefined && value < definition.minimum) issues.push({ path, message: `must be at least ${definition.minimum}` })
    if (definition.maximum !== undefined && value > definition.maximum) issues.push({ path, message: `must be at most ${definition.maximum}` })
  }
  return issues
}

export const validateArguments = (input: unknown, schema: InputSchema): ValidationIssue[] => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return [{ path: '$', message: 'must be an object' }]
  const record = input as Record<string, unknown>
  const issues: ValidationIssue[] = []
  for (const field of schema.required) {
    if (!(field in record)) issues.push({ path: field, message: 'is required' })
  }
  for (const [key, value] of Object.entries(record)) {
    const definition = schema.properties[key]
    if (!definition) {
      if (schema.additionalProperties === false) issues.push({ path: key, message: 'is not allowed' })
      continue
    }
    issues.push(...validateProperty(value, definition, key))
  }
  return issues
}

export const validateContract = (contract: ToolContract): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  if (!/^[a-z][a-z0-9_]{1,29}$/.test(contract.name)) issues.push({ path: 'name', message: 'must be snake_case and no longer than 30 characters' })
  if (!contract.title.trim()) issues.push({ path: 'title', message: 'is required' })
  if (!contract.description.trim() || contract.description.length > 500) issues.push({ path: 'description', message: 'must contain 1–500 characters' })
  if (contract.inputSchema.type !== 'object') issues.push({ path: 'inputSchema.type', message: 'must be object' })
  for (const required of contract.inputSchema.required) {
    if (!contract.inputSchema.properties[required]) issues.push({ path: `inputSchema.required.${required}`, message: 'does not reference a property' })
  }
  for (const [key, property] of Object.entries(contract.inputSchema.properties)) {
    if (!/^[a-z][a-z0-9_]{0,29}$/.test(key)) issues.push({ path: `inputSchema.properties.${key}`, message: 'must be a short snake_case name' })
    if (!property.description.trim() || property.description.length > 150) issues.push({ path: `inputSchema.properties.${key}.description`, message: 'must contain 1–150 characters' })
  }
  const readEffects = new Set(['search_tickets', 'get_ticket', 'get_activity'])
  if (contract.annotations.readOnlyHint && !readEffects.has(contract.effect)) issues.push({ path: 'annotations.readOnlyHint', message: 'cannot annotate a mutating effect as read-only' })
  if (contract.resultTemplate.length > 1500) issues.push({ path: 'resultTemplate', message: 'must be at most 1,500 characters' })
  return issues
}

export const toJsonSchema = (schema: InputSchema): Record<string, unknown> => ({
  type: schema.type,
  properties: Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))])),
  required: schema.required,
  additionalProperties: schema.additionalProperties,
})
