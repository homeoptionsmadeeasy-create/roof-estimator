(() => {
  const $ = (s, el = document) => el.querySelector(s);
  let cfg = null, dirty = false;
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const set = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; };

  // ---- field helpers ----
  const num = (path, label, help, step = 'any') => ({ type: 'number', path, label, help, step });
  const txt = (path, label, help, long) => ({ type: long ? 'textarea' : 'text', path, label, help });
  const bool = (path, label, help) => ({ type: 'checkbox', path, label, help });
  const sel = (path, label, options, help) => ({ type: 'select', path, label, options, help });

  const FORMULA = [
    { title: 'Roof materials', hint: 'Installed price per square (100 sq ft) for each option homeowners can pick. Include labor, underlayment, ice & water, drip edge, ridge, etc.', table: 'materials',
      cols: [['enabled', 'On', 'checkbox'], ['name', 'Name', 'text'], ['description', 'Description', 'text'], ['pricePerSquare', '$ / square', 'number'], ['id', 'ID', 'text']],
      blank: () => ({ id: 'mat-' + Date.now().toString(36), name: 'New material', description: '', pricePerSquare: 500, enabled: true }) },
    { title: 'Low-slope sections', hint: 'Roof planes flatter than this pitch are priced separately (they can\'t take shingles).', fields: [
      num('lowSlope.maxRise', 'Below pitch (rise/12)'), num('lowSlope.pricePerSquare', '$ / square'), txt('lowSlope.label', 'Line item label')] },
    { title: 'Waste factor', hint: 'Waste % = base + (planes over threshold × extra), capped at max. More hips/valleys = more cut waste.', fields: [
      num('waste.basePercent', 'Base waste %'), num('waste.facetThreshold', 'Planes before extra waste'), num('waste.extraPercentPerFacet', 'Extra % per extra plane'), num('waste.maxPercent', 'Max waste %')] },
    { title: 'Steep pitch charges', hint: 'Extra $/square for planes at or above each pitch. A plane uses the highest tier it qualifies for.', table: 'steepPitch',
      cols: [['minRise', 'From pitch (rise/12)', 'number'], ['extraPerSquare', 'Extra $ / square', 'number'], ['label', 'Label', 'text']],
      blank: () => ({ minRise: 12, extraPerSquare: 150, label: 'Extreme pitch (12/12+)' }) },
    { title: 'Stories, tear-off & extras', fields: [
      num('stories.1', '1-story extra $/sq'), num('stories.2', '2-story extra $/sq'), num('stories.3', '3-story extra $/sq'),
      num('tearOff.perSquarePerLayer', 'Tear-off $/sq per layer'), num('tearOff.assumeLayersIfUnknown', 'Layers if "not sure"', '', 1),
      num('extras.perSkylight', '$ per skylight'), num('extras.perChimney', '$ per chimney')] },
    { title: 'Flat fees', hint: 'Added to every job (permits, dumpster, delivery…).', table: 'flatFees',
      cols: [['label', 'Label', 'text'], ['amount', 'Amount $', 'number']], blank: () => ({ label: 'New fee', amount: 0 }) },
    { title: 'Complexity, minimum & range', hint: 'The range shown to homeowners widens when Google\'s imagery quality is lower.', fields: [
      num('complexity.facetThreshold', 'Complex roof if planes over'), num('complexity.extraPercent', 'Complexity surcharge %'),
      num('minimumJob', 'Minimum job $'), num('roundTo', 'Round range to nearest $'),
      num('rangePercentByQuality.HIGH', '± % (HIGH imagery)'), num('rangePercentByQuality.MEDIUM', '± % (MEDIUM imagery)'),
      num('rangePercentByQuality.LOW', '± % (LOW imagery)'), num('rangePercentByQuality.UNKNOWN', '± % (unknown)')] },
    { title: 'Measurement', hint: 'How the Google Solar API data is used.', fields: [
      num('measurement.areaAdjustmentPercent', 'Area adjustment %', 'Adds eaves/overhang Google may not capture'),
      num('measurement.minSegmentSqFt', 'Ignore planes under (sq ft)'),
      num('measurement.maxDistanceFromAddressM', 'Max distance from address (m)', 'Farther = likely the wrong building → manual'),
      sel('measurement.requiredQuality', 'Minimum imagery quality', ['LOW', 'MEDIUM', 'HIGH'], 'LOW = most coverage; best available is always used')] },
    { title: 'Financing & display', fields: [
      bool('financing.enabled', 'Show monthly payment'), num('financing.aprPercent', 'APR %'), num('financing.termMonths', 'Term (months)', '', 1),
      bool('display.showLineItems', 'Show line-item breakdown to homeowners'), bool('display.compareAllMaterials', 'Show price for every material')] },
  ];
  const BRANDING = [
    { title: 'Company', fields: [txt('branding.companyName', 'Company name'), txt('branding.phone', 'Phone'), txt('branding.logoUrl', 'Logo URL'),
      { type: 'color', path: 'branding.primaryColor', label: 'Button color' }, { type: 'color', path: 'branding.accentColor', label: 'Accent color (top bar, highlights)' },
      { type: 'list', path: 'branding.trustItems', label: 'Top bar trust items', help: 'Separate with commas' }] },
    { title: 'Widget text', fields: [txt('branding.headline', 'Headline'), txt('branding.headlineAccent', 'Headline (colored part)'), txt('branding.subheadline', 'Subheadline', '', true),
      txt('branding.ctaText', 'Result button text'), txt('branding.ctaUrl', 'Result button link', 'e.g. your scheduling page')] },
    { title: 'Legal', fields: [txt('branding.consentText', 'Contact consent text', 'Have your attorney review (TCPA)', true), txt('branding.disclaimer', 'Estimate disclaimer', '', true)] },
  ];

  function fieldHtml(f) {
    const v = get(cfg, f.path);
    const help = f.help ? `<span class="field-help">${esc(f.help)}</span>` : '';
    if (f.type === 'checkbox') return `<label><input type="checkbox" data-path="${f.path}" ${v ? 'checked' : ''}> ${esc(f.label)}${help}</label>`;
    if (f.type === 'select') return `<label>${esc(f.label)}<select data-path="${f.path}">${f.options.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>${help}</label>`;
    if (f.type === 'color') return `<label>${esc(f.label)}<input type="color" data-path="${f.path}" value="${esc(v || '#000000')}" style="height:40px;padding:2px">${help}</label>`;
    if (f.type === 'list') return `<label style="grid-column:1/-1">${esc(f.label)}<input type="text" data-path="${f.path}" data-list="1" value="${esc((v || []).join(', '))}">${help}</label>`;
    if (f.type === 'textarea') return `<label style="grid-column:1/-1">${esc(f.label)}<textarea data-path="${f.path}">${esc(v)}</textarea>${help}</label>`;
    return `<label>${esc(f.label)}<input type="${f.type}" ${f.step ? `step="${f.step}"` : ''} data-path="${f.path}" data-num="${f.type === 'number' ? 1 : ''}" value="${esc(v)}">${help}</label>`;
  }
  function tableHtml(sec) {
    const rows = get(cfg, sec.table) || [];
    return `<table class="edit"><tr>${sec.cols.map((c) => `<th>${c[1]}</th>`).join('')}<th></th></tr>` +
      rows.map((r, i) => `<tr>${sec.cols.map(([k, , t]) => `<td>${t === 'checkbox'
        ? `<input type="checkbox" data-path="${sec.table}.${i}.${k}" ${r[k] ? 'checked' : ''}>`
        : `<input type="${t}" step="any" data-num="${t === 'number' ? 1 : ''}" data-path="${sec.table}.${i}.${k}" value="${esc(r[k])}">`}</td>`).join('')}
        <td><button class="x" title="Remove" data-remove="${sec.table}" data-i="${i}">×</button></td></tr>`).join('') +
      `</table><button class="btn ghost small add" data-add="${sec.table}">+ Add row</button>`;
  }
  function render(target, sections) {
    $(target).innerHTML = sections.map((s, si) => `<div class="card" data-sec="${si}"><h3>${s.title}</h3>${s.hint ? `<p class="hint">${s.hint}</p>` : ''}
      ${s.table ? tableHtml(s) : `<div class="grid">${s.fields.map(fieldHtml).join('')}</div>`}</div>`).join('');
  }
  function renderAll() { render('#formula-form', FORMULA); render('#branding-form', BRANDING); }

  function markDirty() { dirty = true; $('#dirty').textContent = 'Unsaved changes'; schedulePreview(); }

  document.addEventListener('input', (e) => {
    const p = e.target.dataset?.path; if (!p) return;
    let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (e.target.dataset.num) v = v === '' ? 0 : Number(v);
    if (e.target.dataset.list) v = v.split(',').map((x) => x.trim()).filter(Boolean);
    set(cfg, p, v); markDirty();
  });
  document.addEventListener('click', (e) => {
    const add = e.target.dataset?.add, rem = e.target.dataset?.remove;
    if (add) { const sec = FORMULA.find((s) => s.table === add); get(cfg, add).push(sec.blank()); renderAll(); markDirty(); }
    if (rem) { get(cfg, rem).splice(Number(e.target.dataset.i), 1); renderAll(); markDirty(); }
    const tab = e.target.dataset?.tab;
    if (tab) {
      document.querySelectorAll('.top nav button').forEach((b) => b.classList.toggle('on', b === e.target));
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + tab));
      $('.savebar').style.display = tab === 'leads' ? 'none' : '';
      if (tab === 'leads') loadLeads();
    }
  });

  // ---- preview ----
  let timer;
  const schedulePreview = () => { clearTimeout(timer); timer = setTimeout(() => preview(), 350); };
  async function preview(address) {
    const out = $('#preview-out');
    try {
      const r = await fetch('/api/admin/test-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        config: cfg, address,
        answers: { layers: $('#t-layers').value, stories: $('#t-stories').value, skylights: $('#t-sky').value },
      }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const m = d.measurement;
      out.innerHTML = `<div class="meas">${d.address ? esc(d.address) + '<br>' : 'Sample roof · '}${m.totalAreaSqFt.toLocaleString()} sq ft · ${m.facets} planes · pitch ${m.predominantPitch} · imagery ${m.quality}${m.imageryDate ? ' (' + m.imageryDate + ')' : ''}</div>` +
        d.quotes.map((q) => `<div class="q"><b>${esc(q.materialName)}</b><div class="range">${money(q.low)} – ${money(q.high)}</div>
          <small class="hint">Midpoint ${money(q.mid)} · ${q.squares} squares · ${q.wastePercent}% waste · ±${q.rangePercent}%</small>
          <table>${q.lines.map((l) => `<tr><td>${esc(l.label)}${l.detail ? `<small>${esc(l.detail)}</small>` : ''}</td><td>${money(l.amount)}</td></tr>`).join('')}</table></div>`).join('');
    } catch (e) { out.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
  $('#test-btn').onclick = () => preview($('#test-address').value.trim() || undefined);
  ['#t-layers', '#t-stories', '#t-sky'].forEach((s) => $(s).addEventListener('change', () => preview()));

  // ---- save / reset ----
  $('#save').onclick = async () => {
    const r = await fetch('/api/admin/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
    const d = await r.json();
    if (!r.ok) return alertBar(d.error, true);
    dirty = false; alertBar('Saved ✓ — the live widget now uses these numbers.');
  };
  $('#reset').onclick = async () => {
    if (!confirm('Reset every setting to the defaults?')) return;
    cfg = await (await fetch('/api/admin/config/reset', { method: 'POST' })).json();
    renderAll(); preview(); alertBar('Reset to defaults.');
  };
  function alertBar(msg, bad) { const d = $('#dirty'); d.textContent = msg; d.style.color = bad ? '#b42318' : '#11743a'; setTimeout(() => { d.style.color = ''; d.textContent = dirty ? 'Unsaved changes' : ''; }, 4000); }
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---- leads ----
  async function loadLeads() {
    const leads = await (await fetch('/api/admin/leads')).json();
    if (!leads.length) return ($('#leads').innerHTML = '<p class="hint">No leads yet.</p>');
    $('#leads').innerHTML = `<table class="leads"><tr><th>Date</th><th>Contact</th><th>Address</th><th>Estimate</th><th>Details</th><th>CRM</th></tr>` +
      leads.map((l) => {
        const crm = Object.entries(l.crm || {});
        return `<tr><td>${new Date(l.createdAt).toLocaleString()}</td>
        <td><b>${esc(l.firstName)} ${esc(l.lastName)}</b><br>${esc(l.email)}<br>${esc(l.phone)}</td>
        <td>${esc(l.address?.full)}</td>
        <td>${l.quote ? `<b>${money(l.quote.low)} – ${money(l.quote.high)}</b><br>${esc(l.quote.materialName)}` : '<span class="tag warn">Manual measure</span>'}</td>
        <td>${esc(l.answers?.reason)}<br>${esc(l.answers?.timeline)}${l.roof ? `<br>${l.roof.totalAreaSqFt} sq ft · ${l.roof.predominantPitch}` : ''}${l.notes ? `<details><summary>Notes</summary><pre>${esc(l.notes)}</pre></details>` : ''}</td>
        <td>${crm.length ? crm.map(([k, v]) => `<span class="tag ${v.ok ? 'ok' : 'bad'}" title="${esc(v.error || '')}">${k} ${v.ok ? '✓' : '✗'}</span>`).join('') : '<span class="hint">none</span>'}
          <br><button class="btn ghost small" data-resend="${l.id}">Resend</button></td></tr>`;
      }).join('') + '</table>';
  }
  document.addEventListener('click', async (e) => {
    const id = e.target.dataset?.resend; if (!id) return;
    e.target.disabled = true; e.target.textContent = 'Sending…';
    await fetch(`/api/admin/leads/${id}/resend`, { method: 'POST' });
    loadLeads();
  });

  // ---- boot ----
  (async () => {
    const [c, s] = await Promise.all([fetch('/api/admin/config').then((r) => r.json()), fetch('/api/admin/status').then((r) => r.json())]);
    cfg = c;
    $('#status').innerHTML = (s.demo ? '<span class="pill warn">DEMO MODE – no Google API key</span>' : '<span class="pill">Google Solar API live</span>') +
      `<span class="pill">CRM: ${s.crmProviders.join(', ') || 'none (local only)'}</span>`;
    renderAll(); preview();
  })();
})();
