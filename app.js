// App configuration
const CONFIG = {
    databaseId: '23a442b1e24c804c9ed9f80e31ece6a7',
    notionToken: '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',
    startDate: new Date('2025-07-28'), // Monday, July 28, 2025
    workoutPlan: {
        week1: [
            'Chest 1 (Push-up Board)',
            'Triceps 1 (Push-up Board)',
            'Superman Pullbacks (Floor)',
            'Squats (Bodyweight)',
            'Back 1 (Push-up Board)'
        ],
        week2: [
            'Shoulders 1 (Push-up Board)',
            'Lunges (Bodyweight)',
            'Band Face Pulls',
            'Chest 2 (Push-up Board)',
            'Hammer Curls (Band or Bodyweight)'
        ],
        week3: [
            'Triceps 2 (Push-up Board)',
            'Back 2 (Push-up Board)',
            'Biceps Curls (Band or Isometric)',
            'Band Pull-Aparts',
            'Shoulders 2 (Push-up Board)'
        ],
        week4: [
            'Chest 3 (Push-up Board)',
            'Triceps 3 (Push-up Board)',
            'Back 3 (Push-up Board)',
            'Yoga Session (~15–30 mins)',
            'Shoulders 3 (Push-up Board)'
        ]
    }
};

// App state
let currentWeekOffset = 0;
let showFullWeek = true;
let workoutData = new Map(); // Cache for workout completion data
let currentModalData = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    // Calculate current week based on today's date
    const today = new Date();
    const daysSinceStart = Math.floor((today - CONFIG.startDate) / (1000 * 60 * 60 * 24));
    const weeksSinceStart = Math.floor(daysSinceStart / 7);
    currentWeekOffset = weeksSinceStart;
    
    loadWorkoutData();
    renderWorkoutCards();
}

function setupEventListeners() {
    // Week navigation
    document.getElementById('prevWeek').addEventListener('click', () => {
        currentWeekOffset--;
        renderWorkoutCards();
    });
    
    document.getElementById('nextWeek').addEventListener('click', () => {
        currentWeekOffset++;
        renderWorkoutCards();
    });
    
    // View toggle
    document.getElementById('viewToggle').addEventListener('click', toggleView);
    
    // Modal controls
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelReps').addEventListener('click', closeModal);
    document.getElementById('submitReps').addEventListener('click', submitReps);
    
    // Close modal on backdrop click
    document.getElementById('repModal').addEventListener('click', (e) => {
        if (e.target.id === 'repModal') closeModal();
    });
}

function getWeekDates(weekOffset) {
    const startOfWeek = new Date(CONFIG.startDate);
    startOfWeek.setDate(startOfWeek.getDate() + (weekOffset * 7));
    
    const dates = [];
    for (let i = 0; i < 5; i++) {
        const date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        dates.push(date);
    }
    return dates;
}

function getWorkoutPlan(weekOffset) {
    const weekNumber = ((weekOffset % 4) + 4) % 4; // Handle negative offsets
    const weekKeys = ['week1', 'week2', 'week3', 'week4'];
    return CONFIG.workoutPlan[weekKeys[weekNumber]];
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function getDayName(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function isToday(date) {
    const today = new Date();
    return formatDate(date) === formatDate(today);
}

function renderWorkoutCards() {
    const dates = getWeekDates(currentWeekOffset);
    const exercises = getWorkoutPlan(currentWeekOffset);
    const container = document.getElementById('workoutCards');
    
    // Update week title
    const actualWeekNumber = ((currentWeekOffset % 4) + 4) % 4 + 1;
    document.getElementById('weekTitle').textContent = `Week ${actualWeekNumber}`;
    
    // Update container class for single day view
    container.className = showFullWeek ? 'workout-grid' : 'workout-grid single-day';
    
    container.innerHTML = '';
    
    dates.forEach((date, index) => {
        const card = createWorkoutCard(date, exercises[index], index);
        container.appendChild(card);
    });
}

function createWorkoutCard(date, exercise, dayIndex) {
    const card = document.createElement('div');
    const dateStr = formatDate(date);
    const dayName = getDayName(date);
    const today = isToday(date);
    const completed = isWorkoutCompleted(dateStr, exercise);
    
    card.className = `workout-card ${completed ? 'completed' : ''} ${today ? 'today' : ''}`;
    
    card.innerHTML = `
        <div class="card-header">
            <div class="day-info">
                <h3>${dayName}</h3>
                <div class="date-display">${date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                })}</div>
            </div>
            <button 
                class="completed-toggle ${completed ? 'completed' : ''}" 
                data-date="${dateStr}" 
                data-exercise="${exercise}"
                onclick="toggleCompletion('${dateStr}', '${exercise.replace(/'/g, "\\'")}')"
                title="Mark as completed"
            >
                ${completed ? '✓' : ''}
            </button>
        </div>
        <div class="exercise-name">${exercise}</div>
        <button 
            class="btn btn--primary log-reps-btn" 
            onclick="openRepModal('${dateStr}', '${exercise.replace(/'/g, "\\'")}')"
        >
            Log Reps
        </button>
    `;
    
    return card;
}

function toggleView() {
    showFullWeek = !showFullWeek;
    const button = document.getElementById('viewToggle');
    button.textContent = showFullWeek ? 'Show Current Day Only' : 'Show Full Week';
    renderWorkoutCards();
}

async function openRepModal(date, exercise) {
    const modal = document.getElementById('repModal');
    const title = document.getElementById('modalTitle');
    
    title.textContent = `Log Reps - ${exercise}`;
    currentModalData = { date, exercise };
    
    // Clear previous inputs
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`set${i}`).value = '';
    }
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Load and display previous reps
    await loadPreviousReps(exercise);
}

