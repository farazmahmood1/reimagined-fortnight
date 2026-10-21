// GET /webhook/farmplan/pack?t=PACK_TOKEN: the evidence pack, read-only. This is the page the certifier receives a link to.
const cfg = configFrom();
const token = String($('Webhook').first().json.query?.t || '');
const farm = tableRows('Farms').find((f) => token && f.pack_token === token);
if (!farm) return [{ json: { html: page('Link not found', '<h1>This link is no longer valid</h1>') } }];
const events = tableRows('Audit log').filter((a) => a.flow === 'Farm plan' && a.subject === farm.name).sort((a, b) => String(a.at).localeCompare(String(b.at)));
return [{ json: { html: page(`Evidence pack: ${farm.name}`, packBody(farm, tableRows('Evidence'), cfg, events), { wide: true, tag: 'Evidence pack' }) } }];
