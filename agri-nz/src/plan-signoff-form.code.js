// GET /webhook/farmplan/signoff?t=SIGNOFF_TOKEN: the owner reads the pack and signs it off. Nothing is sent before this.
const cfg = configFrom();
const token = String($('Webhook').first().json.query?.t || '');
const farm = tableRows('Farms').find((f) => token && f.signoff_token === token);
if (!farm) return [{ json: { html: page('Link not found', `<h1>This link is no longer valid</h1><p class="muted">Ask ${esc(cfg.admin_name)} for a new one.</p>`) } }];
const events = tableRows('Audit log').filter((a) => a.flow === 'Farm plan' && a.subject === farm.name).sort((a, b) => String(a.at).localeCompare(String(b.at)));
const pack = packBody(farm, tableRows('Evidence'), cfg, events);
const form = farm.pack_status === 'Ready for sign-off'
  ? `<form method="post" action="${cfg.base_url}/webhook/farmplan/signoff" class="noprint">
<input type="hidden" name="t" value="${esc(token)}">
<h2>Sign off</h2>
<p>Signing sends this pack to <b>${esc(cfg.certifier_name)}</b> (${esc(cfg.certifier_email)}). It is recorded with your name and the time.</p>
<label for="name">Type your full name to sign</label><input id="name" name="name" autocomplete="name" required>
<label style="display:flex;gap:10px;align-items:flex-start;font-weight:400"><input type="checkbox" name="confirm" value="yes" style="width:auto;margin-top:4px" required> I have read this pack, and the information in it is correct as far as I know.</label>
<button class="btn go" type="submit">Sign off and send to ${esc(cfg.certifier_name)}</button></form>`
  : '';
return [{ json: { html: page(`Sign off: ${farm.name}`, pack + form, { wide: true, tag: 'Sign-off' }) } }];
