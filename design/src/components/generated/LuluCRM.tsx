import { useState } from 'react';
import './LuluCRM.css';
const brandLogo = 'https://storage.googleapis.com/storage.magicpath.ai/component-assets/459460805365215232/459469391319404544/b4feb3c352cac3371dae319dc728f39e63154139ef00c4ce88f05cd3a714fe43.png';
type View = 'Contacts & Companies' | 'Leads & Deals' | 'Notes' | 'Import Contacts';
type Contact = {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  source: string;
  stage: string;
  owner: string;
  lastTouch: string;
  tone: string;
  tags: string[];
};
const workspaceLinks = [{
  label: 'Online Presence',
  icon: '▦',
  href: 'https://designs.magicpath.ai/v1/brave-river-5250'
}, {
  label: 'Accounting',
  icon: '▤',
  href: 'https://designs.magicpath.ai/v1/wildly-forest-1045'
}, {
  label: 'Calendar',
  icon: '◷',
  href: 'https://designs.magicpath.ai/v1/warmly-time-4098'
}, {
  label: 'Email',
  icon: '✉',
  href: 'https://designs.magicpath.ai/v1/sharply-time-8371'
}];
const moduleLinks = [{
  label: 'Marketplace',
  icon: '⌘',
  href: 'https://designs.magicpath.ai/v1/kind-door-2236'
}, {
  label: 'Settings',
  icon: '⚙',
  href: 'https://designs.magicpath.ai/v1/bravely-house-8015'
}];
const views: {
  label: View;
  icon: string;
}[] = [{
  label: 'Contacts & Companies',
  icon: '♙'
}, {
  label: 'Leads & Deals',
  icon: '◈'
}, {
  label: 'Notes',
  icon: '▤'
}, {
  label: 'Import Contacts',
  icon: '⇧'
}];
const initialContacts: Contact[] = [{
  id: 1,
  name: 'Sophie Laurent',
  initials: 'SL',
  email: 'sophie@northstar.studio',
  phone: '+49 151 248 991',
  company: 'Northstar Studio',
  role: 'Creative Director',
  source: 'Website form',
  stage: 'Qualified',
  owner: 'Jamie Morgan',
  lastTouch: 'Today, 09:42',
  tone: 'violet',
  tags: ['Design', 'Warm']
}, {
  id: 2,
  name: 'Daniel Chen',
  initials: 'DC',
  email: 'daniel@atlaslogistics.co',
  phone: '+49 176 830 442',
  company: 'Atlas Logistics',
  role: 'Operations Lead',
  source: 'Referral',
  stage: 'Customer',
  owner: 'Jamie Morgan',
  lastTouch: 'Yesterday, 16:18',
  tone: 'blue',
  tags: ['Logistics', 'VIP']
}, {
  id: 3,
  name: 'Mila Rossi',
  initials: 'MR',
  email: 'mila@roamandroot.com',
  phone: '+49 160 441 720',
  company: 'Roam & Root',
  role: 'Founder',
  source: 'Instagram',
  stage: 'New',
  owner: 'Alex Rivera',
  lastTouch: 'Yesterday, 11:05',
  tone: 'peach',
  tags: ['Retail']
}, {
  id: 4,
  name: 'Tobias Klein',
  initials: 'TK',
  email: 'tobias@klarwerk.de',
  phone: '+49 171 927 006',
  company: 'Klarwerk GmbH',
  role: 'Finance Manager',
  source: 'Import',
  stage: 'Follow-up',
  owner: 'Jamie Morgan',
  lastTouch: 'Mon, 14:30',
  tone: 'mint',
  tags: ['Finance', 'Follow-up']
}, {
  id: 5,
  name: 'Elena Schmidt',
  initials: 'ES',
  email: 'elena@hausamfluss.de',
  phone: '+49 172 105 819',
  company: 'Haus am Fluss',
  role: 'Managing Director',
  source: 'Email',
  stage: 'Qualified',
  owner: 'Alex Rivera',
  lastTouch: 'Mon, 10:12',
  tone: 'coral',
  tags: ['Hospitality']
}];
const companies = [{
  name: 'Northstar Studio',
  domain: 'northstar.studio',
  people: 8,
  segment: 'Creative services',
  value: '€48,000',
  owner: 'Jamie Morgan',
  health: 'Strong'
}, {
  name: 'Atlas Logistics',
  domain: 'atlaslogistics.co',
  people: 23,
  segment: 'Logistics',
  value: '€96,500',
  owner: 'Jamie Morgan',
  health: 'Strong'
}, {
  name: 'Roam & Root',
  domain: 'roamandroot.com',
  people: 4,
  segment: 'Retail',
  value: '€18,200',
  owner: 'Alex Rivera',
  health: 'Watch'
}, {
  name: 'Klarwerk GmbH',
  domain: 'klarwerk.de',
  people: 14,
  segment: 'Finance',
  value: '€31,800',
  owner: 'Jamie Morgan',
  health: 'New'
}];
const deals = [{
  name: 'Northstar annual workspace',
  company: 'Northstar Studio',
  contact: 'Sophie Laurent',
  value: '€24,000',
  stage: 'Proposal',
  probability: '70%',
  close: '28 Oct',
  tone: 'violet'
}, {
  name: 'Atlas operations rollout',
  company: 'Atlas Logistics',
  contact: 'Daniel Chen',
  value: '€42,500',
  stage: 'Negotiation',
  probability: '85%',
  close: '04 Nov',
  tone: 'blue'
}, {
  name: 'Roam & Root launch',
  company: 'Roam & Root',
  contact: 'Mila Rossi',
  value: '€12,800',
  stage: 'Qualified',
  probability: '40%',
  close: '18 Nov',
  tone: 'peach'
}, {
  name: 'Klarwerk finance workspace',
  company: 'Klarwerk GmbH',
  contact: 'Tobias Klein',
  value: '€18,600',
  stage: 'New',
  probability: '20%',
  close: '02 Dec',
  tone: 'mint'
}];
const initialActivities = [{
  icon: '✉',
  title: 'Reply received from Sophie Laurent',
  meta: 'Northstar Studio · Email',
  time: '12 min ago',
  tone: 'violet'
}, {
  icon: '◷',
  title: 'Discovery call scheduled with Daniel Chen',
  meta: 'Atlas Logistics · Calendar',
  time: '1 hr ago',
  tone: 'blue'
}, {
  icon: '✓',
  title: 'Follow-up task completed by Alex Rivera',
  meta: 'Roam & Root · Task',
  time: 'Yesterday',
  tone: 'mint'
}, {
  icon: '✦',
  title: 'AI identified a warm buying signal',
  meta: 'Klarwerk GmbH · Analysis',
  time: 'Yesterday',
  tone: 'peach'
}];
const initialNotes = [{
  title: 'Northstar decision criteria',
  body: 'They care most about approval flows and the shared workspace.',
  author: 'Jamie Morgan',
  time: 'Today, 09:18',
  visibility: 'Shared'
}, {
  title: 'Klarwerk next step',
  body: 'Send finance workflow example before the next call.',
  author: 'Alex Rivera',
  time: 'Yesterday, 15:40',
  visibility: 'Private'
}, {
  title: 'Roam & Root context',
  body: 'Founder prefers short, visual updates and async follow-up.',
  author: 'Jamie Morgan',
  time: 'Mon, 11:22',
  visibility: 'Shared'
}];
function Avatar({
  initials,
  tone = 'violet',
  small = false
}: {
  initials: string;
  tone?: string;
  small?: boolean;
}) {
  return <span className={`crm-avatar ${tone} ${small ? 'small' : ''}`}>{initials}</span>;
}
function Pill({
  children,
  tone = 'neutral'
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`crm-pill ${tone}`}>{children}</span>;
}
function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return <div className="crm-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}><div className={`crm-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true"><div className="crm-modal-head"><div><span className="crm-eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="crm-close" type="button" onClick={onClose} aria-label="Close">×</button></div>{children}</div></div>;
}
export const LuluCRM = () => {
  const [view, setView] = useState<View>('Contacts & Companies');
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [directoryTab, setDirectoryTab] = useState<'All' | 'Contacts' | 'Companies'>('All');
  const [directorySearch, setDirectorySearch] = useState('');
  const [pipelineTab, setPipelineTab] = useState<'Leads' | 'Deals'>('Leads');
  const [showContactModal, setShowContactModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [toast, setToast] = useState('');
  const [contactDraft, setContactDraft] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    role: '',
    source: 'Website form',
    stage: 'New',
    owner: 'Jamie Morgan'
  });
  const [noteDraft, setNoteDraft] = useState({
    title: '',
    body: '',
    visibility: 'Shared'
  });
  const [noteTarget, setNoteTarget] = useState('Workspace');
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload');
  const [importFile, setImportFile] = useState('');
  const [aiContact, setAiContact] = useState(initialContacts[0].id);
  const [aiRunning, setAiRunning] = useState(false);
  const [directoryAiGenerated, setDirectoryAiGenerated] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const currentTitle = view;
  const currentDescription: Record<View, string> = {
    'Contacts & Companies': 'Manage people and company accounts together, without losing the context between them.',
    'Leads & Deals': 'Qualify relationships and move opportunities forward in one connected workflow.',
    Notes: 'Capture decisions and context where the team can actually use them.',
    'Import Contacts': 'Bring existing relationships into Lulu with a safe, reviewable import.'
  };
  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }
  function addContact(event: React.FormEvent) {
    event.preventDefault();
    const name = contactDraft.name.trim() || 'New contact';
    const initials = name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
    const newContact: Contact = {
      id: Date.now(),
      name,
      initials,
      email: contactDraft.email || 'No email added',
      phone: contactDraft.phone || 'No phone added',
      company: contactDraft.company || 'Unassigned company',
      role: contactDraft.role || 'Contact',
      source: contactDraft.source,
      stage: contactDraft.stage,
      owner: contactDraft.owner,
      lastTouch: 'Just now',
      tone: 'violet',
      tags: ['New']
    };
    setContacts(current => [newContact, ...current]);
    setContactDraft({
      name: '',
      email: '',
      phone: '',
      company: '',
      role: '',
      source: 'Website form',
      stage: 'New',
      owner: 'Jamie Morgan'
    });
    setShowContactModal(false);
    showToast(`${name} was added to Contacts.`);
  }
  function submitImport(event: React.FormEvent) {
    event.preventDefault();
    if (importStep === 'upload') {
      setImportStep('preview');
      setImportFile('contacts-northstar.csv');
      return;
    }
    setShowImportModal(false);
    setImportStep('upload');
    showToast('Import complete. 24 contacts were added and 3 duplicates were held for review.');
  }
  function runAiAnalysis() {
    setDirectoryAiGenerated(false);
    setAiRunning(true);
    window.setTimeout(() => {
      setAiRunning(false);
      setDirectoryAiGenerated(true);
      showToast('AI analysis ready. Review the recommendations before saving.');
    }, 850);
  }
  function createNote(event: React.FormEvent) {
    event.preventDefault();
    setShowNoteModal(false);
    setNoteDraft({
      title: '',
      body: '',
      visibility: 'Shared'
    });
    showToast(`Note saved to ${noteTarget}.`);
  }
  function renderDirectory() {
    type DirectoryRow = {
      kind: 'Contact' | 'Company';
      id: string;
      name: string;
      initials: string;
      tone: string;
      detail: string;
      context: string;
      status: string;
      owner: string;
      lastActivity: string;
      contact?: Contact;
      company?: typeof companies[number];
    };
    const query = directorySearch.trim().toLowerCase();
    const rows: DirectoryRow[] = [...contacts.map(contact => ({
      kind: 'Contact' as const,
      id: `contact-${contact.id}`,
      name: contact.name,
      initials: contact.initials,
      tone: contact.tone,
      detail: contact.email,
      context: `${contact.company} · ${contact.role}`,
      status: contact.stage,
      owner: contact.owner,
      lastActivity: contact.lastTouch,
      contact
    })), ...companies.map(company => ({
      kind: 'Company' as const,
      id: `company-${company.name}`,
      name: company.name,
      initials: company.name.split(' ').map(part => part[0]).join('').slice(0, 2),
      tone: 'blue',
      detail: company.domain,
      context: `${company.people} contacts · ${company.segment}`,
      status: company.health,
      owner: company.owner,
      lastActivity: company.value,
      company
    }))].filter(row => {
      const kindMatches = directoryTab === 'All' || directoryTab === 'Contacts' && row.kind === 'Contact' || directoryTab === 'Companies' && row.kind === 'Company';
      const textMatches = !query || `${row.name} ${row.detail} ${row.context} ${row.owner} ${row.status}`.toLowerCase().includes(query);
      return kindMatches && textMatches;
    });
    return <section className="crm-card crm-table-card"><div className="crm-toolbar"><div><span className="crm-eyebrow">RELATIONSHIP DIRECTORY</span><h2>People and companies, together.</h2><p className="crm-toolbar-copy">Connect every person to the account, context and commercial history behind the relationship.</p></div><div className="crm-toolbar-actions"><button className="crm-outline-button" type="button" onClick={() => setShowImportModal(true)}>⇧ Import contacts</button><button className="crm-outline-button" type="button" onClick={() => setShowCompanyModal(true)}>＋ Add company</button><button className="crm-primary-button" type="button" onClick={() => setShowContactModal(true)}>＋ Add contact</button></div></div><div className="crm-directory-controls"><div className="crm-search"><span>⌕</span><input value={directorySearch} onChange={event => setDirectorySearch(event.target.value)} placeholder="Search people, companies, domains or tags" /></div><div className="crm-filter-row"><button className={`crm-filter ${directoryTab === 'All' ? 'active' : ''}`} type="button" onClick={() => setDirectoryTab('All')}>All <b>{contacts.length + companies.length}</b></button><button className={`crm-filter ${directoryTab === 'Contacts' ? 'active' : ''}`} type="button" onClick={() => setDirectoryTab('Contacts')}>Contacts <b>{contacts.length}</b></button><button className={`crm-filter ${directoryTab === 'Companies' ? 'active' : ''}`} type="button" onClick={() => setDirectoryTab('Companies')}>Companies <b>{companies.length}</b></button><button className="crm-filter" type="button" onClick={() => showToast('Showing records that need follow-up.')}>Needs follow-up <b>7</b></button><button className="crm-filter" type="button" onClick={() => showToast('More relationship filters opened.')}>＋ Filter</button></div></div><div className="crm-table-scroll"><table className="crm-table"><thead><tr><th><input type="checkbox" aria-label="Select all records" /></th><th>Record</th><th>Relationship context</th><th>Status</th><th>Owner</th><th>Last activity / value</th><th /></tr></thead><tbody>{rows.map(row => <tr key={row.id} onClick={() => row.kind === 'Contact' && row.contact ? setSelectedContact(row.contact) : showToast(`${row.name} company profile opened.`)}><td><input type="checkbox" onClick={event => event.stopPropagation()} aria-label={`Select ${row.name}`} /></td><td><div className="crm-table-person"><Avatar initials={row.initials} tone={row.tone} small /><span><strong>{row.name}</strong><small>{row.kind} · {row.detail}</small></span></div></td><td><strong>{row.context.split(' · ')[0]}</strong><small>{row.context.split(' · ').slice(1).join(' · ')}</small></td><td><Pill tone={row.kind === 'Company' ? row.status === 'Strong' ? 'success' : row.status === 'Watch' ? 'warning' : 'violet' : row.status === 'Customer' ? 'success' : row.status === 'Qualified' ? 'violet' : row.status === 'Follow-up' ? 'warning' : 'neutral'}>{row.status}</Pill></td><td><div className="crm-owner"><Avatar initials={row.owner.split(' ').map(part => part[0]).join('')} tone="mint" small />{row.owner}</div></td><td>{row.lastActivity}</td><td><button className="crm-row-menu" type="button" onClick={event => {
                  event.stopPropagation();
                  row.kind === 'Contact' && row.contact ? setSelectedContact(row.contact) : showToast(`${row.name} company profile opened.`);
                }}>•••</button></td></tr>)}</tbody></table></div>{rows.length === 0 && <div className="crm-empty">No people or companies match your search.</div>}<div className="crm-table-footer"><span>Showing {rows.length} of {contacts.length + companies.length} records</span><div><button className="crm-page-button" type="button">‹</button><button className="crm-page-button active" type="button">1</button><button className="crm-page-button" type="button">2</button><button className="crm-page-button" type="button">›</button></div></div></section>;
  }
  function renderDirectoryActions() {
    const selectedAiContact = contacts.find(item => item.id === aiContact) || contacts[0];
    const recordOptions = [...contacts.map(item => item.name), ...companies.map(item => item.name)];
    return <div className="crm-directory-actions"><section className="crm-card crm-directory-action-card"><div className="crm-directory-action-icon">▤</div><div className="crm-directory-action-copy"><span className="crm-eyebrow">NOTES</span><h3>Keep context on the record</h3><p>Add a shared or private note directly from Contacts &amp; Companies.</p><select value={noteTarget} onChange={event => setNoteTarget(event.target.value)}>{recordOptions.map(record => <option value={record} key={record}>{record}</option>)}</select><button className="crm-outline-button" type="button" onClick={() => setShowNoteModal(true)}>＋ Add note</button></div></section><section className="crm-card crm-directory-action-card crm-directory-ai-card"><div className="crm-directory-action-icon ai">✦</div><div className="crm-directory-action-copy"><span className="crm-eyebrow">AI ANALYSIS</span><h3>Generate relationship intelligence</h3><p>Review signals, data quality and the next best action without leaving the directory.</p><select value={aiContact} onChange={event => {
            setAiContact(Number(event.target.value));
            setDirectoryAiGenerated(false);
          }}>{contacts.map(item => <option value={item.id} key={item.id}>{item.name} · {item.company}</option>)}</select><button className="crm-primary-button" type="button" onClick={runAiAnalysis}>{aiRunning ? 'Analyzing…' : 'Generate AI analysis'}</button>{directoryAiGenerated && <div className="crm-inline-ai-result"><strong>{selectedAiContact.name}</strong><span>Active relationship · recommended next step: send a tailored follow-up.</span><small>4 of 5 profile fields complete · review before saving.</small></div>}</div></section></div>;
  }
  function renderLeadsDeals() {
    return <>
      <section className="crm-card crm-pipeline-switcher"><div className="crm-card-head"><div><span className="crm-eyebrow">CONNECTED PIPELINE</span><h2>Leads become opportunities.</h2><p className="crm-toolbar-copy">Switch between qualification and revenue without leaving the same workflow.</p></div><div className="crm-segmented-control"><button className={pipelineTab === 'Leads' ? 'active' : ''} type="button" onClick={() => setPipelineTab('Leads')}>Leads <b>31</b></button><button className={pipelineTab === 'Deals' ? 'active' : ''} type="button" onClick={() => setPipelineTab('Deals')}>Deals &amp; Pipeline <b>{deals.length}</b></button></div></div></section>
      {pipelineTab === 'Leads' ? renderLeads() : renderDeals()}
    </>;
  }
  function renderLeads() {
    const leadColumns = [{
      title: 'New',
      count: '12',
      leads: [contacts[2]]
    }, {
      title: 'Qualified',
      count: '08',
      leads: [contacts[0], contacts[4]]
    }, {
      title: 'Follow-up',
      count: '07',
      leads: [contacts[3]]
    }, {
      title: 'Converted',
      count: '24',
      leads: [contacts[1]]
    }];
    return <section className="crm-card crm-kanban-card"><div className="crm-toolbar"><div><span className="crm-eyebrow">LEAD WORKSPACE</span><h2>Qualify with less guesswork.</h2><p className="crm-toolbar-copy">Move a lead when the context changes. Every card keeps its next action visible.</p></div><button className="crm-primary-button" type="button" onClick={() => setShowContactModal(true)}>＋ Add lead</button></div><div className="crm-kanban-grid">{leadColumns.map(column => <div className="crm-kanban-column" key={column.title}><div className="crm-kanban-head"><span><strong>{column.title}</strong><b>{column.count}</b></span><button className="crm-icon-button" type="button">＋</button></div>{column.leads.map(lead => <button className="crm-lead-card" type="button" key={lead.id} onClick={() => setSelectedContact(lead)}><div><Avatar initials={lead.initials} tone={lead.tone} small /><span><strong>{lead.name}</strong><small>{lead.company}</small></span></div><p>{lead.role} · {lead.source}</p><footer><Pill tone={lead.stage === 'Customer' ? 'success' : lead.stage === 'Qualified' ? 'violet' : 'neutral'}>{lead.stage}</Pill><span>{lead.lastTouch}</span></footer></button>)}<button className="crm-add-card" type="button" onClick={() => setShowContactModal(true)}>＋ Add lead</button></div>)}</div></section>;
  }
  function renderDeals() {
    const stages = ['New', 'Qualified', 'Proposal', 'Negotiation'];
    return <section className="crm-card crm-kanban-card"><div className="crm-toolbar"><div><span className="crm-eyebrow">DEAL PIPELINE</span><h2>Move opportunities forward.</h2><p className="crm-toolbar-copy">Every deal has an owner, a value and a next step.</p></div><div className="crm-toolbar-actions"><button className="crm-outline-button" type="button">▤ Table view</button><button className="crm-primary-button" type="button" onClick={() => setShowDealModal(true)}>＋ Add deal</button></div></div><div className="crm-deal-summary"><span><b>€97.9k</b> open value</span><span><b>63%</b> weighted win rate</span><span><b>11</b> active deals</span><span><b>14 days</b> average close</span></div><div className="crm-kanban-grid deals">{stages.map(stage => <div className="crm-kanban-column" key={stage}><div className="crm-kanban-head"><span><strong>{stage}</strong><b>{deals.filter(deal => deal.stage === stage).length || (stage === 'New' ? 1 : 1)}</b></span><button className="crm-icon-button" type="button">＋</button></div>{deals.filter(deal => deal.stage === stage).map(deal => <button className="crm-deal-card" type="button" key={deal.name}><div className="crm-deal-card-top"><span className={`crm-deal-dot ${deal.tone}`} /><strong>{deal.name}</strong><span>•••</span></div><small>{deal.company} · {deal.contact}</small><strong className="crm-deal-value">{deal.value}</strong><div className="crm-deal-progress"><i style={{
                width: deal.probability
              }} /></div><footer><span>{deal.probability} likely</span><span>Close {deal.close}</span></footer></button>)}<button className="crm-add-card" type="button" onClick={() => setShowDealModal(true)}>＋ Add deal</button></div>)}</div></section>;
  }
  function renderNotes() {
    return <section className="crm-card crm-notes-card"><div className="crm-toolbar"><div><span className="crm-eyebrow">WORKSPACE NOTES</span><h2>Context that does not get lost.</h2><p className="crm-toolbar-copy">Keep shared decisions and private reminders next to the relationships they belong to.</p></div><button className="crm-primary-button" type="button" onClick={() => setShowNoteModal(true)}>＋ Add note</button></div><div className="crm-notes-grid">{initialNotes.map(note => <button className="crm-note-card" type="button" key={note.title} onClick={() => setShowNoteModal(true)}><div className="crm-note-card-top"><span className="crm-note-mark">▤</span><Pill tone={note.visibility === 'Shared' ? 'violet' : 'neutral'}>{note.visibility}</Pill></div><h3>{note.title}</h3><p>{note.body}</p><footer><Avatar initials={note.author.split(' ').map(part => part[0]).join('')} tone="mint" small /><span>{note.author}<small>{note.time}</small></span></footer></button>)}</div></section>;
  }
  function renderImport() {
    return <div className="crm-import-layout"><section className="crm-card crm-import-card"><div className="crm-card-head"><div><span className="crm-eyebrow">CONTACT IMPORT</span><h2>Bring your relationships into Lulu.</h2><p className="crm-toolbar-copy">Upload a CSV or Excel file, map the fields, review duplicates and confirm only when everything looks right.</p></div><button className="crm-primary-button" type="button" onClick={() => setShowImportModal(true)}>⇧ Open import wizard</button></div><div className="crm-upload-panel" onClick={() => setShowImportModal(true)}><span className="crm-upload-icon">⇧</span><strong>Drop a CSV or Excel file here</strong><small>or choose a file from your computer · maximum 10,000 rows</small><span className="crm-outline-button">Choose file</span></div><div className="crm-import-stages"><div className="active"><span>1</span><strong>Upload</strong><small>CSV or XLSX</small></div><div><span>2</span><strong>Map fields</strong><small>Review matches</small></div><div><span>3</span><strong>Check quality</strong><small>Find duplicates</small></div><div><span>4</span><strong>Confirm</strong><small>Save contacts</small></div></div></section><section className="crm-card crm-import-side"><span className="crm-eyebrow">SAFE BY DEFAULT</span><h2>Nothing changes before review.</h2><ul className="crm-check-list"><li><span>✓</span> Preview every mapped field</li><li><span>✓</span> Hold possible duplicates</li><li><span>✓</span> Keep the original source</li><li><span>✓</span> Assign owners and tags</li></ul><div className="crm-info-strip"><span>i</span><p>Imported contacts inherit your workspace privacy and consent rules.</p></div></section></div>;
  }
  function renderView() {
    if (view === 'Contacts & Companies') return <>{renderDirectory()}{renderDirectoryActions()}</>;
    if (view === 'Leads & Deals') return renderLeadsDeals();
    if (view === 'Notes') return renderNotes();
    if (view === 'Import Contacts') return renderImport();
    return renderDirectory();
  }
  return <div className="crm-app-shell">
    <aside className="crm-rail">
      <div className="crm-brand"><img src={brandLogo} alt="Lulu" /><div><strong>Lulu</strong><span>Growth OS</span></div></div>
      <span className="crm-rail-label">WORKSPACE</span>
      <nav className="crm-global-top">{workspaceLinks.map(link => <button className="crm-muted-nav" type="button" onClick={() => window.location.assign(link.href)} key={link.label}><span className="crm-global-icon">{link.icon}</span><span>{link.label}</span><b>⌄</b></button>)}</nav>
      <button className="crm-module-switcher" type="button" onClick={() => setRailOpen(open => !open)}><span className="crm-module-icon">♧</span><span>CRM</span><span className="crm-chevron">{railOpen ? '⌃' : '⌄'}</span></button>
      {railOpen && <nav className="crm-nav">{views.map(item => <button className={`crm-nav-item ${view === item.label ? 'active' : ''}`} type="button" key={item.label} onClick={() => {
          setView(item.label);
          setSelectedContact(null);
        }}><span className="crm-nav-icon">{item.icon}</span><span>{item.label}</span>{item.label === 'Contacts & Companies' && <b>{contacts.length + companies.length}</b>}</button>)}</nav>}
      <div className="crm-rail-spacer" />
      <div className="crm-rail-section crm-global-modules"><span className="crm-rail-label">MODULES</span>{moduleLinks.map(link => <button className="crm-muted-nav" type="button" onClick={() => window.location.assign(link.href)} key={link.label}><span className="crm-global-icon">{link.icon}</span><span>{link.label}</span>{link.label === 'Marketplace' && <b>⌄</b>}</button>)}</div>
    </aside>
    <main className="crm-main">
      <header className="crm-topbar"><div className="crm-breadcrumb"><span>Lulu</span><i>/</i><strong>CRM</strong><i>/</i><strong>{currentTitle}</strong></div><div className="crm-top-actions"><div className="crm-top-search"><span>⌕</span><input placeholder="Search this workspace" /></div></div></header>
      <div className="crm-layout"><div className="crm-content"><div className="crm-page-intro"><div><span className="crm-eyebrow">LULU CRM · {currentTitle.toUpperCase()}</span><h1>{currentTitle}</h1><p>{currentDescription[view]}</p></div><div className="crm-intro-actions">{view === 'Contacts & Companies' ? <><button className="crm-outline-button" type="button" onClick={() => setShowCompanyModal(true)}>＋ Add company</button><button className="crm-primary-button" type="button" onClick={() => setShowContactModal(true)}>＋ Add contact</button></> : view === 'Leads & Deals' ? pipelineTab === 'Leads' ? <button className="crm-primary-button" type="button" onClick={() => setShowContactModal(true)}>＋ Add lead</button> : <button className="crm-primary-button" type="button" onClick={() => setShowDealModal(true)}>＋ Add deal</button> : view === 'Notes' ? <button className="crm-primary-button" type="button" onClick={() => setShowNoteModal(true)}>＋ Add note</button> : null}</div></div>{renderView()}</div></div>
    </main>

    {selectedContact && <div className="crm-overlay" onMouseDown={event => event.target === event.currentTarget && setSelectedContact(null)}><aside className="crm-drawer"><div className="crm-modal-head"><div><span className="crm-eyebrow">CONTACT PROFILE</span><h2>{selectedContact.name}</h2></div><button className="crm-close" type="button" onClick={() => setSelectedContact(null)}>×</button></div><div className="crm-drawer-profile"><Avatar initials={selectedContact.initials} tone={selectedContact.tone} /><div><strong>{selectedContact.role}</strong><span>{selectedContact.company}</span><Pill tone={selectedContact.stage === 'Customer' ? 'success' : 'violet'}>{selectedContact.stage}</Pill></div></div><div className="crm-drawer-actions"><button className="crm-outline-button" type="button" onClick={() => showToast('Email composer opened.')}>✉ Email</button><button className="crm-outline-button" type="button" onClick={() => showToast('Task created for this contact.')}>＋ Task</button><button className="crm-primary-button" type="button" onClick={() => showToast('Contact editing opened.')}>Edit contact</button></div><div className="crm-detail-list"><div><span>Email</span><strong>{selectedContact.email}</strong></div><div><span>Phone</span><strong>{selectedContact.phone}</strong></div><div><span>Owner</span><strong>{selectedContact.owner}</strong></div><div><span>Source</span><strong>{selectedContact.source}</strong></div><div><span>Last touch</span><strong>{selectedContact.lastTouch}</strong></div></div><div className="crm-drawer-section"><div className="crm-card-head"><div><span className="crm-eyebrow">TIMELINE</span><h3>Relationship context</h3></div><button className="crm-text-button" type="button" onClick={() => setShowNoteModal(true)}>＋ Note</button></div><div className="crm-mini-timeline"><p><b>✉</b><span><strong>Email received</strong><small>Sophie replied to the latest proposal.</small></span><time>12 min ago</time></p><p><b>◷</b><span><strong>Meeting scheduled</strong><small>Discovery call is on the calendar.</small></span><time>Yesterday</time></p><p><b>✦</b><span><strong>AI signal</strong><small>Buying intent increased after the reply.</small></span><time>Yesterday</time></p></div></div></aside></div>}
    {showContactModal && <Modal eyebrow="NEW CONTACT" title="Add a relationship to Lulu" onClose={() => setShowContactModal(false)}><form className="crm-form" onSubmit={addContact}><div className="crm-form-grid"><label><span>Full name</span><input autoFocus value={contactDraft.name} onChange={event => setContactDraft({
              ...contactDraft,
              name: event.target.value
            })} placeholder="e.g. Jamie Morgan" required /></label><label><span>Work email</span><input type="email" value={contactDraft.email} onChange={event => setContactDraft({
              ...contactDraft,
              email: event.target.value
            })} placeholder="name@company.com" /></label><label><span>Phone</span><input value={contactDraft.phone} onChange={event => setContactDraft({
              ...contactDraft,
              phone: event.target.value
            })} placeholder="+49 ..." /></label><label><span>Company</span><input value={contactDraft.company} onChange={event => setContactDraft({
              ...contactDraft,
              company: event.target.value
            })} placeholder="Company name" /></label><label><span>Role</span><input value={contactDraft.role} onChange={event => setContactDraft({
              ...contactDraft,
              role: event.target.value
            })} placeholder="Role or department" /></label><label><span>Source</span><select value={contactDraft.source} onChange={event => setContactDraft({
              ...contactDraft,
              source: event.target.value
            })}><option>Website form</option><option>Referral</option><option>Email</option><option>Import</option><option>Marketplace</option></select></label><label><span>Lifecycle stage</span><select value={contactDraft.stage} onChange={event => setContactDraft({
              ...contactDraft,
              stage: event.target.value
            })}><option>New</option><option>Qualified</option><option>Follow-up</option><option>Customer</option></select></label><label><span>Owner</span><select value={contactDraft.owner} onChange={event => setContactDraft({
              ...contactDraft,
              owner: event.target.value
            })}><option>Jamie Morgan</option><option>Alex Rivera</option></select></label></div><div className="crm-form-foot"><span>Required fields are marked by the browser.</span><div><button className="crm-outline-button" type="button" onClick={() => setShowContactModal(false)}>Cancel</button><button className="crm-primary-button" type="submit">Create contact</button></div></div></form></Modal>}
    {showImportModal && <Modal eyebrow={importStep === 'upload' ? 'IMPORT CONTACTS' : 'REVIEW IMPORT'} title={importStep === 'upload' ? 'Bring a list into Lulu' : 'Review before anything changes'} onClose={() => {
      setShowImportModal(false);
      setImportStep('upload');
    }} wide><form className="crm-form" onSubmit={submitImport}>{importStep === 'upload' ? <><div className="crm-upload-modal"><span className="crm-upload-icon">⇧</span><strong>Drop your CSV or Excel file here</strong><small>{importFile || 'CSV and XLSX files up to 10,000 rows'}</small><button className="crm-outline-button" type="button" onClick={() => setImportFile('contacts-northstar.csv')}>{importFile ? 'Change file' : 'Choose file'}</button></div><div className="crm-import-options"><label><span>Default owner</span><select defaultValue="Jamie Morgan"><option>Jamie Morgan</option><option>Alex Rivera</option></select></label><label><span>Apply tag</span><input placeholder="e.g. Imported 2026" /></label><label><span>Duplicate handling</span><select defaultValue="Hold for review"><option>Hold for review</option><option>Skip duplicates</option><option>Update existing records</option></select></label></div></> : <><div className="crm-import-file-row"><span className="crm-file-icon">CSV</span><div><strong>{importFile}</strong><small>24 contacts · 8 fields recognized</small></div><Pill tone="success">Ready to review</Pill></div><div className="crm-mapping-table"><div><span>Source column</span><span>Lulu field</span><span>Example</span></div>{[['full_name', 'Full name', 'Sophie Laurent'], ['work_email', 'Work email', 'sophie@northstar.studio'], ['company', 'Company', 'Northstar Studio'], ['job_title', 'Role', 'Creative Director'], ['phone', 'Phone', '+49 151 248 991']].map(row => <div key={row[0]}><strong>{row[0]}</strong><select defaultValue={row[1]}><option>{row[1]}</option><option>Ignore column</option></select><span>{row[2]}</span></div>)}</div><div className="crm-duplicate-banner"><span>!</span><div><strong>3 possible duplicates will be held</strong><small>Review them after the import without overwriting any existing data.</small></div></div></>}<div className="crm-form-foot"><span>{importStep === 'upload' ? 'You can review field matches before importing.' : '24 new contacts will be added.'}</span><div><button className="crm-outline-button" type="button" onClick={() => importStep === 'preview' ? setImportStep('upload') : setShowImportModal(false)}>{importStep === 'preview' ? 'Back' : 'Cancel'}</button><button className="crm-primary-button" type="submit">{importStep === 'upload' ? 'Review import' : 'Confirm import'}</button></div></div></form></Modal>}
    {showTaskModal && <Modal eyebrow="NEW TASK" title="Create a follow-up" onClose={() => setShowTaskModal(false)}><form className="crm-form" onSubmit={event => {
        event.preventDefault();
        setShowTaskModal(false);
        showToast('Task added to Activities.');
      }}><div className="crm-form-grid"><label className="full"><span>Task title</span><input autoFocus placeholder="What needs to happen?" required /></label><label><span>Related contact</span><select defaultValue="Sophie Laurent"><option>Sophie Laurent · Northstar Studio</option><option>Daniel Chen · Atlas Logistics</option><option>Mila Rossi · Roam & Root</option></select></label><label><span>Due date</span><input type="date" defaultValue="2026-10-17" /></label><label><span>Owner</span><select defaultValue="Jamie Morgan"><option>Jamie Morgan</option><option>Alex Rivera</option></select></label><label><span>Priority</span><select defaultValue="High"><option>High</option><option>Normal</option><option>Low</option></select></label></div><div className="crm-form-foot"><span>Tasks appear in the shared activity timeline.</span><div><button className="crm-outline-button" type="button" onClick={() => setShowTaskModal(false)}>Cancel</button><button className="crm-primary-button" type="submit">Create task</button></div></div></form></Modal>}
    {showNoteModal && <Modal eyebrow="NEW NOTE" title="Keep the context close" onClose={() => setShowNoteModal(false)}><form className="crm-form" onSubmit={createNote}><div className="crm-form-grid"><label><span>Related record</span><select value={noteTarget} onChange={event => setNoteTarget(event.target.value)}>{[...contacts.map(item => item.name), ...companies.map(item => item.name)].map(record => <option value={record} key={record}>{record}</option>)}</select></label><label><span>Visibility</span><select value={noteDraft.visibility} onChange={event => setNoteDraft({
              ...noteDraft,
              visibility: event.target.value
            })}><option>Shared</option><option>Private</option></select></label><label className="full"><span>Title</span><input autoFocus value={noteDraft.title} onChange={event => setNoteDraft({
              ...noteDraft,
              title: event.target.value
            })} placeholder="What should the team remember?" required /></label><label className="full"><span>Note</span><textarea value={noteDraft.body} onChange={event => setNoteDraft({
              ...noteDraft,
              body: event.target.value
            })} placeholder="Add a decision, handoff or next action" rows={6} /></label></div><div className="crm-form-foot"><span>This note will stay connected to {noteTarget}.</span><div><button className="crm-outline-button" type="button" onClick={() => setShowNoteModal(false)}>Cancel</button><button className="crm-primary-button" type="submit">Save note</button></div></div></form></Modal>}
    {showDealModal && <Modal eyebrow="NEW DEAL" title="Add an opportunity" onClose={() => setShowDealModal(false)}><form className="crm-form" onSubmit={event => {
        event.preventDefault();
        setShowDealModal(false);
        showToast('Deal added to the pipeline.');
      }}><div className="crm-form-grid"><label className="full"><span>Deal name</span><input autoFocus placeholder="e.g. Northstar annual workspace" required /></label><label><span>Company</span><select defaultValue="Northstar Studio"><option>Northstar Studio</option><option>Atlas Logistics</option><option>Roam & Root</option><option>Klarwerk GmbH</option></select></label><label><span>Contact</span><select defaultValue="Sophie Laurent"><option>Sophie Laurent</option><option>Daniel Chen</option><option>Mila Rossi</option></select></label><label><span>Value</span><input placeholder="€ 0.00" /></label><label><span>Expected close</span><input type="date" defaultValue="2026-11-04" /></label><label><span>Stage</span><select defaultValue="New"><option>New</option><option>Qualified</option><option>Proposal</option><option>Negotiation</option></select></label><label><span>Owner</span><select defaultValue="Jamie Morgan"><option>Jamie Morgan</option><option>Alex Rivera</option></select></label></div><div className="crm-form-foot"><span>Every deal keeps the next step visible.</span><div><button className="crm-outline-button" type="button" onClick={() => setShowDealModal(false)}>Cancel</button><button className="crm-primary-button" type="submit">Create deal</button></div></div></form></Modal>}
    {showCompanyModal && <Modal eyebrow="NEW COMPANY" title="Add an account" onClose={() => setShowCompanyModal(false)}><form className="crm-form" onSubmit={event => {
        event.preventDefault();
        setShowCompanyModal(false);
        showToast('Company added to the directory.');
      }}><div className="crm-form-grid"><label className="full"><span>Company name</span><input autoFocus placeholder="e.g. Northstar Studio" required /></label><label><span>Domain</span><input placeholder="company.com" /></label><label><span>Industry</span><select defaultValue="Creative services"><option>Creative services</option><option>Logistics</option><option>Retail</option><option>Finance</option></select></label><label><span>Company size</span><select defaultValue="1–10"><option>1–10</option><option>11–50</option><option>51–200</option><option>201+</option></select></label><label><span>Owner</span><select defaultValue="Jamie Morgan"><option>Jamie Morgan</option><option>Alex Rivera</option></select></label></div><div className="crm-form-foot"><span>People can be added from the company record.</span><div><button className="crm-outline-button" type="button" onClick={() => setShowCompanyModal(false)}>Cancel</button><button className="crm-primary-button" type="submit">Create company</button></div></div></form></Modal>}
    {toast && <div className="crm-toast" role="status"><span>✓</span>{toast}</div>}
  </div>;
};