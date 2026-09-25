// Workout plan logic shared by plan.html (generating) and profile.html (viewing a saved plan).
// A plan is described by its inputs: { name, weight (kg), height (cm), age, days, goal, gender }.

function convertWeightToKg(weight, unit) {
    return unit === 'lbs' ? weight / 2.20462 : weight;
}

function getGoalPlan(goal, days, gender) {
    const femaleFocus = gender === 'female';
    const strictSplit = (days >= 5)
        ? (femaleFocus ? ['Legs', 'Push', 'Legs', 'Pull', 'Conditioning'] : ['Push', 'Pull', 'Legs', 'Push', 'Pull'])
        : days === 4
            ? (femaleFocus ? ['Legs', 'Push', 'Legs', 'Conditioning'] : ['Push', 'Pull', 'Legs', 'Full Body'])
            : days === 3
                ? (femaleFocus ? ['Legs', 'Push', 'Pull'] : ['Push', 'Pull', 'Legs'])
                : ['Full Body', 'Full Body'];

    const goalMap = {
        loss: {
            label: 'Weight loss',
            focus: femaleFocus
                ? 'Create a calorie deficit while prioritizing lower-body strength and keeping the overall program sustainable.'
                : 'Create a calorie deficit while keeping training performance high and protecting muscle.',
            weekly: femaleFocus
                ? 'Keep leg sessions hard and frequent, then use shorter upper-body work with controlled volume.'
                : 'Use conditioning sparingly and prioritize compound work that keeps muscle while improving conditioning.',
            nutrition: 'Keep protein high, carbs around your training, and aim for a modest deficit.',
            split: strictSplit
        },
        maintain: {
            label: 'Maintain',
            focus: femaleFocus
                ? 'Keep energy stable while leaning into leg development, muscle retention, and overall athletic performance.'
                : 'Keep your bodyweight stable while improving performance and strength.',
            weekly: femaleFocus
                ? 'Train your lower body with strong weekly frequency and keep upper-body work more supportive than dominant.'
                : 'Use a balanced split with moderate volume and enough recovery between hard sessions.',
            nutrition: 'Match calories to maintenance and keep protein steady at 1.6–2.2g/kg.',
            split: strictSplit
        },
        gain: {
            label: 'Weight gain',
            focus: femaleFocus
                ? 'Drive a small calorie surplus while building a stronger lower body and improving overall squat and hinge strength.'
                : 'Aim for a consistent calorie surplus with extra emphasis on progressive overload.',
            weekly: femaleFocus
                ? 'Keep the lower-body work dense and progressive while keeping upper-body work efficient and recovery-friendly.'
                : 'Use slightly higher work capacity and keep hard sets close to failure while preserving recovery.',
            nutrition: 'Add 200–300 kcal per day, keep protein high, and prioritize carbs around training.',
            split: strictSplit
        },
        muscle: {
            label: 'Muscle gain',
            focus: femaleFocus
                ? 'Prioritize leg-driven hypertrophy, glute and hamstring growth, and enough recovery to keep performance climbing.'
                : 'Prioritize progressive overload, extra quality volume, and high-protein nutrition.',
            weekly: femaleFocus
                ? 'Legs should lead the week with higher frequency and a little more total volume than the upper body.'
                : 'Train each muscle group with enough frequency to stimulate growth without crushing recovery.',
            nutrition: 'Target 1.6–2.2g of protein per kg of bodyweight and a small calorie surplus if needed.',
            split: strictSplit
        }
    };

    return goalMap[goal] || goalMap.muscle;
}

const RECOVERY_LINES = [
    'Train each muscle group 2x per week when recovering well',
    'Use 3–4 hard sets per exercise in the 6–12 rep range for hypertrophy',
    'Sleep 7–9 hours nightly and keep 1–2 rest days if training 4+ days a week',
    'Warm up for 5–10 minutes before each session and progress by adding reps before load',
    'Keep protein high and place carbs around training for better performance and recovery'
];

