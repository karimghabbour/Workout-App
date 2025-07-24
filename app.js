/* ------------------------------------------------------------------
   CONFIG  (real keys stay here – sent to backend functions)
------------------------------------------------------------------ */
const CONFIG = {
  databaseId: '23a442b1e24c804c9ed9f80e31ece6a7',
  notionToken: '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',
  startDate: new Date('2025-07-28'),
  workoutPlan: {
    week1: ['Chest 1 (Push-up Board)','Triceps 1 (Push-up Board)',
            'Superman Pullbacks (Floor)','Squats (Bodyweight)',
            'Back 1 (Push-up Board)'],
    week2: ['Shoulders 1 (Push-up Board)','Lunges (Bodyweight)',
            'Band Face Pulls','Chest 2 (Push-up Board)',
            'Hammer Curls (Band or Bodyweight)'],
    week3: ['Triceps 2 (Push-up Board)','Back 2 (Push-up Board)',
            'Biceps Curls (Band or Isometric)','Band Pull-Apart',
            'Shoulders 2 (Push-up Board)'],
    week4: ['Chest 3 (Push-up Board)','Triceps 3 (Push-up Board)',
            'Back 3 (Push-up Board)','Yoga Session (~15–30 min)',
            'Shoulders 3 (Push-up Board)']
  }
};

/* ------------------------------------------------------------------
   STATE & INIT
------------------------------------------------------------------ */
let currentWeekOffset = 0;
let showFullWeek      = true;
let workoutData       = new Map();
let currentModalData  = null;

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
});

function initializeApp() {
  const today          = new Date();
  const daysSinceStart = Math.floor((today - CONFIG.startDate) / 86400000);
  currentWeekOffset    = Math.floor(daysSinceStart / 7);

  loadWorkoutData().then(renderWorkoutCards);
}

function setupEventListeners() {
  document.getElementById('prevWeek').addEventListener('click', () => {
    currentWeekOffset--; renderWorkoutCards();
  });
  document.getElementById('nextWeek').addEventListener('click', () => {
    currentWeekOffset++; renderWorkoutCards();
  });
  document.getElementById('viewToggle').addEventListener('click', toggleView);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelReps').addEventListener('click', closeModal);
  document.getElementById('submitReps').addEventListener('click', submitReps);
  document.getElementById('repModal').addEventListener('click', e => {
    if (e.target.id === 'repModal') closeModal();
  });
}

/* ------------------------------------------------------------------
   DATE / PLAN HELPERS
------------------------------------------------------------------ */
const iso   = d => d.toISOString().split('T')[0];
const today = () => iso(new Date());

function weekDates(offset) {
  const start = new Date(CONFIG.startDate);
  start.setDate(start.getDate() + offset * 7);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return d;
  });
}
function weekPlan(offset) {
  return CONFIG.workoutPlan[`week${((offset % 4)+4)%4 + 1}`];
}

/* ------------------------------------------------------------------
   RENDER FUNCTIONS
------------------------------------------------------------------ */
function renderWorkoutCards() {
  const dates     = weekDates(currentWeekOffset);
  const exercises = weekPlan(currentWeekOffset);
  const grid      = document.getElementById('workoutCards');
  grid.className  = showFullWeek ? 'workout-grid' : 'workout-grid single-day';
  grid.innerHTML  = '';

  document.getElementById('weekTitle').textContent =
    `Week ${((currentWeekOffset%4)+4)%4 + 1}`;

  dates.forEach((d,i) => grid.appendChild(card(d,exercises[i])));
}

function card(date, exercise) {
  const ds   = iso(date);
  const done = isCompleted(ds, exercise);
  const div  = document.createElement('div');
  div.className = `workout-card ${done?'completed':''} ${iso(date)===today()?'today':''}`;
  div.innerHTML = `
    <div class="card-header">
      <div class="day-info">
        <h3>${date.toLocaleDateString('en-US',{weekday:'long'})}</h3>
        <div class="date-display">${date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
      </div>
      <button class="completed-toggle ${done?'completed':''}"
              title="Mark as completed"
              onclick="toggleCompletion('${ds}','${exercise.replace(/'/g,"\\'")}')">
        ${done?'✓':''}
      </button>
    </div>
    <div class="exercise-name">${exercise}</div>
    <button class="btn btn--primary log-reps-btn"
            onclick="openRepModal('${ds}','${exercise.replace(/'/g,"\\'")}')">
      Log Reps
    </button>`;
  return div;
}

function toggleView() {
  showFullWeek = !showFullWeek;
  document.getElementById('viewToggle').textContent =
    showFullWeek ? 'Show Current Day Only' : 'Show Full Week';
  renderWorkoutCards();
}

/* ------------------------------------------------------------------
   MODAL HANDLING
------------------------------------------------------------------ */
async function openRepModal(date, exercise) {
  currentModalData = { date, exercise };
  document.getElementById('modalTitle').textContent = `Log Reps - ${exercise}`;
  for (let i=1;i<=5;i++) document.getElementById(`set${i}`).value='';
  document.getElementById('repModal').classList.remove('hidden');
  await loadPreviousReps(exercise);
}
function closeModal() {
  document.getElementById('repModal').classList.add('hidden');
  currentModalData=null;
}

