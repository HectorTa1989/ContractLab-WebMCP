import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowRight, Bot, Braces, Check, CheckCircle2, ChevronDown, CircleDollarSign,
  Clock3, Code2, Command, Copy, Crown, FileDiff, GitBranch, Github, Info, Layers3, Lock,
  LogOut, Menu, MoreHorizontal, Play, Plus, RefreshCcw, RotateCcw, Search, ShieldCheck,
  Sparkles, TerminalSquare, TestTube2, UserRound, WandSparkles, X, XCircle, Zap,
} from 'lucide-react'
import { createSeedDomain, evalCases as seededEvalCases } from './data/seed'
import { createCheckout, getSession, loginAdmin, logout, verifyCheckout } from './lib/api'
import { executeEffect, isAvailable } from './lib/domain'
import { gradeRun } from './lib/grader'
import { lintContracts, type LintFinding } from './lib/lint'
import { exportLabState, loadLabState, resetLabState, saveLabState } from './lib/store'
import { WebMCPRegistry } from './lib/webmcp'
import { validateContract } from './lib/schema'
import type { ContractVersion, DomainState, EvalCase, GradeResult, PersistedLabState, SessionUser, ToolCallRecord, ToolContract } from './types'

type Mode = 'design' | 'eval'
type Modal = 'auth' | 'paywall' | null

const freeSession: SessionUser = { email: null, plan: 'free', authenticated: false }

const relativeTime = (date: string) => {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const pretty = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

function Logo() {
  return <div className="logo-mark" aria-hidden="true"><span /><span /><span /></div>
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'blue' | 'green' | 'orange' | 'purple' | 'red' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange?: (value: boolean) => void; label: string }) {
  return <button type="button" aria-pressed={checked} aria-label={label} onClick={() => onChange?.(!checked)} className={`toggle ${checked ? 'on' : ''}`}><span /></button>
}

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={17} /></button>
        <div className="modal-logo"><Logo /></div>
        <h2 id="modal-title">{title}</h2>
        <p>{subtitle}</p>
        {children}
      </section>
    </div>
  )
}

function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (user: SessionUser) => void }) {
  const [email, setEmail] = useState('admin@contractlab.local')
  const [password, setPassword] = useState('contractlab-admin')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      onSuccess(await loginAdmin(email, password))
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <ModalShell title="Welcome back" subtitle="Sign in with the workspace admin account." onClose={onClose}>
      <form className="auth-form" onSubmit={submit}>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" /></label>
        <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
        {error && <div className="form-error"><XCircle size={15} />{error}</div>}
        <button className="button primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in as admin'}<ArrowRight size={16} /></button>
      </form>
      <div className="demo-credentials"><Info size={14} /><span>Local demo credentials are prefilled. Set secure values before deployment.</span></div>
    </ModalShell>
  )
}