function getGoalVolume(goal) {
    switch (goal) {
        case 'loss':
            return { mainSets: 3, accessorySets: 2, emphasis: 'fat-loss-friendly volume' };
        case 'maintain':
            return { mainSets: 3, accessorySets: 3, emphasis: 'balanced volume' };
        case 'gain':
            return { mainSets: 4, accessorySets: 3, emphasis: 'performance and size' };
        case 'muscle':
        default:
            return { mainSets: 4, accessorySets: 3, emphasis: 'hypertrophy-focused volume' };
    }
}

function formatExercise(primary, alternates, sets) {
    if (!alternates || alternates.length === 0) {
        return `${primary} — ${sets}`;
    }
    return `${primary} or ${alternates.join(' / ')} — ${sets}`;
}

function getSessionExercises(title, plan, index = 0) {
    const goal = plan.goal || 'muscle';
    const gender = plan.gender || 'male';
    const volume = getGoalVolume(goal);
    const dayBias = index % 2 === 0 ? 'primary' : 'secondary';

    switch (title) {
        case 'Push': {
            const benchPrimary = goal === 'loss' ? 'Machine Chest Press' : 'Barbell Bench Press';
            const benchAlt = goal === 'loss' ? ['Incline Dumbbell Press', 'Cable Press'] : ['Incline Dumbbell Press', 'Smith Machine Press'];
            const pressVariant = gender === 'female' ? 'Seated Dumbbell Shoulder Press' : 'Standing Overhead Press';
            const chestVariant = goal === 'loss' ? 'Cable Fly' : 'Dumbbell Fly';
            const tricepsVariant = goal === 'loss' ? 'Cable Triceps Pressdown' : 'Skull Crusher';
            return [
                formatExercise(benchPrimary, benchAlt, `${volume.mainSets} x 6–8`),
                formatExercise('Incline Dumbbell Press', ['Machine Press', 'Flat Dumbbell Press'], `${volume.accessorySets} x 8–10`),
                formatExercise(pressVariant, ['Arnold Press', 'Landmine Press'], `${volume.accessorySets} x 8–10`),
                formatExercise('Cable Lateral Raise', ['Dumbbell Lateral Raise', 'Machine Lateral Raise'], `${volume.accessorySets} x 12–15`),
                formatExercise(chestVariant, ['Cable Fly', 'Push-Up'], `${goal === 'loss' ? 2 : 3} x 10–15`),
                formatExercise(tricepsVariant, ['Rope Pressdown', 'Close-Grip Bench Press'], `${goal === 'loss' ? 2 : 3} x 10–12`),
                formatExercise('Close-Grip Bench Press', ['Weighted Dip', 'Rope Pressdown'], `${goal === 'loss' ? 2 : 3} x 6–10`)
            ];
        }
        case 'Pull': {
            const pullMain = 'Lat Pulldown';
            const pullAlt = ['Single-Arm Cable Pulldown', 'Assisted Pull-Up', 'Machine-assisted Pull-Up'];
            const rowPrimary = goal === 'loss' ? 'Chest-Supported Row' : 'One-Arm Dumbbell Row';
            const rowAlt = goal === 'loss' ? ['Seated Cable Row', 'Single-Arm Cable Row'] : ['Chest-Supported Row', 'Seated Cable Row'];
            const curlMain = goal === 'loss' ? 'EZ-Bar Curl' : 'Barbell Curl';
            const curlAlt = ['Preacher Curl', 'Cable Curl'];
            const forearmMain = 'Reverse Curl';
            const shrugMain = gender === 'female' ? 'Dumbbell Shrug' : 'Barbell Shrug';
            return [
                formatExercise(pullMain, pullAlt, `${volume.mainSets} x 6–10`),
                formatExercise(rowPrimary, rowAlt, `${volume.accessorySets} x 8–10`),
                formatExercise('Face Pull', ['Rear-Delt Cable Fly', 'Band Pull-Apart'], `${volume.accessorySets} x 12–15`),
                formatExercise(curlMain, curlAlt, `${volume.accessorySets} x 8–10`),
                formatExercise(forearmMain, ['Hammer Curl', 'Wrist Curl'], `${goal === 'loss' ? 2 : 3} x 10–12`),
                formatExercise(shrugMain, ['Cable Shrug', 'Machine Shrug'], `${goal === 'loss' ? 2 : 3} x 8–12`)
            ];
        }
        case 'Legs': {
            const squatMain = goal === 'loss' ? 'Goblet Squat' : 'Back Squat';
            const squatAlt = goal === 'loss' ? ['Machine Squat', 'Leg Press'] : ['Front Squat', 'Leg Press'];
            const hingeMain = goal === 'loss' ? 'Romanian Deadlift' : 'Romanian Deadlift';
            const hingeAlt = ['Hip Thrust', 'Good Morning'];
            const hamstringMain = 'Leg Curl';
            return [
                formatExercise(squatMain, squatAlt, `${volume.mainSets} x 6–8`),
                formatExercise(hingeMain, hingeAlt, `${volume.mainSets} x 8–10`),
                formatExercise('Leg Press', ['Hack Squat', 'Walking Lunge'], `${volume.accessorySets} x 8–10`),
                formatExercise(hamstringMain, ['Nordic Curl', 'Single-Leg Romanian Deadlift'], `${volume.accessorySets} x 8–12`),
                formatExercise('Walking Lunges', ['Split Squat', 'Bulgarian Split Squat'], `${goal === 'loss' ? 2 : 3} x 10–12`)
            ];
        }
        case 'Upper': {
            const upperMain = goal === 'gain' ? 'Incline Bench Press' : 'Bench Press';
            return [
                formatExercise(upperMain, ['Flat DB Press', 'Machine Press'], `${volume.mainSets} x 6–8`),
                formatExercise('Lat Pulldown', ['Assisted Pull-Up', 'Machine-assisted Pull-Up'], `${volume.mainSets} x 6–10`),
                formatExercise('Seated Dumbbell Shoulder Press', ['Arnold Press', 'Machine Press'], `${volume.accessorySets} x 8–10`),
                formatExercise('Chest-Supported Row', ['Seated Cable Row', 'One-Arm Row'], `${volume.accessorySets} x 8–10`),
                formatExercise('Cable Lateral Raise', ['Dumbbell Lateral Raise', 'Machine Lateral Raise'], `${goal === 'loss' ? 2 : 3} x 12–15`)
            ];
        }
        case 'Lower': {
            const lowerMain = goal === 'loss' ? 'Leg Press' : 'Front Squat';
            const lowerAlt = goal === 'loss' ? ['Hack Squat', 'Goblet Squat'] : ['Goblet Squat', 'Hack Squat'];
            return [
                formatExercise(lowerMain, lowerAlt, `${volume.mainSets} x 6–8`),
                formatExercise('Hip Thrust', ['Glute Bridge', 'Good Morning'], `${volume.mainSets} x 8–10`),
                formatExercise('Leg Curl', ['Single-Leg Romanian Deadlift', 'Nordic Curl'], `${volume.accessorySets} x 8–12`),
                formatExercise('Split Squat', ['Bulgarian Split Squat', 'Walking Lunge'], `${goal === 'loss' ? 2 : 3} x 10–12`),
                formatExercise('Calf Raise', ['Seated Calf Raise', 'Single-Leg Calf Raise'], `${goal === 'loss' ? 2 : 3} x 10–15`)
            ];
        }
        case 'Conditioning': {
            return [
                'Bike Intervals — 6 rounds of 30s hard / 60s easy',
                'Rowing — 4 x 500m moderate',
                'Kettlebell Swings — 3 x 15',
                'Core Circuit — 2 x 10–12 reps each'
            ];
        }
        case 'Full Body': {
            const squatChoice = goal === 'loss' ? 'Leg Press' : 'Back Squat';
            const pressChoice = goal === 'loss' ? 'Dumbbell Press' : 'Barbell Bench Press';
            return [
                formatExercise(squatChoice, ['Goblet Squat', 'Hack Squat'], `${volume.mainSets} x 6–8`),
                formatExercise(pressChoice, ['Incline Dumbbell Press', 'Machine Chest Press'], `${volume.mainSets} x 8–10`),
                formatExercise('Lat Pulldown', ['Assisted Pull-Up', 'Machine-assisted Pull-Up'], `${volume.accessorySets} x 8–10`),
                formatExercise('Romanian Deadlift', ['Hip Thrust', 'Good Morning'], `${volume.accessorySets} x 8–10`),
                formatExercise('Planks', ['Hanging Knee Raise', 'Cable Crunch'], `${goal === 'loss' ? 2 : 3} x 30–45s`)
            ];
        }
        default:
            return ['Full Body Compound Work — 3 x 8–10', 'Accessible Accessory Work — 2 x 12', 'Core Circuit — 2 x 10–12'];
    }
}