/* ------------------------------------------------------------------
   NETWORK HELPERS (call our own Vercel backend)
------------------------------------------------------------------ */
const toJSON = r => r.json();

const apiCall = (route, payload) =>
  fetch(route,{
    method :'POST',
    headers:{'Content-Type':'application/json'},
    body   :JSON.stringify({
      notionToken: CONFIG.notionToken,
      databaseId : CONFIG.databaseId,
      ...payload
    })
  });

const notionQuery  = body                 => apiCall('/api/query' ,{ body });
const notionSubmit = properties           => apiCall('/api/submit',{ properties });
const notionUpdate = (pageId, properties) => apiCall('/api/update',{ pageId, properties });

/* ------------------------------------------------------------------
   PREVIOUS REPS
------------------------------------------------------------------ */
async function loadPreviousReps(exercise){
  try{
    showLoading(true);
    const core = exercise.split(/[\s(]/)[0];
    const res  = await notionQuery({
      filter:{property:'Exercise',title:{contains:core}},
      sorts :[{property:'Date',direction:'descending'}],
      page_size:1
    });
    if(!res.ok)throw new Error(res.status);
    const data = await res.json();
    const box  = document.getElementById('previousReps');
    if(!data.results.length){box.classList.add('hidden');return;}
    for(let i=1;i<=5;i++){
      const set = data.results[0].properties[`Set ${i}`];
      document.getElementById(`prevSet${i}`).textContent =
        set && set.number!=null ? set.number : '-';
    }
    box.classList.remove('hidden');
  }catch(e){console.error(e);}
  finally{showLoading(false);}
}

/* ------------------------------------------------------------------
   SUBMIT REPS
------------------------------------------------------------------ */
async function submitReps(){
  if(!currentModalData)return;
  const reps={}, vals=[];
  for(let i=1;i<=5;i++){
    const v=document.getElementById(`set${i}`).value.trim();
    reps[`Set ${i}`]=v===''?{number:null}:{number:parseInt(v,10)};
    vals.push(v);
  }
  if(vals.every(v=>v==='')){alert('Enter at least one set value.');return;}
  try{
    showLoading(true);
    const props={
      Exercise :{title:[{text:{content:currentModalData.exercise}}]},
      Date     :{date :{start:currentModalData.date}},
      Completed:{checkbox:true},
      ...reps
    };
    const res=await notionSubmit(props);
    if(!res.ok)throw new Error(res.status);
    const json=await res.json();
    workoutData.set(`${currentModalData.date}-${currentModalData.exercise}`,
                    {completed:true,pageId:json.id});
    closeModal(); renderWorkoutCards();
  }catch(e){console.error(e);alert('Failed to save workout.');}
  finally{showLoading(false);}
}

/* ------------------------------------------------------------------
   TOGGLE COMPLETION
------------------------------------------------------------------ */
async function toggleCompletion(date,exercise){
  const key=`${date}-${exercise}`, item=workoutData.get(key);
  if(!item||!item.pageId){alert('Log reps first.');return;}
  try{
    showLoading(true);
    const res=await notionUpdate(item.pageId,{Completed:{checkbox:!item.completed}});
    if(!res.ok)throw new Error(res.status);
    workoutData.set(key,{...item,completed:!item.completed});
    renderWorkoutCards();
  }catch(e){console.error(e);alert('Failed to update status.');}
  finally{showLoading(false);}
}

/* ------------------------------------------------------------------
   LOAD WORKOUT DATA FOR CURRENT 4-WEEK WINDOW
------------------------------------------------------------------ */
async function loadWorkoutData(){
  try{
    showLoading(true);
    const start=new Date(CONFIG.startDate);
    start.setDate(start.getDate()+currentWeekOffset*7);
    const end=new Date(start); end.setDate(end.getDate()+27);
    const res=await notionQuery({
      filter:{and:[
        {property:'Date',date:{on_or_after :iso(start)}},
        {property:'Date',date:{on_or_before:iso(end)}}]}
    });
    if(!res.ok)throw new Error(res.status);
    const data=await res.json();
    workoutData.clear();
    data.results.forEach(p=>{
      const ex = p.properties.Exercise.title[0]?.text?.content||'';
      const dt = p.properties.Date.date?.start||'';
      workoutData.set(`${dt}-${ex}`,{
        completed:p.properties.Completed.checkbox||false,
        pageId   :p.id
      });
    });
  }catch(e){console.error(e);}
  finally{showLoading(false);}
}
function isCompleted(date,ex){const d=workoutData.get(`${date}-${ex}`);return d?d.completed:false;}

/* ------------------------------------------------------------------
   UI HELPERS
------------------------------------------------------------------ */
function showLoading(flag){
  document.getElementById('loadingOverlay')
          .classList.toggle('hidden',!flag);
}

/* iOS double‑tap zoom prevention */
let lastTouchEnd=0;document.addEventListener('touchend',e=>{
  const now=Date.now(); if(now-lastTouchEnd<=300)e.preventDefault();
  lastTouchEnd=now;
},false);
