/* ------------------------------------------------------------------
   CONFIG  (your real keys stay here – sent to the backend function)
------------------------------------------------------------------ */
const CONFIG = {
  databaseId: '23a442b1e24c804c9ed9f80e31ece6a7',
  notionToken: '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',
  startDate: new Date('2025-07-28'),
  workoutPlan: {
    week1: [ 'Chest 1 (Push-up Board)', 'Triceps 1 (Push-up Board)',
             'Superman Pullbacks (Floor)', 'Squats (Bodyweight)',
             'Back 1 (Push-up Board)' ],
    week2: [ 'Shoulders 1 (Push-up Board)', 'Lunges (Bodyweight)',
             'Band Face Pulls', 'Chest 2 (Push-up Board)',
             'Hammer Curls (Band or Bodyweight)' ],
    week3: [ 'Triceps 2 (Push-up Board)', 'Back 2 (Push-up Board)',
             'Biceps Curls (Band or Isometric)', 'Band Pull-Apart',
             'Shoulders 2 (Push-up Board)' ],
    week4: [ 'Chest 3 (Push-up Board)', 'Triceps 3 (Push-up Board)',
             'Back 3 (Push-up Board)', 'Yoga Session (~15–30 min)',
             'Shoulders 3 (Push-up Board)' ]
  }
};

/* ------------------------------------------------------------------
   STATE & INIT (unchanged)
------------------------------------------------------------------ */
let currentWeekOffset = 0;
let showFullWeek      = true;
let workoutData       = new Map();
let currentModalData  = null;

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
});

/* ------------------------------------------------------------------
   ALL UI / RENDER FUNCTIONS  (unchanged)
------------------------------------------------------------------ */
// …  **(keep everything you already had from createWorkoutCard down to showLoading)** …

/* ------------------------------------------------------------------
   NETWORK HELPERS – now call our own backend
------------------------------------------------------------------ */
async function notionQuery(payload) {
  return fetch('/api/query', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      notionToken: CONFIG.notionToken,
      databaseId : CONFIG.databaseId,
      body       : payload
    })
  });
}

async function notionSubmit(properties) {
  return fetch('/api/submit', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      notionToken: CONFIG.notionToken,
      databaseId : CONFIG.databaseId,
      properties : properties
    })
  });
}

async function notionUpdate(pageId, properties) {
  return fetch('/api/update', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      notionToken: CONFIG.notionToken,
      pageId     : pageId,
      properties : properties
    })
  });
}

/* ------------------------------------------------------------------
   loadPreviousReps  (only fetch replaced)
------------------------------------------------------------------ */
async function loadPreviousReps(exercise) {
  try {
    showLoading(true);
    const core = exercise.split(/[\s(]/)[0];

    const qBody = {
      filter: { property: 'Exercise', title: { contains: core } },
      sorts : [{ property: 'Date', direction: 'descending' }],
      page_size: 1
    };

    const res  = await notionQuery(qBody);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();

    const prevDiv = document.getElementById('previousReps');
    if (data.results.length) {
      const last = data.results[0];
      for (let i = 1; i <= 5; i++) {
        const set = last.properties[`Set ${i}`];
        document.getElementById(`prevSet${i}`).textContent =
          set && set.number !== null ? set.number : '-';
      }
      prevDiv.classList.remove('hidden');
    } else prevDiv.classList.add('hidden');
  } catch (e) {
    console.error(e);
    document.getElementById('previousReps').classList.add('hidden');
  } finally { showLoading(false); }
}

/* ------------------------------------------------------------------
   submitReps  (only fetch replaced)
------------------------------------------------------------------ */
async function submitReps() {
  if (!currentModalData) return;
  const sets = {};
  for (let i = 1; i <= 5; i++) {
    const v = document.getElementById(`set${i}`).value.trim();
    sets[i]  = v === '' ? null : parseInt(v, 10);
  }
  if (Object.values(sets).every(v => v === null)) {
    alert('Please enter at least one set value.'); return;
  }

  try {
    showLoading(true);
    const props = {
      Exercise : {
        title: [{ text: { content: currentModalData.exercise } }]
      },
      Date     : { date: { start: currentModalData.date } },
      Completed: { checkbox: true },
      'Set 1'  : { number: sets[1] },
      'Set 2'  : { number: sets[2] },
      'Set 3'  : { number: sets[3] },
      'Set 4'  : { number: sets[4] },
      'Set 5'  : { number: sets[5] }
    };

    const res = await notionSubmit(props);
    if (!res.ok) throw new Error(res.status);
    const json = await res.json();

    workoutData.set(
      `${currentModalData.date}-${currentModalData.exercise}`,
      { completed: true, pageId: json.id }
    );
    closeModal();
    renderWorkoutCards();
  } catch (e) {
    console.error(e);
    alert('Failed to save workout. Please try again.');
  } finally { showLoading(false); }
}

/* ------------------------------------------------------------------
   toggleCompletion  (only fetch replaced)
------------------------------------------------------------------ */
async function toggleCompletion(date, exercise) {
  const key = `${date}-${exercise}`;
  const item = workoutData.get(key);
  if (!item || !item.pageId) { alert('Log reps first.'); return; }

  try {
    showLoading(true);
    const res = await notionUpdate(item.pageId, {
      Completed: { checkbox: !item.completed }
    });
    if (!res.ok) throw new Error(res.status);

    workoutData.set(key, { ...item, completed: !item.completed });
    renderWorkoutCards();
  } catch (e) {
    console.error(e);
    alert('Failed to update status.');
  } finally { showLoading(false); }
}

/* ------------------------------------------------------------------
   loadWorkoutData  (only fetch replaced)
------------------------------------------------------------------ */
async function loadWorkoutData() {
  try {
    showLoading(true);
    const start = new Date(CONFIG.startDate);
    start.setDate(start.getDate() + currentWeekOffset * 7);
    const end   = new Date(start); end.setDate(end.getDate() + 27);

    const qBody = {
      filter: {
        and: [
          { property: 'Date', date: { on_or_after : formatDate(start) } },
          { property: 'Date', date: { on_or_before: formatDate(end)   } }
        ]
      }
    };

    const res = await notionQuery(qBody);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();

    workoutData.clear();
    data.results.forEach(p => {
      const exercise = p.properties.Exercise.title[0]?.text?.content || '';
      const date     = p.properties.Date.date?.start || '';
      workoutData.set(`${date}-${exercise}`, {
        completed: p.properties.Completed.checkbox || false,
        pageId   : p.id
      });
    });
  } catch (e) {
    console.error(e);
  } finally { showLoading(false); }
}

/* ------------------------------------------------------------------
   all remaining UI helpers (createWorkoutCard, toggleView, etc.)
   stay **unchanged** from your original script.
------------------------------------------------------------------ */