// Returns [{ title, exercises }] for each training day of the plan.
function getPlanSessions(plan) {
    const split = getGoalPlan(plan.goal, Number(plan.days), plan.gender).split;
    const sessions = [];

    for (let i = 0; i < Math.min(Number(plan.days), split.length); i++) {
        const title = split[i] || 'Full Body';
        const cleanTitle = title === 'Upper' ? 'Push' : title === 'Lower' ? 'Legs' : title;

        if (cleanTitle === 'Push' || cleanTitle === 'Pull' || cleanTitle === 'Legs' || cleanTitle === 'Conditioning' || cleanTitle === 'Full Body') {
            sessions.push({
                title: cleanTitle,
                exercises: getSessionExercises(cleanTitle, plan, i)
            });
        }
    }

    return sessions;
}

// Spreads N training days across a 7-day week in blocks of at most 3 in a row,
// with a single rest day between blocks (e.g. 5 days -> train train train REST train train REST;
// 4 days -> train train REST train train REST REST). 2 or fewer days don't need a mid-week
// gap since they're already spaced out by the trailing rest days. `overrides`, if given as an
// array of 7 booleans, is used as-is (lets a user swap which weekdays they train).
function getWeeklyTrainingLayout(totalDays, overrides) {
    if (Array.isArray(overrides) && overrides.length === 7) return overrides;

    const days = Math.max(0, Math.min(7, Number(totalDays) || 0));
    if (days >= 7) return Array(7).fill(true);

    const block1 = days <= 3 ? days : Math.ceil(days / 2);
    const block2 = days <= 3 ? 0 : Math.floor(days / 2);

    const layout = [];
    for (let i = 0; i < block1; i++) layout.push(true);
    if (block2 > 0) layout.push(false);
    for (let i = 0; i < block2; i++) layout.push(true);
    while (layout.length < 7) layout.push(false);

    return layout;
}

