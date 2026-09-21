// Workout plan logic shared by plan.html (generating) and profile.html (viewing a saved plan).
// A plan is described by its inputs: { name, weight (kg), height (cm), age, days, goal, gender }.

function convertWeightToKg(weight, unit) {
    return unit === 'lbs' ? weight / 2.20462 : weight;
}

function getGoalPlan(goal, days, gender) {
    const femaleFocus = gender === 'female';
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
            split: days >= 5
                ? (femaleFocus ? ['Legs', 'Upper', 'Legs', 'Lower', 'Conditioning'] : ['Push', 'Pull', 'Legs', 'Upper', 'Lower'])
                : days === 4
                    ? (femaleFocus ? ['Legs', 'Upper', 'Lower', 'Conditioning'] : ['Push', 'Pull', 'Legs', 'Full Body'])
                    : days === 3
                        ? (femaleFocus ? ['Legs', 'Lower', 'Upper'] : ['Push', 'Pull', 'Legs'])
                        : ['Full Body', 'Full Body']
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
            split: days >= 5
                ? (femaleFocus ? ['Legs', 'Upper', 'Legs', 'Lower', 'Conditioning'] : ['Push', 'Pull', 'Legs', 'Upper', 'Lower'])
                : days === 4
                    ? (femaleFocus ? ['Legs', 'Upper', 'Lower', 'Full Body'] : ['Push', 'Pull', 'Legs', 'Full Body'])
                    : days === 3
                        ? (femaleFocus ? ['Legs', 'Upper', 'Lower'] : ['Push', 'Pull', 'Legs'])
                        : ['Full Body', 'Full Body']
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
            split: days >= 5
                ? (femaleFocus ? ['Legs', 'Upper', 'Legs', 'Lower', 'Conditioning'] : ['Push', 'Pull', 'Legs', 'Upper', 'Lower'])
                : days === 4
                    ? (femaleFocus ? ['Legs', 'Upper', 'Lower', 'Full Body'] : ['Push', 'Pull', 'Legs', 'Full Body'])
                    : days === 3
                        ? (femaleFocus ? ['Legs', 'Lower', 'Upper'] : ['Push', 'Pull', 'Legs'])
                        : ['Full Body', 'Full Body']
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
            split: days >= 5
                ? (femaleFocus ? ['Legs', 'Upper', 'Legs', 'Lower', 'Conditioning'] : ['Push', 'Pull', 'Legs', 'Upper', 'Lower'])
                : days === 4
                    ? (femaleFocus ? ['Legs', 'Upper', 'Lower', 'Full Body'] : ['Push', 'Pull', 'Legs', 'Full Body'])
                    : days === 3
                        ? (femaleFocus ? ['Legs', 'Lower', 'Upper'] : ['Push', 'Pull', 'Legs'])
                        : ['Full Body', 'Full Body']
        }
    };

    return goalMap[goal] || goalMap.muscle;
}

const SESSION_EXERCISES = {
    'Push': ['Barbell Bench Press — 3 x 6', 'Incline DB Press — 3 x 8', 'Seated Overhead Press — 2 x 8', 'Cable Triceps Pressdown — 2 x 10'],
    'Pull': ['Weighted Pull-Up or Lat Pulldown — 3 x 6', 'Single-Arm Row — 3 x 8', 'Chest-Supported Row — 2 x 10', 'Face Pulls — 2 x 12'],
    'Legs': ['Back Squat — 3 x 6', 'Romanian Deadlift — 3 x 8', 'Leg Press — 2 x 10', 'Walking Lunges — 2 x 10'],
    'Upper': ['Bench Press — 3 x 6', 'Pull-Up or Lat Pulldown — 3 x 8', 'Shoulder Press — 2 x 8', 'Cable Row — 2 x 10'],
    'Lower': ['Front Squat or Goblet Squat — 3 x 6', 'Hip Thrust — 3 x 8', 'Leg Curl — 2 x 10', 'Split Squat — 2 x 10'],
    'Conditioning': ['Bike Intervals — 6 rounds of 30s hard / 60s easy', 'Rowing — 4 x 500m moderate', 'Core Circuit — 2 x 10 reps each'],
    'Full Body': ['Squat or Leg Press — 3 x 6', 'Bench Press or Dumbbell Press — 3 x 8', 'Lat Pulldown — 2 x 10', 'Romanian Deadlift — 2 x 8', 'Planks — 2 x 30s']
};

