// Personalised workout plan engine.
// Input: the questionnaire answers. Output: a full weekly plan.
//
// answers = {
//   goal: 'muscle' | 'loss' | 'strength' | 'health',
//   experience: 'beginner' | 'intermediate' | 'advanced',
//   days: 2..6,
//   sessionMinutes: 30 | 45 | 60 | 90,
//   equipment: 'full' | 'basic' | 'home' | 'bodyweight',
//   injuries: ['knee' | 'back' | 'shoulder' | 'elbow'],
//   priorities: ['chest' | 'back' | 'arms' | 'shoulders' | 'glutes' | 'legs' | 'core'],
//   recovery: 'good' | 'average' | 'poor',
//   cardio: 'none' | 'some' | 'lots',
//   name, gender, age, weight (kg), height (cm)
// }

// Which kit each answer to "where do you train" unlocks.
const EQUIPMENT_TIERS = {
    full: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'band'],
    basic: ['dumbbell', 'machine', 'cable', 'bodyweight', 'band'],
    home: ['dumbbell', 'band', 'bodyweight'],
    bodyweight: ['bodyweight', 'band']
};

// pattern: the movement slot it can fill. muscle: what it mainly trains (used for weekly set counts).
// avoid: injuries that rule it out. beginner: safe/simple enough for a first plan.
const EXERCISES = [
    // Squat pattern
    { name: 'Back Squat', pattern: 'squat', muscle: 'legs', equip: 'barbell', avoid: ['knee', 'back'], beginner: false },
    { name: 'Front Squat', pattern: 'squat', muscle: 'legs', equip: 'barbell', avoid: ['knee', 'back'], beginner: false },
    { name: 'Goblet Squat', pattern: 'squat', muscle: 'legs', equip: 'dumbbell', avoid: ['knee'], beginner: true },
    { name: 'Hack Squat', pattern: 'squat', muscle: 'legs', equip: 'machine', avoid: ['knee'], beginner: true },
    { name: 'Leg Press', pattern: 'squat', muscle: 'legs', equip: 'machine', avoid: [], beginner: true },
    { name: 'Box Squat', pattern: 'squat', muscle: 'legs', equip: 'bodyweight', avoid: [], beginner: true },
    { name: 'Bodyweight Squat', pattern: 'squat', muscle: 'legs', equip: 'bodyweight', avoid: [], beginner: true },

    // Hinge pattern
    { name: 'Romanian Deadlift', pattern: 'hinge', muscle: 'glutes', equip: 'barbell', avoid: ['back'], beginner: false },
    { name: 'Dumbbell Romanian Deadlift', pattern: 'hinge', muscle: 'glutes', equip: 'dumbbell', avoid: ['back'], beginner: true },
    { name: 'Hip Thrust', pattern: 'hinge', muscle: 'glutes', equip: 'barbell', avoid: [], beginner: true },
    { name: 'Dumbbell Hip Thrust', pattern: 'hinge', muscle: 'glutes', equip: 'dumbbell', avoid: [], beginner: true },
    { name: 'Glute Bridge', pattern: 'hinge', muscle: 'glutes', equip: 'bodyweight', avoid: [], beginner: true },
    { name: 'Back Extension', pattern: 'hinge', muscle: 'glutes', equip: 'bodyweight', avoid: [], beginner: true },
    { name: 'Cable Pull-Through', pattern: 'hinge', muscle: 'glutes', equip: 'cable', avoid: [], beginner: true },

    // Single-leg / quad and hamstring accessories
    { name: 'Walking Lunge', pattern: 'lunge', muscle: 'legs', equip: 'dumbbell', avoid: ['knee'], beginner: true },
    { name: 'Bulgarian Split Squat', pattern: 'lunge', muscle: 'legs', equip: 'dumbbell', avoid: ['knee'], beginner: false },
    { name: 'Step-Up', pattern: 'lunge', muscle: 'legs', equip: 'dumbbell', avoid: ['knee'], beginner: true },
    { name: 'Reverse Lunge', pattern: 'lunge', muscle: 'legs', equip: 'bodyweight', avoid: ['knee'], beginner: true },
    { name: 'Leg Extension', pattern: 'quad', muscle: 'legs', equip: 'machine', avoid: ['knee'], beginner: true },
    { name: 'Sissy Squat', pattern: 'quad', muscle: 'legs', equip: 'bodyweight', avoid: ['knee'], beginner: false },
    { name: 'Lying Leg Curl', pattern: 'hamstring', muscle: 'legs', equip: 'machine', avoid: [], beginner: true },
    { name: 'Nordic Curl', pattern: 'hamstring', muscle: 'legs', equip: 'bodyweight', avoid: [], beginner: false },
    { name: 'Band Leg Curl', pattern: 'hamstring', muscle: 'legs', equip: 'band', avoid: [], beginner: true },

    // Horizontal push
    { name: 'Barbell Bench Press', pattern: 'hpush', muscle: 'chest', equip: 'barbell', avoid: ['shoulder'], beginner: false },
    { name: 'Dumbbell Bench Press', pattern: 'hpush', muscle: 'chest', equip: 'dumbbell', avoid: [], beginner: true },
    { name: 'Machine Chest Press', pattern: 'hpush', muscle: 'chest', equip: 'machine', avoid: [], beginner: true },
    { name: 'Push-Up', pattern: 'hpush', muscle: 'chest', equip: 'bodyweight', avoid: [], beginner: true },
    { name: 'Incline Dumbbell Press', pattern: 'hpush', muscle: 'chest', equip: 'dumbbell', avoid: [], beginner: true },
    { name: 'Incline Barbell Press', pattern: 'hpush', muscle: 'chest', equip: 'barbell', avoid: ['shoulder'], beginner: false },
    { name: 'Band Chest Press', pattern: 'hpush', muscle: 'chest', equip: 'band', avoid: [], beginner: true },

    // Vertical push
    { name: 'Standing Overhead Press', pattern: 'vpush', muscle: 'shoulders', equip: 'barbell', avoid: ['shoulder', 'back'], beginner: false },
    { name: 'Seated Dumbbell Shoulder Press', pattern: 'vpush', muscle: 'shoulders', equip: 'dumbbell', avoid: ['shoulder'], beginner: true },
    { name: 'Machine Shoulder Press', pattern: 'vpush', muscle: 'shoulders', equip: 'machine', avoid: ['shoulder'], beginner: true },
    { name: 'Landmine Press', pattern: 'vpush', muscle: 'shoulders', equip: 'barbell', avoid: [], beginner: true },
    { name: 'Pike Push-Up', pattern: 'vpush', muscle: 'shoulders', equip: 'bodyweight', avoid: ['shoulder'], beginner: false },
    { name: 'Band Overhead Press', pattern: 'vpush', muscle: 'shoulders', equip: 'band', avoid: ['shoulder'], beginner: true },

    // Vertical pull
    { name: 'Pull-Up', pattern: 'vpull', muscle: 'back', equip: 'bodyweight', avoid: ['elbow'], beginner: false },
    { name: 'Lat Pulldown', pattern: 'vpull', muscle: 'back', equip: 'cable', avoid: [], beginner: true },
    { name: 'Assisted Pull-Up', pattern: 'vpull', muscle: 'back', equip: 'machine', avoid: [], beginner: true },
    { name: 'Band Lat Pulldown', pattern: 'vpull', muscle: 'back', equip: 'band', avoid: [], beginner: true },

    // Horizontal pull
    { name: 'Barbell Row', pattern: 'hpull', muscle: 'back', equip: 'barbell', avoid: ['back'], beginner: false },
    { name: 'One-Arm Dumbbell Row', pattern: 'hpull', muscle: 'back', equip: 'dumbbell', avoid: [], beginner: true },
    { name: 'Chest-Supported Row', pattern: 'hpull', muscle: 'back', equip: 'machine', avoid: [], beginner: true },
    { name: 'Seated Cable Row', pattern: 'hpull', muscle: 'back', equip: 'cable', avoid: [], beginner: true },
    { name: 'Inverted Row', pattern: 'hpull', muscle: 'back', equip: 'bodyweight', avoid: [], beginner: true },
    { name: 'Band Row', pattern: 'hpull', muscle: 'back', equip: 'band', avoid: [], beginner: true },

    // Shoulders and rear delts
    { name: 'Cable Lateral Raise', pattern: 'lateral', muscle: 'shoulders', equip: 'cable', avoid: [], beginner: true },
    { name: 'Dumbbell Lateral Raise', pattern: 'lateral', muscle: 'shoulders', equip: 'dumbbell', avoid: [], beginner: true },
    { name: 'Band Lateral Raise', pattern: 'lateral', muscle: 'shoulders', equip: 'band', avoid: [], beginner: true },
    { name: 'Face Pull', pattern: 'reardelt', muscle: 'shoulders', equip: 'cable', avoid: [], beginner: true },
    { name: 'Rear-Delt Dumbbell Fly', pattern: 'reardelt', muscle: 'shoulders', equip: 'dumbbell', avoid: [], beginner: true },
    { name: 'Band Pull-Apart', pattern: 'reardelt', muscle: 'shoulders', equip: 'band', avoid: [], beginner: true },

    // Chest isolation
    { name: 'Cable Fly', pattern: 'fly', muscle: 'chest', equip: 'cable', avoid: ['shoulder'], beginner: true },
    { name: 'Dumbbell Fly', pattern: 'fly', muscle: 'chest', equip: 'dumbbell', avoid: ['shoulder'], beginner: true },
    { name: 'Band Fly', pattern: 'fly', muscle: 'chest', equip: 'band', avoid: ['shoulder'], beginner: true },

    // Arms
    { name: 'Barbell Curl', pattern: 'biceps', muscle: 'arms', equip: 'barbell', avoid: ['elbow'], beginner: true },
    { name: 'Dumbbell Curl', pattern: 'biceps', muscle: 'arms', equip: 'dumbbell', avoid: ['elbow'], beginner: true },
    { name: 'Hammer Curl', pattern: 'biceps', muscle: 'arms', equip: 'dumbbell', avoid: [], beginner: true },
    { name: 'Cable Curl', pattern: 'biceps', muscle: 'arms', equip: 'cable', avoid: ['elbow'], beginner: true },
    { name: 'Band Curl', pattern: 'biceps', muscle: 'arms', equip: 'band', avoid: [], beginner: true },
    { name: 'Rope Triceps Pressdown', pattern: 'triceps', muscle: 'arms', equip: 'cable', avoid: [], beginner: true },
    { name: 'Overhead Dumbbell Extension', pattern: 'triceps', muscle: 'arms', equip: 'dumbbell', avoid: ['elbow', 'shoulder'], beginner: true },
    { name: 'Close-Grip Bench Press', pattern: 'triceps', muscle: 'arms', equip: 'barbell', avoid: ['elbow', 'shoulder'], beginner: false },
    { name: 'Bench Dip', pattern: 'triceps', muscle: 'arms', equip: 'bodyweight', avoid: ['shoulder', 'elbow'], beginner: true },
    { name: 'Band Pressdown', pattern: 'triceps', muscle: 'arms', equip: 'band', avoid: [], beginner: true },

    // Calves and core
    { name: 'Standing Calf Raise', pattern: 'calf', muscle: 'legs', equip: 'machine', avoid: [], beginner: true },
    { name: 'Dumbbell Calf Raise', pattern: 'calf', muscle: 'legs', equip: 'dumbbell', avoid: [], beginner: true },
    { name: 'Bodyweight Calf Raise', pattern: 'calf', muscle: 'legs', equip: 'bodyweight', avoid: [], beginner: true },
    { name: 'Plank', pattern: 'core', muscle: 'core', equip: 'bodyweight', avoid: [], beginner: true },
    { name: 'Dead Bug', pattern: 'core', muscle: 'core', equip: 'bodyweight', avoid: [], beginner: true },
    { name: 'Hanging Knee Raise', pattern: 'core', muscle: 'core', equip: 'bodyweight', avoid: [], beginner: false },
    { name: 'Cable Crunch', pattern: 'core', muscle: 'core', equip: 'cable', avoid: ['back'], beginner: true },
    { name: 'Farmer Carry', pattern: 'core', muscle: 'core', equip: 'dumbbell', avoid: [], beginner: true }
];