// Returns 7 entries ({ type: 'training', dayNumber, session } or { type: 'rest' }) laying
// out getPlanSessions() over the week using getWeeklyTrainingLayout().
function getWeeklySchedule(plan, overrides) {
    const sessions = getPlanSessions(plan);
    const layout = getWeeklyTrainingLayout(Number(plan.days), overrides);
    let dayNumber = 0;

    return layout.map((isTraining) => {
        if (isTraining && dayNumber < sessions.length) {
            dayNumber += 1;
            return { type: 'training', dayNumber, session: sessions[dayNumber - 1] };
        }
        return { type: 'rest' };
    });
}

function getPlanBmi(plan) {
    return plan.weight / ((plan.height / 100) * (plan.height / 100));
}

function drawSection(doc, title, lines, startY, leftMargin, width) {
    doc.setDrawColor(89, 90, 93);
    doc.setFillColor(18, 18, 18);
    doc.roundedRect(leftMargin, startY, width, 26, 9, 9, 'F');
    doc.setTextColor(212, 248, 94);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(title.toUpperCase(), leftMargin + 14, startY + 16);

    let y = startY + 36;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.3);
    doc.setTextColor(229, 229, 229);

    lines.forEach((line) => {
        const text = line.startsWith('- ') ? `• ${line.slice(2)}` : line;
        const splitLines = doc.splitTextToSize(text, width - 22);
        doc.text(splitLines, leftMargin + 12, y);
        y += splitLines.length * 12 + 5;
    });

    return y + 12;
}