async function loadPreviousReps(exercise) {
    try {
        showLoading(true);
        
        // Extract core exercise name (everything before first space or parenthesis)
        const coreExercise = exercise.split(/[\s(]/)[0];
        
        const response = await fetch('https://api.notion.com/v1/databases/' + CONFIG.databaseId + '/query', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + CONFIG.notionToken,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: {
                    property: 'Exercise',
                    title: {
                        contains: coreExercise
                    }
                },
                sorts: [
                    {
                        property: 'Date',
                        direction: 'descending'
                    }
                ],
                page_size: 1
            })
        });
        
        if (!response.ok) {
            throw new Error(`Notion API error: ${response.status}`);
        }
        
        const data = await response.json();
        const previousRepsDiv = document.getElementById('previousReps');
        
        if (data.results.length > 0) {
            const lastWorkout = data.results[0];
            const sets = {};
            
            for (let i = 1; i <= 5; i++) {
                const setProp = lastWorkout.properties[`Set ${i}`];
                sets[i] = setProp && setProp.number !== null ? setProp.number : '-';
                document.getElementById(`prevSet${i}`).textContent = sets[i];
            }
            
            previousRepsDiv.classList.remove('hidden');
        } else {
            previousRepsDiv.classList.add('hidden');
        }
        
    } catch (error) {
        console.error('Error loading previous reps:', error);
        document.getElementById('previousReps').classList.add('hidden');
    } finally {
        showLoading(false);
    }
}

function closeModal() {
    document.getElementById('repModal').classList.add('hidden');
    currentModalData = null;
}

async function submitReps() {
    if (!currentModalData) return;
    
    try {
        showLoading(true);
        
        const sets = {};
        let hasAnyValue = false;
        
        for (let i = 1; i <= 5; i++) {
            const input = document.getElementById(`set${i}`);
            const value = input.value.trim();
            sets[i] = value === '' ? null : parseInt(value, 10);
            if (sets[i] !== null) hasAnyValue = true;
        }
        
        if (!hasAnyValue) {
            alert('Please enter at least one set value.');
            return;
        }
        
        // Create new page in Notion
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + CONFIG.notionToken,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent: {
                    database_id: CONFIG.databaseId
                },
                properties: {
                    'Exercise': {
                        title: [
                            {
                                text: {
                                    content: currentModalData.exercise
                                }
                            }
                        ]
                    },
                    'Date': {
                        date: {
                            start: currentModalData.date
                        }
                    },
                    'Completed': {
                        checkbox: true
                    },
                    'Set 1': sets[1] !== null ? { number: sets[1] } : { number: null },
                    'Set 2': sets[2] !== null ? { number: sets[2] } : { number: null },
                    'Set 3': sets[3] !== null ? { number: sets[3] } : { number: null },
                    'Set 4': sets[4] !== null ? { number: sets[4] } : { number: null },
                    'Set 5': sets[5] !== null ? { number: sets[5] } : { number: null }
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save workout: ${response.status}`);
        }
        
        // Update local cache
        const key = `${currentModalData.date}-${currentModalData.exercise}`;
        workoutData.set(key, { completed: true, pageId: (await response.json()).id });
        
        // Close modal and refresh UI
        closeModal();
        renderWorkoutCards();
        
    } catch (error) {
        console.error('Error submitting reps:', error);
        alert('Failed to save workout. Please try again.');
    } finally {
        showLoading(false);
    }
}

async function toggleCompletion(date, exercise) {
    const key = `${date}-${exercise}`;
    const current = workoutData.get(key);
    
    if (!current || !current.pageId) {
        // No existing entry, can't toggle completion without reps
        alert('Please log reps first to mark as completed.');
        return;
    }
    
    try {
        showLoading(true);
        
        const newStatus = !current.completed;
        
        const response = await fetch(`https://api.notion.com/v1/pages/${current.pageId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': 'Bearer ' + CONFIG.notionToken,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: {
                    'Completed': {
                        checkbox: newStatus
                    }
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to update completion status: ${response.status}`);
        }
        
        // Update local cache
        workoutData.set(key, { ...current, completed: newStatus });
        
        // Refresh UI
        renderWorkoutCards();
        
    } catch (error) {
        console.error('Error toggling completion:', error);
        alert('Failed to update completion status. Please try again.');
    } finally {
        showLoading(false);
    }
}

async function loadWorkoutData() {
    try {
        showLoading(true);
        
        // Get date range for current 4-week period
        const startDate = new Date(CONFIG.startDate);
        startDate.setDate(startDate.getDate() + (currentWeekOffset * 7));
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 27); // 4 weeks
        
        const response = await fetch('https://api.notion.com/v1/databases/' + CONFIG.databaseId + '/query', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + CONFIG.notionToken,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: {
                    and: [
                        {
                            property: 'Date',
                            date: {
                                on_or_after: formatDate(startDate)
                            }
                        },
                        {
                            property: 'Date',
                            date: {
                                on_or_before: formatDate(endDate)
                            }
                        }
                    ]
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load workout data: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Cache the data
        workoutData.clear();
        data.results.forEach(page => {
            const exercise = page.properties.Exercise.title[0]?.text?.content || '';
            const date = page.properties.Date.date?.start || '';
            const completed = page.properties.Completed.checkbox || false;
            const key = `${date}-${exercise}`;
            
            workoutData.set(key, {
                completed,
                pageId: page.id
            });
        });
        
    } catch (error) {
        console.error('Error loading workout data:', error);
    } finally {
        showLoading(false);
    }
}

function isWorkoutCompleted(date, exercise) {
    const key = `${date}-${exercise}`;
    const data = workoutData.get(key);
    return data ? data.completed : false;
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

// Prevent zoom on double tap (iOS)
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);