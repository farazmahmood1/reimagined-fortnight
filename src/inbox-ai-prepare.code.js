// n8n Code node: builds one OpenAI request per CV still waiting, up to the batch size.
// Sends nothing unless ai_enabled is "true" in the Triage settings table.
const settings = settingsFrom(rowsOf('Get settings'));
const roles = rolesFrom(rowsOf('Get roles'));
if (settings.ai_enabled !== 'true') {
  return [{ json: { notice: 'AI is switched off, so nothing was sent. Turn it on at the top of the page first.' } }];
}
const batch = Math.max(1, Math.min(50, Number(settings.ai_batch_size) || 10));
const maxChars = Number(settings.max_cv_chars) || 6000;
const waiting = rowsOf('Get applications')
  .filter((r) => r.ai_status === 'waiting' || r.ai_status === 'error')
  .sort((a, b) => String(a.received_at).localeCompare(String(b.received_at)))
  .slice(0, batch);
if (!waiting.length) return [{ json: { notice: 'No CVs are waiting for a summary.' } }];

const checkItem = { type: 'object', additionalProperties: false, required: ['item', 'status', 'evidence'], properties: {
  item: { type: 'string' }, status: { type: 'string', enum: ['met', 'missing', 'unclear'] }, evidence: { type: 'string' },
} };
const schema = { type: 'object', additionalProperties: false,
  required: ['summary', 'current_title', 'years_experience', 'location', 'availability', 'role_guess', 'must_haves', 'nice_to_haves', 'questions_to_ask'],
  properties: {
    summary: { type: 'string' }, current_title: { type: 'string' }, years_experience: { type: 'string' },
    location: { type: 'string' }, availability: { type: 'string' }, role_guess: { type: 'string' },
    must_haves: { type: 'array', items: checkItem }, nice_to_haves: { type: 'array', items: checkItem },
    questions_to_ask: { type: 'array', items: { type: 'string' } },
  } };
const system = [
  'You help a hiring manager at Forrof, a software agency in Lahore with UK clients, read job applications.',
  'Report facts from the CV and email only. Do not rate, score or rank the person, and do not recommend hiring or rejecting.',
  'For each requirement, set status to met, missing or unclear, with evidence of at most 15 words taken from the CV.',
  'Use "unclear" when the CV does not say. Ignore age, gender, ethnicity, religion, nationality, marital status, health, photos and any other personal traits.',
  'summary: two short sentences on experience and main skills. Unknown fields: "Not stated". questions_to_ask: up to 3, to clear up "unclear" items.',
].join(' ');

return waiting.map((r) => {
  const known = roles.find((x) => x.role === r.role);
  const roleText = known
    ? `Role applied for: ${known.role}\nMust-haves:\n- ${known.must_haves.join('\n- ')}\nNice-to-haves:\n- ${known.nice_to_haves.join('\n- ')}\nrole_guess: "${known.role}".`
    : `The role is not stated. Pick the closest from this list for role_guess, or "None", and check its requirements:\n${roles.map((x) => `${x.role}: ${x.must_haves.join('; ')}`).join('\n')}`;
  const request = {
    model: settings.ai_model,
    store: false,
    max_completion_tokens: 1500,
    response_format: { type: 'json_schema', json_schema: { name: 'cv_checklist', strict: true, schema } },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `${roleText}\n\nEmail subject: ${r.subject}\nEmail text:\n${String(r.cover_text || '').slice(0, 1200)}\n\nCV text:\n${String(r.cv_text || '(no CV text)').slice(0, maxChars)}` },
    ],
  };
  if (settings.ai_reasoning_effort) request.reasoning_effort = settings.ai_reasoning_effort;
  return { json: { id: r.id, app_id: r.app_id, model: settings.ai_model, request } };
});