// Builds the plan PDF with jsPDF (window.jspdf must be loaded). `date` is shown in the header.
function createPlanPdf(plan, date = new Date()) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 52;
    const width = pageWidth - (margin * 2);
    let y = 52;

    doc.setFillColor(8, 8, 8);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(212, 248, 94);
    doc.setLineWidth(1);

    doc.setFillColor(18, 18, 18);
    doc.roundedRect(margin, 28, width, 48, 12, 12, 'F');
    doc.setTextColor(212, 248, 94);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('BROTEIN', margin + 16, 52);
    doc.setTextColor(180, 180, 180);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('TRAINING PLAN', margin + 118, 52);

    y += 36;
    doc.setTextColor(245, 245, 245);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(`${plan.name || 'Athlete'} plan`, margin, y);
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(178, 178, 173);
    doc.text(`${date.toLocaleDateString()} • ${plan.goal ? plan.goal.charAt(0).toUpperCase() + plan.goal.slice(1) : 'Muscle gain'} goal`, margin, y);

    y += 22;
    doc.setDrawColor(67, 68, 70);
    doc.setFillColor(16, 16, 16);
    doc.roundedRect(margin, y, width, 88, 12, 12, 'FD');
    doc.setTextColor(245, 245, 245);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text('OVERVIEW', margin + 16, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(`Training days: ${plan.days} / week`, margin + 16, y + 38);
    doc.text(`Gender: ${plan.gender === 'female' ? 'Female' : 'Male'}`, margin + 220, y + 38);
    doc.text(`Weight: ${plan.weight.toFixed(1)} kg`, margin + 16, y + 54);
    doc.text(`Height: ${plan.height} cm`, margin + 180, y + 54);
    doc.text(`Age: ${plan.age}`, margin + 300, y + 54);
    doc.text(`Estimated BMI: ${getPlanBmi(plan).toFixed(1)}`, margin + 16, y + 70);

    y += 102;

    const goalPlan = getGoalPlan(plan.goal, plan.days, plan.gender);
    y = drawSection(doc, 'Plan Focus', [goalPlan.focus, goalPlan.weekly, goalPlan.nutrition], y, margin, width);

    const daySection = [];
    getWeeklySchedule(plan).forEach((entry) => {
        if (entry.type === 'rest') {
            daySection.push('Rest Day');
            daySection.push('');
            return;
        }
        daySection.push(`Day ${entry.dayNumber} — ${entry.session.title}`);
        entry.session.exercises.forEach((exercise) => daySection.push(`- ${exercise}`));
        daySection.push('');
    });
    y = drawSection(doc, 'Weekly Schedule', daySection, y, margin, width);

    drawSection(doc, 'Recovery Rules', RECOVERY_LINES, y, margin, width);

    return doc;
}

function getPlanPdfFilename(plan) {
    return `${(plan.name || 'athlete').replace(/\s+/g, '_').toLowerCase()}_brotein_plan.pdf`;
}

// Converts between the form/PDF shape and a workout_plans database row.
function planToRow(plan, userId) {
    return {
        user_id: userId,
        name: plan.name,
        gender: plan.gender,
        weight_kg: Number(plan.weight.toFixed(1)),
        height_cm: plan.height,
        age: plan.age,
        days: plan.days,
        goal: plan.goal
    };
}

function rowToPlan(row) {
    return {
        name: row.name || '',
        gender: row.gender,
        weight: Number(row.weight_kg),
        height: Number(row.height_cm),
        age: Number(row.age),
        days: Number(row.days),
        goal: row.goal
    };
}