const RECOVERY_LINES = [
    'Sleep 7–9 hours nightly',
    'Keep 1–2 rest days if training 4+ days a week',
    'Warm up for 5–10 minutes before each session',
    'Progress with reps first, then load every 1–2 weeks'
];

// Returns [{ title, exercises }] for each training day of the plan.
function getPlanSessions(plan) {
    const split = getGoalPlan(plan.goal, Number(plan.days), plan.gender).split;
    const sessions = [];
    for (let i = 0; i < Math.min(Number(plan.days), split.length); i++) {
        const title = SESSION_EXERCISES[split[i]] ? split[i] : 'Full Body';
        sessions.push({ title, exercises: SESSION_EXERCISES[title] });
    }
    return sessions;
}

function getPlanBmi(plan) {
    return plan.weight / ((plan.height / 100) * (plan.height / 100));
}

function drawSection(doc, title, lines, startY, leftMargin, width) {
    doc.setDrawColor(255, 255, 255);
    doc.setFillColor(22, 22, 22);
    doc.roundedRect(leftMargin, startY, width, 22, 8, 8, 'F');
    doc.setTextColor(243, 243, 241);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, leftMargin + 12, startY + 15);

    let y = startY + 34;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(225, 225, 225);

    lines.forEach((line) => {
        const text = line.startsWith('- ') ? `• ${line.slice(2)}` : line;
        const splitLines = doc.splitTextToSize(text, width - 18);
        doc.text(splitLines, leftMargin + 10, y);
        y += splitLines.length * 12 + 4;
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

    doc.setFillColor(13, 13, 13);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1);

    doc.setTextColor(243, 243, 241);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('Brotein Training Plan', margin, y);

    y += 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(178, 178, 173);
    doc.text(`${plan.name || 'Athlete'} • ${date.toLocaleDateString()} • ${plan.goal ? plan.goal.charAt(0).toUpperCase() + plan.goal.slice(1) : 'Muscle gain'} goal`, margin, y);

    y += 26;
    doc.setDrawColor(255, 255, 255);
    doc.setFillColor(20, 20, 20);
    doc.roundedRect(margin, y, width, 70, 10, 10, 'FD');
    doc.setTextColor(243, 243, 241);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Overview', margin + 16, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(`Training days: ${plan.days} / week`, margin + 16, y + 36);
    doc.text(`Gender: ${plan.gender === 'female' ? 'Female' : 'Male'}`, margin + 220, y + 36);
    doc.text(`Weight: ${plan.weight.toFixed(1)} kg`, margin + 16, y + 50);
    doc.text(`Height: ${plan.height} cm`, margin + 180, y + 50);
    doc.text(`Age: ${plan.age}`, margin + 300, y + 50);
    doc.text(`Estimated BMI: ${getPlanBmi(plan).toFixed(1)}`, margin + 16, y + 64);

    y += 90;

    const goalPlan = getGoalPlan(plan.goal, plan.days, plan.gender);
    y = drawSection(doc, 'Plan Focus', [goalPlan.focus, goalPlan.weekly, goalPlan.nutrition], y, margin, width);

    const daySection = [];
    getPlanSessions(plan).forEach((session, index) => {
        daySection.push(`Day ${index + 1} — ${session.title}`);
        session.exercises.forEach((exercise) => daySection.push(`- ${exercise}`));
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
