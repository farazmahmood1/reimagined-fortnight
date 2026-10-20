// n8n Code node: turns each OpenAI answer into an update for its Applications row.
const sent = $('Pick waiting CVs').all();
const answers = $input.all();
let done = 0;
let failed = 0;
let tokens = 0;
const updates = sent.map((s, i) => {
  const req = s.json;
  const res = (answers[i] && answers[i].json) || {};
  const content = res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
  const data = content ? parseJson(content, null) : null;
  if (!data) {
    failed++;
    const msg = (res.error && (res.error.message || res.error.description)) || (res.choices ? 'The answer was not valid JSON' : 'No answer');
    return { id: req.id, ai_status: 'error', ai_error: String(msg).slice(0, 300), ai_at: nowIso() };
  }
  done++;
  tokens += Number((res.usage && res.usage.total_tokens) || 0);
  return {
    id: req.id, ai_status: 'done', ai_error: '', ai_at: nowIso(), ai_model: req.model,
    ai_tokens: Number((res.usage && res.usage.total_tokens) || 0),
    ai_summary: data.summary, ai_current_title: data.current_title, ai_experience: data.years_experience,
    ai_location: data.location, ai_availability: data.availability, ai_role_guess: data.role_guess,
    ai_must_haves: JSON.stringify(data.must_haves || []), ai_nice_to_haves: JSON.stringify(data.nice_to_haves || []),
    ai_questions: JSON.stringify(data.questions_to_ask || []),
  };
});
const notice = `Summarised ${done} CV(s)${failed ? `, ${failed} failed (shown on the page)` : ''}. Tokens used: ${tokens.toLocaleString('en-GB')}.`;
return [{ json: { updates, notice } }];
