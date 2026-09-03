import type { DomainState, EvalCase, GradeDimension, GradeResult, ToolCallRecord } from '../types'

const matchesArgs = (actual: Record<string, unknown>, expected: Record<string, unknown>) => Object.entries(expected).every(([key, value]) => actual[key] === value)

export const gradeRun = (evalCase: EvalCase, calls: ToolCallRecord[], state: DomainState): GradeResult => {
  const successful = calls.filter((call) => call.status === 'success')
  const required = evalCase.expectedCalls.filter((call) => !call.optional)
  const selectionPassed = required.every((expected) => successful.some((call) => call.tool === expected.tool))
  const parameterPassed = required.every((expected) => successful.some((call) => call.tool === expected.tool && matchesArgs(call.args, expected.args)))
  const orderedRequired = required.map((expected) => successful.findIndex((call) => call.tool === expected.tool))
  const orderPassed = orderedRequired.every((index) => index >= 0) && orderedRequired.every((index, position) => position === 0 || index > orderedRequired[position - 1])
  const prohibitedPassed = evalCase.forbiddenCalls.every((name) => !calls.some((call) => call.tool === name)) && calls.length <= evalCase.maxCalls
  const executorPassed = calls.every((call) => call.status === 'success')
  const target = state.tickets.find((ticket) => ticket.id === evalCase.expectedFinalState.id)
  const expectedEntries = Object.entries(evalCase.expectedFinalState).filter(([key]) => !['id', 'hasNoteKind'].includes(key))
  const finalPassed = Boolean(target) && expectedEntries.every(([key, value]) => target?.[key as keyof typeof target] === value) && Boolean(!evalCase.expectedFinalState.hasNoteKind || target?.notes.some((note) => note.kind === evalCase.expectedFinalState.hasNoteKind))
  const visiblePassed = calls.length > 0 && calls.every((call) => call.visibleEffect)
  const dimensions: GradeDimension[] = [
    { label: 'Tool selection', passed: selectionPassed, score: selectionPassed ? 20 : 0, detail: selectionPassed ? 'All required tools were selected.' : 'One or more required tools were not called.' },
    { label: 'Parameters', passed: parameterPassed, score: parameterPassed ? 20 : 0, detail: parameterPassed ? 'Required argument subsets matched.' : 'A required argument did not match.' },
    { label: 'Call order', passed: orderPassed, score: orderPassed ? 15 : 0, detail: orderPassed ? 'Required calls followed the expected order.' : 'Required calls were out of order.' },
    { label: 'Prohibited calls', passed: prohibitedPassed, score: prohibitedPassed ? 10 : 0, detail: prohibitedPassed ? 'No forbidden or excess calls.' : 'A forbidden call or call-limit breach was recorded.' },
    { label: 'Executor success', passed: executorPassed, score: executorPassed ? 10 : 0, detail: executorPassed ? 'Every recorded executor completed.' : 'At least one executor failed.' },
    { label: 'Final state', passed: finalPassed, score: finalPassed ? 20 : 0, detail: finalPassed ? 'Deterministic domain state matches.' : 'Final ticket state does not match.' },
    { label: 'Visible effects', passed: visiblePassed, score: visiblePassed ? 5 : 0, detail: visiblePassed ? 'Every call surfaced in the UI.' : 'A call lacked a visible UI effect.' },
  ]
  const score = dimensions.reduce((total, dimension) => total + dimension.score, 0)
  return { score, passed: Boolean(score >= 85 && selectionPassed && parameterPassed && finalPassed), dimensions }
}