function PaywallModal({ onClose, onAdmin }: { onClose: () => void; onAdmin: () => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const checkout = async () => {
    setBusy(true)
    setError('')
    try {
      const { url } = await createCheckout(email)
      window.location.assign(url)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Checkout unavailable.')
      setBusy(false)
    }
  }
  return (
    <ModalShell title="Unlock live evaluations" subtitle="ContractLab Pro adds live tool registries, grading, version evidence, and export." onClose={onClose}>
      <div className="price-row"><div><span className="price">$12</span><span className="price-unit"> / month</span></div><Pill tone="purple">Powered by Polar</Pill></div>
      <ul className="feature-list">
        {['Unlimited live eval runs', 'Seven-dimension deterministic grading', 'Contract version diffs and evidence export', 'Admin access includes every paid feature'].map((item) => <li key={item}><CheckCircle2 size={17} />{item}</li>)}
      </ul>
      <label className="checkout-email">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
      {error && <div className="form-error"><XCircle size={15} />{error}</div>}
      <button className="button primary wide" onClick={checkout} disabled={busy}>{busy ? 'Opening Polar…' : 'Continue to Polar'}<ArrowRight size={16} /></button>
      <button className="button ghost wide" onClick={onAdmin}><ShieldCheck size={16} />I’m the workspace admin</button>
      <div className="secure-note"><Lock size={13} />Secure checkout and tax handling by Polar</div>
    </ModalShell>
  )
}

function Topbar({ mode, user, onMode, onAuth, onLogout, onReset }: { mode: Mode; user: SessionUser; onMode: (mode: Mode) => void; onAuth: () => void; onLogout: () => void; onReset: () => void }) {
  return (
    <header className="topbar">
      <div className="brand"><Logo /><strong>ContractLab</strong><span className="beta">BETA</span></div>
      <nav className="mode-switch" aria-label="Workspace mode">
        <button className={mode === 'design' ? 'active' : ''} onClick={() => onMode('design')}><Braces size={15} />Design</button>
        <button className={mode === 'eval' ? 'active live' : ''} onClick={() => onMode('eval')}><Zap size={15} />Live eval</button>
      </nav>
      <div className="top-actions">
        <a className="icon-button" href="https://github.com/HectorTa1989" target="_blank" rel="noreferrer" aria-label="HectorTa1989 on GitHub"><Github size={18} /></a>
        <button className="icon-button" onClick={onReset} aria-label="Reset project"><RotateCcw size={17} /></button>
        {user.authenticated ? (
          <div className="account-menu"><div className="avatar">{user.plan === 'admin' ? <Crown size={14} /> : <UserRound size={14} />}</div><div><strong>{user.plan === 'admin' ? 'Admin' : 'Pro member'}</strong><small>{user.email}</small></div><button className="icon-button compact" onClick={onLogout} aria-label="Sign out"><LogOut size={15} /></button></div>
        ) : <button className="button secondary" onClick={onAuth}>Sign in</button>}
      </div>
    </header>
  )
}

function ProjectSidebar({ state, evalCases, evalCase, onEvalCase, onVersion, user, onUpgrade }: { state: PersistedLabState; evalCases: EvalCase[]; evalCase: EvalCase; onEvalCase: (item: EvalCase) => void; onVersion: (version: number) => void; user: SessionUser; onUpgrade: () => void }) {
  return (
    <aside className="project-sidebar">
      <div className="sidebar-heading"><span>PROJECT</span><button className="icon-button compact"><MoreHorizontal size={16} /></button></div>
      <button className="project-item selected"><div className="project-glyph"><Code2 size={16} /></div><div><strong>Support Desk</strong><small>7 tool contracts</small></div></button>
      <div className="sidebar-heading spaced"><span>VERSIONS</span><button className="icon-button compact"><Plus size={15} /></button></div>
      <div className="version-list">
        {[...state.versions].reverse().map((version) => <button key={version.version} onClick={() => onVersion(version.version)} className={state.selectedVersion === version.version ? 'selected' : ''}><GitBranch size={14} /><span><strong>v{version.version}</strong>{version.label.split('·')[1]?.trim()}</span>{version.version === Math.max(...state.versions.map((item) => item.version)) && <Pill tone="green">Latest</Pill>}</button>)}
      </div>
      <div className="sidebar-heading spaced"><span>EVAL CASES</span><button className="icon-button compact"><Plus size={15} /></button></div>
      <div className="eval-list">
        {evalCases.map((item, index) => <button key={item.id} onClick={() => onEvalCase(item)} className={evalCase.id === item.id ? 'selected' : ''}><span className="case-index">0{index + 1}</span><span><strong>{item.title}</strong><small>{item.expectedCalls.filter((call) => !call.optional).length} expected calls</small></span></button>)}
      </div>
      <div className={`plan-card ${user.plan}`}>
        <div><Crown size={16} /><strong>{user.plan === 'admin' ? 'Admin workspace' : user.plan === 'pro' ? 'Pro workspace' : 'Free workspace'}</strong></div>
        <p>{user.plan === 'free' ? 'Live evals and evidence export are locked.' : 'Every paid capability is unlocked.'}</p>
        {user.plan === 'free' && <button onClick={onUpgrade}>Upgrade with Polar <ArrowRight size={13} /></button>}
      </div>
    </aside>
  )
}

function ContractCard({ contract, selected, findingCount, onSelect }: { contract: ToolContract; selected: boolean; findingCount: number; onSelect: () => void }) {
  const read = contract.annotations.readOnlyHint
  return (
    <button className={`contract-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="contract-icon"><Command size={18} /></div>
      <div className="contract-copy">
        <div className="contract-title"><code>{contract.name}</code><Pill tone={read ? 'blue' : 'orange'}>{read ? 'Read' : 'Write'}</Pill>{contract.availability !== 'always' && <Pill tone="purple">Conditional</Pill>}</div>
        <p>{contract.description}</p>
        <div className="contract-meta"><span>{Object.keys(contract.inputSchema.properties).length} parameters</span><span>Effect · {pretty(contract.effect)}</span>{findingCount > 0 ? <span className="finding-count"><Info size={12} />{findingCount} signals</span> : <span className="clean"><Check size={12} />Clean</span>}</div>
      </div>
      <ArrowRight size={16} className="card-arrow" />
    </button>
  )
}

function ContractEditor({ contract, findings, onSave, locked }: { contract: ToolContract; findings: LintFinding[]; onSave: (contract: ToolContract) => void; locked: boolean }) {
  const [draft, setDraft] = useState(contract)
  useEffect(() => setDraft(contract), [contract])
  const setAnnotation = (key: keyof ToolContract['annotations'], value: boolean) => setDraft((current) => ({ ...current, annotations: { ...current.annotations, [key]: value } }))
  return (
    <div className="editor-panel">
      <div className="panel-heading"><div><span className="eyebrow">CONTRACT INSPECTOR</span><h2>{contract.title}</h2></div><Pill tone={findings.some((item) => item.severity === 'error') ? 'red' : findings.length ? 'orange' : 'green'}>{findings.length ? `${findings.length} signals` : 'Compiles'}</Pill></div>
      <div className="editor-tabs"><button className="active">Structured</button><button>JSON source</button><button>History</button></div>
      <div className="field-grid two"><label>Tool name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Human title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label></div>
      <label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} /><small>{draft.description.length} / 500</small></label>
      <div className="section-label"><span>Input schema</span><Pill>{Object.keys(draft.inputSchema.properties).length} fields</Pill></div>
      <div className="schema-table">
        <div className="schema-head"><span>Property</span><span>Type</span><span>Constraints</span><span>Required</span></div>
        {Object.entries(draft.inputSchema.properties).map(([name, property]) => <div className="schema-row" key={name}><code>{name}</code><Pill tone="blue">{property.type}</Pill><span>{property.enum ? property.enum.join(' · ') : property.minLength ? `${property.minLength}–${property.maxLength ?? '∞'} chars` : property.minimum ? `≥ ${property.minimum}` : '—'}</span><CheckCircle2 className={draft.inputSchema.required.includes(name) ? 'required' : ''} size={16} /></div>)}
      </div>
      <div className="field-grid two compact-fields"><label>Availability<select value={draft.availability} onChange={(event) => setDraft({ ...draft, availability: event.target.value as ToolContract['availability'] })}><option value="always">Always</option><option value="ticket_selected">Ticket selected</option><option value="has_resolution_note">Has resolution note</option></select><ChevronDown size={14} /></label><label>Safe mock effect<select value={draft.effect} onChange={(event) => setDraft({ ...draft, effect: event.target.value as ToolContract['effect'] })}>{['search_tickets', 'get_ticket', 'set_priority', 'assign_team', 'add_note', 'close_ticket', 'get_activity'].map((effect) => <option key={effect}>{effect}</option>)}</select><ChevronDown size={14} /></label></div>
      <div className="annotation-row"><div><strong>Read-only hint</strong><small>Signals that execution cannot change state.</small></div><Toggle checked={draft.annotations.readOnlyHint} onChange={(value) => setAnnotation('readOnlyHint', value)} label="Read-only hint" /></div>
      <div className="annotation-row"><div><strong>Untrusted content</strong><small>Labels user-authored data returned to the agent.</small></div><Toggle checked={draft.annotations.untrustedContentHint} onChange={(value) => setAnnotation('untrustedContentHint', value)} label="Untrusted content hint" /></div>
      <div className="editor-footer"><span>{locked && <><Lock size={13} /> Admin or Pro required to save revisions</>}</span><button className="button primary" disabled={locked || JSON.stringify(draft) === JSON.stringify(contract)} onClick={() => onSave(draft)}><GitBranch size={15} />Save as new version</button></div>
    </div>
  )
}

function FindingsPanel({ findings, selectedToolId, onSelect }: { findings: LintFinding[]; selectedToolId: string; onSelect: (id: string) => void }) {
  const sorted = [...findings].sort((a, b) => ({ error: 0, warning: 1, info: 2 }[a.severity] - { error: 0, warning: 1, info: 2 }[b.severity]))
  return (
    <aside className="findings-panel">
      <div className="panel-heading small"><div><span className="eyebrow">CONTRACT QUALITY</span><h3>Lint findings</h3></div><span className="finding-total">{findings.length}</span></div>
      <p className="disclaimer"><Info size={14} />Signals help improve contracts; they cannot guarantee agent behavior.</p>
      <div className="finding-list">
        {sorted.length === 0 && <div className="all-clear"><CheckCircle2 size={28} /><strong>No deterministic findings</strong><span>Run live evals to test probabilistic selection.</span></div>}
        {sorted.map((finding) => <button key={finding.id} className={`finding-item ${finding.severity} ${finding.toolId === selectedToolId ? 'selected' : ''}`} onClick={() => finding.toolId && onSelect(finding.toolId)}><span className="finding-dot" /><div><div><strong>{finding.title}</strong><Pill tone={finding.severity === 'error' ? 'red' : 'orange'}>{finding.severity}</Pill></div><p>{finding.detail}</p><code>{finding.code}</code></div></button>)}
      </div>
      <div className="quality-summary"><div className="summary-title"><WandSparkles size={15} /><strong>Quality snapshot</strong></div><div className="quality-bars"><span style={{ width: `${Math.max(18, 100 - findings.length * 6)}%` }} /><span style={{ width: `${Math.min(82, findings.length * 6)}%` }} /></div><div><span>Passing checks</span><strong>{Math.max(0, 12 - findings.length)} / 12</strong></div></div>
    </aside>
  )
}

function DesignWorkspace({ lab, setLab, activeVersion, selectedContract, setSelectedContract, evalCases, evalCase, setEvalCase, user, onUpgrade, onPrepare, registryNames, webmcpSupported }: { lab: PersistedLabState; setLab: React.Dispatch<React.SetStateAction<PersistedLabState>>; activeVersion: ContractVersion; selectedContract: ToolContract; setSelectedContract: (id: string) => void; evalCases: EvalCase[]; evalCase: EvalCase; setEvalCase: (item: EvalCase) => void; user: SessionUser; onUpgrade: () => void; onPrepare: () => void; registryNames: string[]; webmcpSupported: boolean }) {
  const findings = useMemo(() => lintContracts(activeVersion.contracts), [activeVersion])
  const contractFindings = findings.filter((finding) => finding.toolId === selectedContract.id)
  const [showDiff, setShowDiff] = useState(false)
  const baseline = lab.versions[0]
  const baselineFindings = lintContracts(baseline.contracts)
  const nameChanges = activeVersion.contracts.filter((contract) => baseline.contracts.find((item) => item.id === contract.id)?.name !== contract.name).length
  const saveContract = (updated: ToolContract) => {
    const latestVersion = Math.max(...lab.versions.map((item) => item.version))
    const next: ContractVersion = { version: latestVersion + 1, label: 'Draft · edited', createdAt: new Date().toISOString(), summary: `Updated ${updated.name} from v${activeVersion.version}.`, contracts: activeVersion.contracts.map((item) => item.id === updated.id ? updated : item) }
    setLab((current) => ({ ...current, versions: [...current.versions, next], selectedVersion: next.version }))
  }
  return (
    <div className="workspace-frame">
      <ProjectSidebar state={lab} evalCases={evalCases} evalCase={evalCase} onEvalCase={setEvalCase} onVersion={(version) => setLab((current) => ({ ...current, selectedVersion: version }))} user={user} onUpgrade={onUpgrade} />
      <main className="design-main">
        <section className="design-header">
          <div><div className="breadcrumb"><span>Projects</span><span>/</span><span>Support Desk</span><span>/</span><strong>v{activeVersion.version}</strong></div><h1>Tool contracts</h1><p>Shape the interface agents use, then test it against a deterministic support desk.</p></div>
          <div className="header-actions"><button className="button secondary" onClick={() => setShowDiff((value) => !value)}><FileDiff size={15} />Compare v1 → v{activeVersion.version}</button><button className="button primary" onClick={() => user.plan === 'free' ? onUpgrade() : onPrepare()}><Play size={15} />Prepare live eval</button></div>
        </section>
        <section className="metric-strip">
          <div><span className="metric-icon blue"><Command size={17} /></span><span><strong>{activeVersion.contracts.length}</strong><small>Tool contracts</small></span></div>
          <div><span className="metric-icon amber"><Info size={17} /></span><span><strong>{findings.length}</strong><small>Quality signals</small></span></div>
          <div><span className="metric-icon green"><TestTube2 size={17} /></span><span><strong>{evalCases.length}</strong><small>Seeded evals</small></span></div>
          <div><span className="metric-icon purple"><Layers3 size={17} /></span><span><strong>v{activeVersion.version}</strong><small>Active version</small></span></div>
        </section>
        {showDiff && <section className="diff-banner"><div className="diff-heading"><div><span className="eyebrow">VERSION EVIDENCE</span><h2>v1 starter <ArrowRight size={15} /> v{activeVersion.version} active</h2></div><button className="icon-button" onClick={() => setShowDiff(false)}><X size={16} /></button></div><div className="diff-stats"><div><span>Quality signals</span><strong>{baselineFindings.length} <ArrowRight size={14} /> {findings.length}</strong><small>{findings.length < baselineFindings.length ? `${baselineFindings.length - findings.length} resolved` : 'No reduction'}</small></div><div><span>Renamed tools</span><strong>{nameChanges}</strong><small>Clear, specific intent</small></div><div><span>Read annotations</span><strong>{activeVersion.contracts.filter((item) => item.annotations.readOnlyHint).length}</strong><small>Behavior-aligned hints</small></div><div><span>State guards</span><strong>{activeVersion.contracts.filter((item) => item.availability !== 'always').length}</strong><small>Dynamic availability</small></div></div></section>}
        <section className="contracts-section">
          <div className="section-title"><div><h2>Registry draft</h2><span>{activeVersion.summary}</span></div><div className="search-box"><Search size={15} /><input aria-label="Search contracts" placeholder="Filter contracts" /><kbd>⌘ K</kbd></div></div>
          <div className="contract-layout">
            <div className="contract-list">{activeVersion.contracts.map((contract) => <ContractCard key={contract.id} contract={contract} selected={contract.id === selectedContract.id} findingCount={findings.filter((finding) => finding.toolId === contract.id).length} onSelect={() => setSelectedContract(contract.id)} />)}</div>
            <ContractEditor contract={selectedContract} findings={contractFindings} onSave={saveContract} locked={user.plan === 'free'} />
          </div>
        </section>
      </main>
      <FindingsPanel findings={findings} selectedToolId={selectedContract.id} onSelect={setSelectedContract} />
      <RegistryRail mode="design" names={registryNames} supported={webmcpSupported} />
    </div>
  )
}

function RegistryRail({ mode, names, supported }: { mode: Mode; names: string[]; supported: boolean }) {
  return (
    <footer className="registry-rail">
      <div className="registry-status"><span className={`pulse ${supported ? '' : 'muted'}`} /><strong>{mode === 'design' ? 'Design registry' : 'Eval registry'}</strong><Pill tone={supported ? 'green' : 'orange'}>{supported ? 'Active' : 'Preview'}</Pill><span>{names.length} tools</span></div>
      <div className="registry-tools">{names.slice(0, 5).map((name) => <code key={name}>{name}</code>)}{names.length > 5 && <span>+{names.length - 5}</span>}</div>
      <div className="registry-security"><ShieldCheck size={14} />Mode-isolated · same-origin only</div>
    </footer>
  )
}

function TicketWorkspace({ domain, onSelect }: { domain: DomainState; onSelect: (id: string) => void }) {
  const ticket = domain.tickets.find((item) => item.id === domain.selectedTicketId) ?? domain.tickets[0]
  return (
    <section className="ticket-workspace">
      <div className="ticket-list-panel">
        <div className="ticket-list-header"><div><strong>Inbox</strong><span>{domain.tickets.filter((item) => item.status !== 'closed').length} open</span></div><button className="icon-button compact"><Search size={16} /></button></div>
        {domain.tickets.map((item) => <button key={item.id} className={`ticket-list-item ${item.id === ticket.id ? 'selected' : ''}`} onClick={() => onSelect(item.id)}><div><code>{item.id}</code><Pill tone={item.priority === 'urgent' ? 'red' : item.priority === 'high' ? 'orange' : 'neutral'}>{item.priority}</Pill></div><strong>{item.subject}</strong><span>{item.customer} · {pretty(item.team)}</span></button>)}
      </div>
      <article className="ticket-detail">
        <div className="ticket-heading"><div><div className="ticket-id-row"><code>{ticket.id}</code><Pill tone={ticket.status === 'closed' ? 'green' : 'blue'}>{pretty(ticket.status)}</Pill><Pill tone={ticket.priority === 'urgent' ? 'red' : ticket.priority === 'high' ? 'orange' : 'neutral'}>{ticket.priority}</Pill></div><h2>{ticket.subject}</h2><p>{ticket.summary}</p></div><button className="icon-button"><MoreHorizontal size={18} /></button></div>
        <div className="ticket-facts"><div><span>Customer</span><strong>{ticket.customer}</strong><small>{ticket.customerEmail}</small></div><div><span>Team</span><strong>{pretty(ticket.team)}</strong><small>Owner group</small></div><div><span>Version</span><strong>#{ticket.version}</strong><small>Optimistic lock</small></div></div>
        <div className="tag-row">{ticket.tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}</div>
        <div className="detail-tabs"><button className="active">Conversation</button><button>Activity <span>{ticket.activity.length}</span></button></div>
        <div className="conversation">
          <div className="message customer"><div className="message-avatar">{ticket.customer.split(' ').map((part) => part[0]).join('')}</div><div><div className="message-meta"><strong>{ticket.customer}</strong><span>Customer</span><time>{relativeTime(ticket.activity[0]?.at ?? new Date().toISOString())}</time></div><p>{ticket.summary}</p></div></div>
          {ticket.notes.map((note) => <div className={`message ${note.kind}`} key={note.id}><div className="message-avatar">{note.kind === 'customer' ? 'MC' : 'CL'}</div><div><div className="message-meta"><strong>{note.author}</strong><Pill tone={note.kind === 'resolution' ? 'green' : note.kind === 'customer' ? 'orange' : 'blue'}>{note.kind}</Pill><time>{relativeTime(note.createdAt)}</time></div><p>{note.body}</p>{note.kind === 'customer' && <div className="untrusted"><ShieldCheck size={13} />Untrusted user-authored content</div>}</div></div>)}
        </div>
      </article>
    </section>
  )
}

function Recorder({ calls }: { calls: ToolCallRecord[] }) {
  return (
    <aside className="recorder-panel">
      <div className="panel-heading small"><div><span className="eyebrow">LIVE TRACE</span><h3>Tool calls</h3></div><Pill tone={calls.some((call) => call.status === 'failure') ? 'red' : calls.length ? 'green' : 'neutral'}>{calls.length} calls</Pill></div>
      <div className="recorder-list">
        {calls.length === 0 && <div className="empty-trace"><Activity size={28} /><strong>Waiting for calls</strong><span>Ask your browser agent to perform the eval task, or run the deterministic preview.</span></div>}
        {calls.map((call, index) => <div className={`call-card ${call.status}`} key={call.id}><div className="call-index">{call.status === 'success' ? <Check size={14} /> : call.status === 'failure' ? <X size={14} /> : <span />}</div><div className="call-body"><div><code>{call.tool}</code><time>{call.durationMs}ms</time></div><pre>{JSON.stringify(call.args, null, 2)}</pre>{call.stateDiff.length > 0 && <div className="state-diff">{call.stateDiff.map((diff) => <span key={diff}>+ {diff}</span>)}</div>}{call.error && <div className="call-error">{call.error}</div>}</div>{index < calls.length - 1 && <div className="call-line" />}</div>)}
      </div>
    </aside>
  )
}

function GradeDrawer({ grade, onClose }: { grade: GradeResult; onClose: () => void }) {
  return (
    <div className="grade-drawer">
      <div className="grade-score"><div className={grade.passed ? 'pass' : 'fail'}><strong>{grade.score}</strong><span>/100</span></div><div><Pill tone={grade.passed ? 'green' : 'red'}>{grade.passed ? 'Passed' : 'Needs work'}</Pill><h3>Run grade</h3><p>Deterministic evidence from the recorded trace.</p></div><button className="icon-button" onClick={onClose}><X size={16} /></button></div>
      <div className="grade-dimensions">{grade.dimensions.map((dimension) => <div key={dimension.label}><span className={dimension.passed ? 'pass' : 'fail'}>{dimension.passed ? <Check size={13} /> : <X size={13} />}</span><div><strong>{dimension.label}</strong><small>{dimension.detail}</small></div><b>{dimension.score}</b></div>)}</div>
    </div>
  )
}

function EvalWorkspace({ activeVersion, evalCases, evalCase, setEvalCase, domain, calls, grade, registryNames, webmcpSupported, onSelectTicket, onRunPreview, onGrade, onResetRun, onCloseGrade }: { activeVersion: ContractVersion; evalCases: EvalCase[]; evalCase: EvalCase; setEvalCase: (item: EvalCase) => void; domain: DomainState; calls: ToolCallRecord[]; grade: GradeResult | null; registryNames: string[]; webmcpSupported: boolean; onSelectTicket: (id: string) => void; onRunPreview: () => void; onGrade: () => void; onResetRun: () => void; onCloseGrade: () => void }) {
  const availableTools = activeVersion.contracts.filter((contract) => isAvailable(contract, domain))
  return (
    <div className="eval-frame">
      <header className="eval-header"><div className="eval-identity"><span className="live-orb"><Zap size={15} /></span><div><strong>Live evaluation</strong><small>External agent registry</small></div></div><div className="eval-context"><label>Case<select value={evalCase.id} onChange={(event) => setEvalCase(evalCases.find((item) => item.id === event.target.value) ?? evalCases[0])}>{evalCases.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select><ChevronDown size={13} /></label><span>Version <strong>v{activeVersion.version}</strong></span><span className="tool-count"><span />{availableTools.length + 1} tools exposed</span></div><div className="eval-actions"><button className="button secondary" onClick={onResetRun}><RefreshCcw size={15} />Reset</button><button className="button dark" onClick={onGrade} disabled={!calls.length}><CheckCircle2 size={15} />Finish & grade</button></div></header>
      <aside className="task-panel">
        <span className="eyebrow">AGENT TASK</span><div className="task-number">{evalCases.findIndex((item) => item.id === evalCase.id) + 1}</div><h2>{evalCase.title}</h2><blockquote>“{evalCase.prompt}”</blockquote><button className="copy-button" onClick={() => navigator.clipboard?.writeText(evalCase.prompt)}><Copy size={14} />Copy prompt</button>
        <div className="expected-journey"><div><strong>Expected journey</strong><Pill>{evalCase.expectedCalls.filter((call) => !call.optional).length} required</Pill></div>{evalCase.expectedCalls.map((call, index) => <div className="expected-call" key={`${call.tool}-${index}`}><span>{index + 1}</span><code>{call.tool}</code>{call.optional && <Pill>optional</Pill>}</div>)}</div>
        <button className="button preview" onClick={onRunPreview}><Play size={15} />Run deterministic preview</button><p className="preview-note">Calls the same validated executors; it is labeled separately from a browser-agent run.</p>
      </aside>
      <TicketWorkspace domain={domain} onSelect={onSelectTicket} />
      <Recorder calls={calls} />
      {grade && <GradeDrawer grade={grade} onClose={onCloseGrade} />}
      <RegistryRail mode="eval" names={registryNames} supported={webmcpSupported} />
    </div>
  )
}

export default function App() {
  const [lab, setLab] = useState<PersistedLabState>(() => loadLabState())
  const [mode, setMode] = useState<Mode>('design')
  const [selectedContractId, setSelectedContractId] = useState('tool-search')
  const [evalCase, setEvalCaseState] = useState<EvalCase>(() => lab.evalCases[0] ?? seededEvalCases[0])
  const [domain, setDomain] = useState<DomainState>(() => createSeedDomain())
  const [calls, setCalls] = useState<ToolCallRecord[]>([])
  const [grade, setGrade] = useState<GradeResult | null>(null)
  const [user, setUser] = useState<SessionUser>(freeSession)
  const [modal, setModal] = useState<Modal>(null)
  const [registryNames, setRegistryNames] = useState<string[]>([])
  const domainRef = useRef(domain)
  const labRef = useRef(lab)
  const evalCaseRef = useRef(evalCase)
  const registry = useRef(new WebMCPRegistry())
  const activeVersion = lab.versions.find((version) => version.version === lab.selectedVersion) ?? lab.versions.at(-1)!
  const selectedContract = activeVersion.contracts.find((contract) => contract.id === selectedContractId) ?? activeVersion.contracts[0]
  const hasPaidAccess = user.plan === 'pro' || user.plan === 'admin'
  const webmcpSupported = typeof document.modelContext?.registerTool === 'function'

  useEffect(() => { domainRef.current = domain }, [domain])
  useEffect(() => { labRef.current = lab; saveLabState(lab) }, [lab])
  useEffect(() => { evalCaseRef.current = evalCase }, [evalCase])
  useEffect(() => {
    const checkoutId = new URLSearchParams(window.location.search).get('checkout_id')
    const hydrate = async () => {
      try {
        const session = checkoutId ? await verifyCheckout(checkoutId) : await getSession()
        setUser(session)
        if (checkoutId) window.history.replaceState({}, '', window.location.pathname)
      } catch {
        setUser(freeSession)
      }
    }
    void hydrate()
  }, [])

  const executeDraft = useCallback(async (contract: ToolContract, args: Record<string, unknown>) => {
    const id = crypto.randomUUID()
    const started = performance.now()
    const base: ToolCallRecord = { id, tool: contract.name, args: structuredClone(args), status: 'pending', startedAt: new Date().toISOString(), durationMs: 0, stateDiff: [], visibleEffect: true }
    setCalls((current) => [...current, base])
    try {
      const effect = executeEffect(contract, args, domainRef.current)
      domainRef.current = effect.state
      setDomain(effect.state)
      const durationMs = Math.max(1, Math.round(performance.now() - started))
      setCalls((current) => current.map((item) => item.id === id ? { ...item, status: 'success', durationMs, result: effect.result, stateDiff: effect.diff } : item))
      return effect.result
    } catch (reason) {
      const durationMs = Math.max(1, Math.round(performance.now() - started))
      const error = reason instanceof Error ? reason.message : 'Tool execution failed.'
      setCalls((current) => current.map((item) => item.id === id ? { ...item, status: 'failure', durationMs, error } : item))
      throw reason
    }
  }, [])

  useEffect(() => {
    const requirePaid = () => {
      if (!hasPaidAccess) throw new Error('This authoring action requires a Pro or admin session.')
    }
    const requireExpectedVersion = (expectedVersion: number) => {
      if (expectedVersion !== labRef.current.selectedVersion) throw new Error(`Version conflict: expected ${expectedVersion}, current ${labRef.current.selectedVersion}.`)
    }
    const commit = (contracts: ToolContract[], summary: string, nextEvalCases = labRef.current.evalCases) => {
      const nextVersion = Math.max(...labRef.current.versions.map((item) => item.version)) + 1
      const version: ContractVersion = { version: nextVersion, label: 'Agent edit · guarded', createdAt: new Date().toISOString(), summary, contracts: structuredClone(contracts) }
      const next = { ...labRef.current, versions: [...labRef.current.versions, version], selectedVersion: nextVersion, evalCases: structuredClone(nextEvalCases) }
      labRef.current = next
      setLab(next)
      return { version: nextVersion, summary }
    }
    const callbacks = {
      getVersions: () => labRef.current.versions,
      getVersion: () => labRef.current.versions.find((version) => version.version === labRef.current.selectedVersion) ?? labRef.current.versions.at(-1)!,
      getEvalCases: () => labRef.current.evalCases,
      getDomain: () => domainRef.current,
      executeDraft,
      selectContract: setSelectedContractId,
      prepareEval: (evalCaseId: string) => { const next = labRef.current.evalCases.find((item) => item.id === evalCaseId); if (next) setEvalCaseState(next) },
      createContract: (expectedVersion: number, contract: ToolContract) => {
        requirePaid()
        requireExpectedVersion(expectedVersion)
        const issues = validateContract(contract)
        if (issues.length) throw new Error(`Contract is invalid: ${issues[0].path} ${issues[0].message}`)
        const current = callbacks.getVersion()
        if (current.contracts.some((item) => item.id === contract.id || item.name === contract.name)) throw new Error('Contract ID and name must be unique.')
        return commit([...current.contracts, structuredClone(contract)], `Created ${contract.name}.`)
      },
      updateContract: (expectedVersion: number, toolId: string, changes: Partial<ToolContract>) => {
        requirePaid()
        requireExpectedVersion(expectedVersion)
        const current = callbacks.getVersion()
        const existing = current.contracts.find((item) => item.id === toolId)
        if (!existing) throw new Error('Tool contract not found.')
        const allowed: ToolContract = {
          ...existing,
          name: changes.name ?? existing.name,
          title: changes.title ?? existing.title,
          description: changes.description ?? existing.description,
          inputSchema: changes.inputSchema ?? existing.inputSchema,
          annotations: changes.annotations ?? existing.annotations,
          availability: changes.availability ?? existing.availability,
          effect: changes.effect ?? existing.effect,
          resultTemplate: changes.resultTemplate ?? existing.resultTemplate,
          requiresVersion: changes.requiresVersion ?? existing.requiresVersion,
        }
        const issues = validateContract(allowed)
        if (issues.length) throw new Error(`Contract is invalid: ${issues[0].path} ${issues[0].message}`)
        return commit(current.contracts.map((item) => item.id === toolId ? allowed : item), `Updated ${allowed.name}.`)
      },
      createEvalCase: (expectedVersion: number, nextEvalCase: EvalCase) => {
        requirePaid()
        requireExpectedVersion(expectedVersion)
        if (!/^[a-z][a-z0-9-]{2,39}$/.test(nextEvalCase.id) || !nextEvalCase.prompt?.trim() || !Array.isArray(nextEvalCase.expectedCalls)) throw new Error('Eval case ID, prompt, and expected calls are required.')
        if (labRef.current.evalCases.some((item) => item.id === nextEvalCase.id)) throw new Error('Eval case ID must be unique.')
        return commit(callbacks.getVersion().contracts, `Created eval ${nextEvalCase.id}.`, [...labRef.current.evalCases, structuredClone(nextEvalCase)])
      },
      updateEvalCase: (expectedVersion: number, evalCaseId: string, changes: Partial<EvalCase>) => {
        requirePaid()
        requireExpectedVersion(expectedVersion)
        const existing = labRef.current.evalCases.find((item) => item.id === evalCaseId)
        if (!existing) throw new Error('Eval case not found.')
        const updated: EvalCase = { ...existing, title: changes.title ?? existing.title, prompt: changes.prompt ?? existing.prompt, expectedCalls: changes.expectedCalls ?? existing.expectedCalls, forbiddenCalls: changes.forbiddenCalls ?? existing.forbiddenCalls, maxCalls: changes.maxCalls ?? existing.maxCalls, expectedFinalState: changes.expectedFinalState ?? existing.expectedFinalState }
        if (!updated.prompt.trim() || updated.maxCalls < 1 || updated.maxCalls > 30) throw new Error('Eval prompt and a max call count from 1 to 30 are required.')
        return commit(callbacks.getVersion().contracts, `Updated eval ${evalCaseId}.`, labRef.current.evalCases.map((item) => item.id === evalCaseId ? updated : item))
      },
      undoLastEdit: (expectedVersion: number) => {
        requirePaid()
        requireExpectedVersion(expectedVersion)
        if (labRef.current.versions.length < 2) throw new Error('No reversible contract edit exists.')
        const previous = labRef.current.versions.at(-2)!
        return commit(previous.contracts, `Restored the contract snapshot from v${previous.version}.`)
      },
    }
    const expectedNames = mode === 'design'
      ? ['get_contract_lab_project', 'list_tool_contracts', 'get_tool_contract', 'create_tool_contract', 'update_tool_contract', 'lint_tool_contracts', 'list_mock_domain_commands', 'create_eval_case', 'update_eval_case', 'compare_contract_versions', 'prepare_live_eval', 'undo_last_contract_edit']
      : ['get_eval_context', ...activeVersion.contracts.filter((contract) => isAvailable(contract, domain)).map((contract) => contract.name)]
    setRegistryNames(expectedNames)
    void registry.current.register(mode, callbacks).then((registered) => { if (registered.length) setRegistryNames(registered) }).catch(() => setRegistryNames(expectedNames))
    return () => registry.current.abort()
  }, [mode, activeVersion, domain, executeDraft, hasPaidAccess])

  const resetRun = useCallback(() => {
    const fresh = createSeedDomain()
    domainRef.current = fresh
    setDomain(fresh)
    setCalls([])
    setGrade(null)
  }, [])

  const chooseEvalCase = (item: EvalCase) => {
    setEvalCaseState(item)
    resetRun()
  }

  const changeMode = (next: Mode) => {
    if (next === 'eval' && !hasPaidAccess) {
      setModal('paywall')
      return
    }
    setMode(next)
    if (next === 'eval') resetRun()
  }

  const runPreview = async () => {
    resetRun()
    let working = createSeedDomain()
    domainRef.current = working
    for (const expected of evalCaseRef.current.expectedCalls) {
      if (expected.optional && expected.tool === 'get_support_ticket') continue
      const contract = activeVersion.contracts.find((item) => item.name === expected.tool)
      if (!contract) continue
      const ticketId = String(expected.args.ticket_id ?? 'T-104')
      const ticket = working.tickets.find((item) => item.id === ticketId)
      const args: Record<string, unknown> = { ...expected.args }
      if (contract.requiresVersion && ticket) args.expected_version = ticket.version
      if (contract.effect === 'add_note') args.body = evalCase.id === 'eval-close' ? 'Duplicate invoices voided; retry path fixed.' : 'Escalated for backend triage and duplicate invoice review.'
      try { await executeDraft(contract, args) } catch { break }
      working = domainRef.current
    }
  }

  const gradeCurrentRun = () => {
    const result = gradeRun(evalCase, calls, domain)
    setGrade(result)
    setLab((current) => ({ ...current, runHistory: [...current.runHistory, { id: crypto.randomUUID(), evalCaseId: evalCase.id, version: activeVersion.version, createdAt: new Date().toISOString(), calls, grade: result }] }))
  }

  const resetProject = () => {
    const fresh = resetLabState()
    setLab(fresh)
    setMode('design')
    setSelectedContractId('tool-search')
    resetRun()
  }

  return (
    <div className="app-shell">
      <Topbar mode={mode} user={user} onMode={changeMode} onAuth={() => setModal('auth')} onLogout={async () => { await logout(); setUser(freeSession); setMode('design') }} onReset={resetProject} />
      {mode === 'design' ? (
        <DesignWorkspace lab={lab} setLab={setLab} activeVersion={activeVersion} selectedContract={selectedContract} setSelectedContract={setSelectedContractId} evalCases={lab.evalCases} evalCase={evalCase} setEvalCase={chooseEvalCase} user={user} onUpgrade={() => setModal('paywall')} onPrepare={() => changeMode('eval')} registryNames={registryNames} webmcpSupported={webmcpSupported} />
      ) : (
        <EvalWorkspace activeVersion={activeVersion} evalCases={lab.evalCases} evalCase={evalCase} setEvalCase={chooseEvalCase} domain={domain} calls={calls} grade={grade} registryNames={registryNames} webmcpSupported={webmcpSupported} onSelectTicket={(id) => setDomain((current) => ({ ...current, selectedTicketId: id }))} onRunPreview={runPreview} onGrade={gradeCurrentRun} onResetRun={resetRun} onCloseGrade={() => setGrade(null)} />
      )}
      {modal === 'auth' && <AuthModal onClose={() => setModal(null)} onSuccess={setUser} />}
      {modal === 'paywall' && <PaywallModal onClose={() => setModal(null)} onAdmin={() => setModal('auth')} />}
      <button className="export-fab" onClick={() => hasPaidAccess ? exportLabState(lab) : setModal('paywall')} title="Export project"><TerminalSquare size={17} /><span>Export</span>{!hasPaidAccess && <Lock size={12} />}</button>
    </div>
  )
}