const GOAL_LABELS = { muscle: 'Build muscle', loss: 'Lose fat', strength: 'Get stronger', health: 'Stay in shape' };
const EXPERIENCE_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const EQUIPMENT_LABELS = { full: 'Full gym', basic: 'Basic gym', home: 'Home with dumbbells', bodyweight: 'Bodyweight only' };
const MUSCLE_LABELS = { chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', legs: 'Legs', glutes: 'Glutes', core: 'Core' };

// Which muscles a priority answer boosts.
const PRIORITY_MUSCLES = {
    chest: ['chest'], back: ['back'], arms: ['arms'], shoulders: ['shoulders'],
    glutes: ['glutes'], legs: ['legs'], core: ['core']
};

// Sets and reps per goal. rir = reps left in the tank (how far from failure).
const GOAL_PRESCRIPTION = {
    muscle: { mainSets: 4, accessorySets: 3, mainReps: '6–10', accessoryReps: '10–15', rir: '1–2' },
    strength: { mainSets: 5, accessorySets: 3, mainReps: '3–5', accessoryReps: '8–12', rir: '2–3' },
    loss: { mainSets: 3, accessorySets: 3, mainReps: '6–10', accessoryReps: '10–15', rir: '2' },
    health: { mainSets: 3, accessorySets: 2, mainReps: '8–12', accessoryReps: '10–15', rir: '2–3' }
};

const BASE_VOLUME = { beginner: 8, intermediate: 13, advanced: 17 };
const GOAL_VOLUME_SHIFT = { muscle: 2, loss: -1, strength: -1, health: 0 };
const RECOVERY_SHIFT = { good: 2, average: 0, poor: -3 };

// Day templates: ordered movement slots. "main" slots are the heavy lifts and are
// kept when a session has to be trimmed to fit the available time.
const DAY_TEMPLATES = {
    'Full Body': [
        { pattern: 'squat', role: 'main' },
        { pattern: 'hpush', role: 'main' },
        { pattern: 'hpull', role: 'main' },
        { pattern: 'hinge', role: 'accessory' },
        { pattern: 'lateral', role: 'accessory' },
        { pattern: 'core', role: 'accessory' }
    ],
    Push: [
        { pattern: 'hpush', role: 'main' },
        { pattern: 'vpush', role: 'main' },
        { pattern: 'fly', role: 'accessory' },
        { pattern: 'lateral', role: 'accessory' },
        { pattern: 'triceps', role: 'accessory' },
        { pattern: 'core', role: 'accessory' }
    ],
    Pull: [
        { pattern: 'vpull', role: 'main' },
        { pattern: 'hpull', role: 'main' },
        { pattern: 'reardelt', role: 'accessory' },
        { pattern: 'biceps', role: 'accessory' },
        { pattern: 'hamstring', role: 'accessory' },
        { pattern: 'core', role: 'accessory' }
    ],
    Legs: [
        { pattern: 'squat', role: 'main' },
        { pattern: 'hinge', role: 'main' },
        { pattern: 'lunge', role: 'accessory' },
        { pattern: 'hamstring', role: 'accessory' },
        { pattern: 'quad', role: 'accessory' },
        { pattern: 'calf', role: 'accessory' }
    ],
    Upper: [
        { pattern: 'hpush', role: 'main' },
        { pattern: 'vpull', role: 'main' },
        { pattern: 'vpush', role: 'accessory' },
        { pattern: 'hpull', role: 'accessory' },
        { pattern: 'lateral', role: 'accessory' },
        { pattern: 'biceps', role: 'accessory' },
        { pattern: 'triceps', role: 'accessory' }
    ],
    Lower: [
        { pattern: 'squat', role: 'main' },
        { pattern: 'hinge', role: 'main' },
        { pattern: 'lunge', role: 'accessory' },
        { pattern: 'hamstring', role: 'accessory' },
        { pattern: 'calf', role: 'accessory' },
        { pattern: 'core', role: 'accessory' }
    ]
};

// Weekly split by training days and experience.
function getSplit(days, experience) {
    const beginner = experience === 'beginner';
    switch (Number(days)) {
        case 2: return ['Full Body', 'Full Body'];
        case 3: return beginner ? ['Full Body', 'Full Body', 'Full Body'] : ['Push', 'Pull', 'Legs'];
        case 4: return ['Upper', 'Lower', 'Upper', 'Lower'];
        case 5: return beginner
            ? ['Upper', 'Lower', 'Full Body', 'Upper', 'Lower']
            : ['Push', 'Pull', 'Legs', 'Upper', 'Lower'];
        case 6: return ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'];
        default: return ['Full Body', 'Full Body'];
    }
}

// Weekly set budget per muscle, before priorities.
function getVolumeBudget(answers) {
    const base = BASE_VOLUME[answers.experience] ?? BASE_VOLUME.beginner;
    const total = base + (GOAL_VOLUME_SHIFT[answers.goal] ?? 0) + (RECOVERY_SHIFT[answers.recovery] ?? 0);
    return Math.max(6, total);
}

function isAvailable(exercise, answers) {
    const kit = EQUIPMENT_TIERS[answers.equipment] || EQUIPMENT_TIERS.full;
    if (!kit.includes(exercise.equip)) return false;
    if ((answers.injuries || []).some((injury) => exercise.avoid.includes(injury))) return false;
    if (answers.experience === 'beginner' && !exercise.beginner) return false;
    return true;
}

// Picks an exercise for a slot. `variant` shifts the choice so a repeated day
// (second Push week, say) doesn't come out identical to the first.
function pickExercise(pattern, answers, used, variant) {
    let options = EXERCISES.filter((exercise) => exercise.pattern === pattern && isAvailable(exercise, answers));

    // Beginners may leave nothing available for a slot; fall back to any safe option.
    if (!options.length) {
        options = EXERCISES.filter((exercise) => exercise.pattern === pattern
            && (EQUIPMENT_TIERS[answers.equipment] || []).includes(exercise.equip)
            && !(answers.injuries || []).some((injury) => exercise.avoid.includes(injury)));
    }
    if (!options.length) return null;

    const unused = options.filter((exercise) => !used.has(exercise.name));
    const pool = unused.length ? unused : options;
    const choice = pool[variant % pool.length];
    used.add(choice.name);
    return choice;
}

function setsForSlot(slot, answers, prescription, priorityMuscles, exercise) {
    const base = slot.role === 'main' ? prescription.mainSets : prescription.accessorySets;
    const boosted = exercise && priorityMuscles.includes(exercise.muscle) ? base + 1 : base;
    return Math.max(2, boosted);
}

function estimateMinutes(exercises) {
    // Heavy sets need longer rests than accessories. Plus a warm-up.
    const minutes = exercises.reduce((total, exercise) => total + exercise.sets * (exercise.role === 'main' ? 3 : 2), 0);
    return Math.round(minutes + 8);
}

// Cuts a session down to the time available: first drop the least important
// exercises, then shave sets, never going below 2 sets or 2 exercises.
function fitToTime(exercises, sessionMinutes) {
    const target = Number(sessionMinutes);
    let trimmed = 0;

    while (estimateMinutes(exercises) > target && exercises.length > 2) {
        const reversed = [...exercises].reverse();
        let dropIndex = reversed.findIndex((exercise) => exercise.role !== 'main' && !exercise.priority);
        if (dropIndex === -1) dropIndex = reversed.findIndex((exercise) => exercise.role !== 'main');
        if (dropIndex === -1) break;
        exercises.splice(exercises.length - 1 - dropIndex, 1);
        trimmed += 1;
    }

    while (estimateMinutes(exercises) > target) {
        const reducible = exercises.filter((exercise) => exercise.sets > 2);
        if (!reducible.length) break;
        const accessories = reducible.filter((exercise) => exercise.role !== 'main');
        const pool = accessories.length ? accessories : reducible;
        pool.sort((a, b) => b.sets - a.sets)[0].sets -= 1;
    }

    return trimmed;
}

function cardioPlan(answers) {
    if (answers.cardio === 'none') return null;
    const sessions = answers.cardio === 'lots' ? '3–4' : '2';
    if (answers.goal === 'loss') {
        return {
            title: 'Cardio',
            sessions,
            detail: `${sessions} sessions per week: 20–30 minutes of intervals (30s hard / 60s easy) or a brisk incline walk on rest days.`
        };
    }
    return {
        title: 'Cardio',
        sessions,
        detail: `${sessions} easy sessions per week of 20–30 minutes (walk, bike or row), kept easy so it doesn't eat into recovery.`
    };
}

function progressionPlan(answers) {
    const prescription = GOAL_PRESCRIPTION[answers.goal] || GOAL_PRESCRIPTION.muscle;
    const bump = answers.experience === 'beginner'
        ? 'Add weight every week you hit the top of the rep range on all sets.'
        : answers.experience === 'intermediate'
            ? 'Add weight every 1–2 weeks once you hit the top of the rep range on all sets.'
            : 'Add weight every 2–3 weeks, or add a set to your priority muscles instead.';

    return [
        `Stop each set about ${prescription.rir} reps short of failure.`,
        'Work up the rep range first: when every set hits the top number, add 2.5–5 kg and start again at the bottom.',
        bump,
        answers.experience === 'beginner'
            ? 'Take an easier week whenever sessions start feeling heavy, usually around week 8.'
            : 'Every 6th week, cut your sets in half and keep the weight, to freshen up.',
        'Log your weights and reps. If the numbers stop moving for 3 weeks, check sleep, food and stress first.'
    ];
}

function recoveryNotes(answers) {
    const notes = ['Warm up 5–10 minutes and do 1–2 light sets before your first heavy exercise.'];
    if (answers.recovery === 'poor') {
        notes.push('Your plan is deliberately shorter because of low sleep and high stress. Build the habit first, then add volume.');
    }
    if ((answers.injuries || []).length) {
        notes.push('Exercises that usually aggravate your problem areas were left out. If something still hurts, stop that exercise.');
    }
    if (answers.goal === 'loss') {
        notes.push('Keep protein high while in a deficit so you keep the muscle you already have.');
    }
    if (answers.goal === 'muscle') {
        notes.push('Eat slightly above maintenance and aim for 1.6–2.2g protein per kg of bodyweight.');
    }
    notes.push('Sleep 7–9 hours. That does more for progress than any exercise swap.');
    return notes;
}

// Builds the whole plan from the questionnaire answers.
function buildWorkoutPlan(answers) {
    const prescription = GOAL_PRESCRIPTION[answers.goal] || GOAL_PRESCRIPTION.muscle;
    const split = getSplit(answers.days, answers.experience);
    const budget = getVolumeBudget(answers);
    const priorityMuscles = (answers.priorities || []).flatMap((key) => PRIORITY_MUSCLES[key] || []);
    const seenTypes = {};

    const days = split.map((type, index) => {
        const variant = seenTypes[type] = (seenTypes[type] ?? -1) + 1;
        const template = DAY_TEMPLATES[type] || DAY_TEMPLATES['Full Body'];
        const used = new Set();

        let exercises = template.map((slot) => {
            const exercise = pickExercise(slot.pattern, answers, used, variant);
            if (!exercise) return null;
            const sets = setsForSlot(slot, answers, prescription, priorityMuscles, exercise);
            return {
                name: exercise.name,
                muscle: exercise.muscle,
                role: slot.role,
                sets,
                reps: slot.role === 'main' ? prescription.mainReps : prescription.accessoryReps,
                priority: priorityMuscles.includes(exercise.muscle)
            };
        }).filter(Boolean);

        // Add one extra exercise for a priority muscle when there's time for it.
        const extraPattern = { chest: 'fly', back: 'hpull', arms: 'biceps', shoulders: 'lateral', glutes: 'hinge', legs: 'lunge', core: 'core' };
        (answers.priorities || []).forEach((key) => {
            const pattern = extraPattern[key];
            const trainedToday = exercises.some((exercise) => PRIORITY_MUSCLES[key]?.includes(exercise.muscle));
            if (!pattern || !trainedToday) return;
            const exercise = pickExercise(pattern, answers, used, variant + 1);
            if (!exercise) return;
            exercises.push({
                name: exercise.name,
                muscle: exercise.muscle,
                role: 'accessory',
                sets: prescription.accessorySets,
                reps: prescription.accessoryReps,
                priority: true
            });
        });

        // Trim to fit the time available.
        const trimmed = fitToTime(exercises, answers.sessionMinutes);

        return {
            day: `Day ${index + 1}`,
            title: type,
            exercises,
            minutes: estimateMinutes(exercises),
            trimmed
        };
    });

    // Weekly sets per muscle, so the user can see where the work actually goes.
    const weeklySets = {};
    days.forEach((day) => day.exercises.forEach((exercise) => {
        weeklySets[exercise.muscle] = (weeklySets[exercise.muscle] || 0) + exercise.sets;
    }));

    return {
        answers,
        split,
        days,
        budget,
        prescription,
        priorityMuscles,
        weeklySets,
        cardio: cardioPlan(answers),
        progression: progressionPlan(answers),
        recovery: recoveryNotes(answers),
        sessionMinutes: Math.max(...days.map((day) => day.minutes))
    };
}

function describeExercise(exercise) {
    return `${exercise.name} — ${exercise.sets} × ${exercise.reps}`;
}

function planSummaryChips(plan) {
    const answers = plan.answers;
    const chips = [
        GOAL_LABELS[answers.goal] || answers.goal,
        EXPERIENCE_LABELS[answers.experience] || answers.experience,
        `${answers.days} days / week`,
        `~${plan.sessionMinutes} min / session`,
        EQUIPMENT_LABELS[answers.equipment] || answers.equipment
    ];
    if ((answers.priorities || []).length) {
        chips.push('Focus: ' + answers.priorities.map((key) => MUSCLE_LABELS[key] || key).join(', '));
    }
    if ((answers.injuries || []).length) {
        chips.push('Working around: ' + answers.injuries.join(', '));
    }
    return chips;
}

// ---- Database helpers ----

function planToRow(answers, userId) {
    return {
        user_id: userId,
        name: answers.name || '',
        gender: answers.gender,
        weight_kg: Number(Number(answers.weight).toFixed(1)),
        height_cm: answers.height,
        age: answers.age,
        days: Number(answers.days),
        goal: answers.goal,
        answers
    };
}

function rowToAnswers(row) {
    if (row.answers) return row.answers;
    // Plans saved before the questionnaire: fill in sensible defaults.
    return {
        goal: row.goal === 'gain' ? 'muscle' : row.goal === 'maintain' ? 'health' : row.goal,
        experience: 'intermediate',
        days: Number(row.days),
        sessionMinutes: 60,
        equipment: 'full',
        injuries: [],
        priorities: [],
        recovery: 'average',
        cardio: 'none',
        name: row.name || '',
        gender: row.gender,
        age: Number(row.age),
        weight: Number(row.weight_kg),
        height: Number(row.height_cm)
    };
}

// ---- Week layout (shared with calendar.html and profile.html) ----

// Sessions in one shape for both plan formats: questionnaire plans come from the
// engine, older plans from plan-builder.js.
function sessionsFromRow(row) {
    if (row && row.answers) {
        return buildWorkoutPlan(rowToAnswers(row)).days.map((day) => ({
            title: day.title,
            minutes: day.minutes,
            exercises: day.exercises.map((exercise) => `${exercise.name} — ${exercise.sets} × ${exercise.reps}`)
        }));
    }
    if (typeof getPlanSessions === 'function' && typeof rowToPlan === 'function') {
        return getPlanSessions(rowToPlan(row));
    }
    return [];
}

// Training days spread across the week, with rest days in between.
function weeklyScheduleFromRow(row, overrides) {
    const sessions = sessionsFromRow(row);
    const layout = typeof getWeeklyTrainingLayout === 'function'
        ? getWeeklyTrainingLayout(Number(row.days), overrides)
        : sessions.map(() => true);
    let dayNumber = 0;

    return layout.map((isTraining) => {
        if (isTraining && dayNumber < sessions.length) {
            dayNumber += 1;
            return { type: 'training', dayNumber, session: sessions[dayNumber - 1] };
        }
        return { type: 'rest' };
    });
}

// ---- PDF ----

// One-page PDF: black space-style background, lime accents, days down the left
// and the coaching notes on the right.
const PDF = {
    bg: [8, 8, 8],
    panel: [20, 20, 20],
    line: [48, 48, 48],
    accent: [197, 242, 63],
    text: [245, 245, 245],
    muted: [168, 168, 168]
};

function createWorkoutPdf(plan, date = new Date()) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 34;
    const width = pageWidth - margin * 2;
    const answers = plan.answers;

    const fill = (colour) => doc.setFillColor(colour[0], colour[1], colour[2]);
    const stroke = (colour) => doc.setDrawColor(colour[0], colour[1], colour[2]);
    const ink = (colour) => doc.setTextColor(colour[0], colour[1], colour[2]);
    const opacity = (value) => doc.setGState(new doc.GState({ opacity: value }));

    // ---- Background: glow rising from the bottom, with a black hole over the middle ----
    fill(PDF.bg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    const glowLayers = [
        { colour: [38, 74, 58], rx: 520, ry: 330, alpha: 0.75 },
        { colour: [72, 132, 92], rx: 430, ry: 268, alpha: 0.7 },
        { colour: [126, 186, 98], rx: 330, ry: 198, alpha: 0.65 },
        { colour: PDF.accent, rx: 232, ry: 130, alpha: 0.6 },
        { colour: [238, 255, 200], rx: 130, ry: 66, alpha: 0.5 }
    ];
    glowLayers.forEach((layer) => {
        opacity(layer.alpha);
        fill(layer.colour);
        doc.ellipse(pageWidth / 2, pageHeight + 52, layer.rx, layer.ry, 'F');
    });

    // The "black hole": soft black ellipses eating the middle, leaving a glowing rim.
    for (let i = 0; i < 12; i++) {
        opacity(0.4);
        fill(PDF.bg);
        doc.ellipse(pageWidth / 2, pageHeight - 78, 268 - i * 7, 172 - i * 6, 'F');
    }

    // Stars.
    const starSeed = [17, 61, 94, 131, 172, 203, 241, 287, 319, 352, 401, 444, 478, 512, 549];
    starSeed.forEach((value, index) => {
        opacity(0.15 + ((index * 7) % 5) / 10);
        fill([255, 255, 255]);
        const x = (value * 7) % (pageWidth - 60) + 30;
        const y = (value * 13) % (pageHeight - 260) + 130;
        doc.circle(x, y, index % 4 === 0 ? 1.1 : 0.6, 'F');
    });
    opacity(1);

    // ---- Header ----
    fill(PDF.accent);
    doc.rect(margin, 34, 16, 16, 'F');
    ink(PDF.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('BROTEIN', margin + 24, 46);
    ink(PDF.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${(answers.name || 'ATHLETE').toUpperCase()}  •  ${date.toLocaleDateString()}`, pageWidth - margin, 46, { align: 'right' });

    stroke(PDF.line);
    doc.setLineWidth(0.6);
    doc.line(margin, 58, pageWidth - margin, 58);

    ink(PDF.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(27);
    doc.text('YOUR TRAINING', margin, 88);
    ink(PDF.accent);
    doc.text((GOAL_LABELS[answers.goal] || 'PLAN').toUpperCase(), margin, 114);

    // ---- Stat strip ----
    const stats = [
        ['DAYS / WEEK', String(answers.days)],
        ['PER SESSION', `${plan.sessionMinutes} MIN`],
        ['LEVEL', (EXPERIENCE_LABELS[answers.experience] || '').toUpperCase()],
        ['TRAINING AT', (EQUIPMENT_LABELS[answers.equipment] || '').toUpperCase()]
    ];
    const statWidth = (width - 3 * 8) / 4;
    stats.forEach(([label, value], index) => {
        const x = margin + index * (statWidth + 8);
        fill(PDF.panel);
        doc.rect(x, 126, statWidth, 34, 'F');
        fill(PDF.accent);
        doc.rect(x, 126, 2, 34, 'F');
        ink(PDF.muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text(label, x + 9, 139);
        ink(PDF.text);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(value, x + 9, 152);
    });

    // ---- Two columns: days on the left, notes on the right ----
    const top = 174;
    const bottom = pageHeight - 34;
    const gap = 12;
    const leftWidth = Math.round(width * 0.62);
    const rightWidth = width - leftWidth - gap;
    const rightX = margin + leftWidth + gap;

    // Day cards stacked down the left, shrunk until the week fits the page.
    let fontSize = 8;
    let lineHeight = 10.5;
    const heights = () => plan.days.map((day) => 30 + day.exercises.length * lineHeight + 10);
    const total = () => heights().reduce((sum, height) => sum + height + 8, -8);

    while (total() > bottom - top && fontSize > 5.4) {
        fontSize -= 0.25;
        lineHeight -= 0.4;
    }

    // Share out any spare height so the column fills the page.
    const cardHeights = heights();
    const spare = (bottom - top) - total();
    const bonus = spare > 0 ? spare / plan.days.length : 0;

    let y = top;
    plan.days.forEach((day, index) => {
        const height = cardHeights[index] + bonus;

        fill(PDF.panel);
        doc.rect(margin, y, leftWidth, height, 'F');
        stroke(PDF.line);
        doc.setLineWidth(0.5);
        doc.rect(margin, y, leftWidth, height, 'S');
        fill(PDF.accent);
        doc.rect(margin, y, 3, height, 'F');

        ink(PDF.accent);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(String(index + 1).padStart(2, '0'), margin + 12, y + 20);
        ink(PDF.text);
        doc.setFontSize(10);
        doc.text(day.title.toUpperCase(), margin + 34, y + 20);
        ink(PDF.muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text(`~${day.minutes} MIN`, margin + leftWidth - 12, y + 20, { align: 'right' });

        stroke(PDF.line);
        doc.setLineWidth(0.4);
        doc.line(margin + 12, y + 26, margin + leftWidth - 12, y + 26);

        doc.setFontSize(fontSize);
        let lineY = y + 38;
        day.exercises.forEach((exercise) => {
            ink(exercise.priority ? PDF.accent : PDF.muted);
            doc.text(`${exercise.name}  ${exercise.sets} x ${exercise.reps}`, margin + 12, lineY);
            lineY += lineHeight;
        });

        y += height + 8;
    });

    // Notes down the right.
    const notes = [
        ['HOW TO PROGRESS', plan.progression.slice(0, 4)],
        ['CARDIO', [plan.cardio ? plan.cardio.detail : 'No cardio in this plan. Walk when you can.']],
        ['RECOVERY', plan.recovery.slice(0, 3)]
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    const noteGap = 8;
    const noteBlocks = notes.map(([title, lines]) => {
        const wrapped = lines.filter(Boolean).map((line) => doc.splitTextToSize(`• ${line}`, rightWidth - 22));
        return { title, wrapped, needed: 26 + wrapped.reduce((sum, block) => sum + block.length * 8.4 + 4, 0) + 8 };
    });
    const noteSpare = (bottom - top) - noteGap * (notes.length - 1) - noteBlocks.reduce((sum, block) => sum + block.needed, 0);
    const noteBonus = noteSpare > 0 ? noteSpare / noteBlocks.length : 0;

    let noteY = top;
    noteBlocks.forEach(({ title, wrapped, needed }) => {
        const height = needed + noteBonus;

        fill(PDF.panel);
        doc.rect(rightX, noteY, rightWidth, height, 'F');
        fill(PDF.accent);
        doc.rect(rightX, noteY, rightWidth, 2, 'F');
        ink(PDF.text);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(title, rightX + 11, noteY + 18);

        ink(PDF.muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        let lineY = noteY + 31;
        wrapped.forEach((block) => {
            doc.text(block, rightX + 11, lineY);
            lineY += block.length * 8.4 + 4;
        });

        noteY += height + noteGap;
    });

    return doc;
}

function getWorkoutPdfFilename(answers) {
    return `${(answers.name || 'athlete').replace(/\s+/g, '_').toLowerCase()}_brotein_plan.pdf`;
}
