function convertWeightToKg(weight, unit) {
    return unit === 'lbs' ? weight / 2.20462 : weight;
}

function calculateFoodPlanTargets(age, weightKg, height, goal, gender) {
    const sexAdjustment = gender === 'female' ? -161 : 5;
    const bmr = (10 * weightKg) + (6.25 * height) - (5 * age) + sexAdjustment;
    const maintenance = Math.max(0, bmr * 1.55);

    const goalConfig = {
        loss: { label: 'Weight loss', multiplier: 0.8, proteinMultiplier: 1.8 },
        maintain: { label: 'Maintain', multiplier: 1, proteinMultiplier: 1.8 },
        gain: { label: 'Weight gain', multiplier: 1.15, proteinMultiplier: 2.2 },
        muscle: { label: 'Muscle gain', multiplier: 1.12, proteinMultiplier: 2.2 }
    };

    const goalData = goalConfig[goal] || goalConfig.maintain;
    const dailyTarget = Math.round(maintenance * goalData.multiplier);
    const weeklyTarget = dailyTarget * 7;
    const proteinTarget = Math.round(weightKg * goalData.proteinMultiplier);

    return {
        maintenance,
        dailyTarget,
        weeklyTarget,
        proteinTarget,
        goalLabel: goalData.label,
        multiplier: goalData.multiplier
    };
}

function getWeeklyCaloriesBreakdown(plan) {
    const targets = calculateFoodPlanTargets(plan.age, plan.weight, plan.height, plan.goal, plan.gender);
    const variance = {
        loss: [0.9, 0.92, 0.95, 1.0, 0.96, 0.94, 0.93],
        maintain: [1, 1, 1, 1, 1, 1, 1],
        gain: [1.08, 1.1, 1.12, 1.14, 1.1, 1.09, 1.12],
        muscle: [1.08, 1.09, 1.12, 1.14, 1.1, 1.07, 1.11]
    };

    const ratio = variance[plan.goal] || variance.maintain;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return days.map((day, index) => {
        const kcal = Math.round(targets.dailyTarget * ratio[index]);
        const protein = Math.round(targets.proteinTarget * (plan.goal === 'loss' ? 0.96 : 1.04));
        const carbs = Math.round((kcal * 0.45) / 4);
        const fats = Math.round((kcal * 0.25) / 9);

        return {
            day,
            calories: kcal,
            protein,
            carbs,
            fats,
            meals: buildMealsForCalories(kcal, plan.goal)
        };
    });
}

function buildMealsForCalories(totalCalories, goal) {
    const isCut = goal === 'loss';
    const mealRatios = isCut
        ? [0.34, 0.33, 0.33]
        : [0.25, 0.3, 0.3, 0.15];

    const mealNames = isCut
        ? ['Breakfast', 'Lunch', 'Dinner']
        : ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

    const calories = mealRatios.map((ratio) => Math.round(totalCalories * ratio));
    const diff = totalCalories - calories.reduce((sum, value) => sum + value, 0);
    calories[0] += diff;

    const mealTemplates = {
        Breakfast: {
            cut: {
                main: 'Egg scramble: 3 eggs • 150 g spinach • 140 g potatoes • 1 whole-grain toast',
                alt: 'Greek yogurt 250 g • berries 200 g • 2 rice cakes'
            },
            gain: {
                main: 'Oats 90 g cooked with milk • 3 eggs • 1 banana 120 g • 25 g nuts',
                alt: 'Bagel 100 g • cottage cheese 250 g • berries 200 g'
            },
            maintain: {
                main: 'Oats 80 g cooked with milk • 2 eggs • berries 150 g',
                alt: 'Greek yogurt 250 g • oats 70 g • apple 180 g'
            }
        },
        Lunch: {
            cut: {
                main: 'Chicken breast 220 g • rice 180 g • broccoli 300 g • 10 ml olive oil',
                alt: 'Turkey mince 220 g • potatoes 200 g • green beans 300 g'
            },
            gain: {
                main: 'Chicken breast 250 g • rice 220 g • vegetables 300 g • 15 ml olive oil',
                alt: 'Lean beef 250 g • potatoes 220 g • mixed veg 300 g'
            },
            maintain: {
                main: 'Chicken breast 220 g • rice 200 g • vegetables 300 g • 10 ml olive oil',
                alt: 'Turkey breast 220 g • potatoes 220 g • asparagus 250 g'
            }
        },
        Dinner: {
            cut: {
                main: 'Salmon 200 g • potatoes 250 g • broccoli 250 g • 10 ml olive oil',
                alt: 'Cod 220 g • rice 220 g • greens 300 g'
            },
            gain: {
                main: 'Salmon 220 g • potatoes 300 g • rice 200 g • vegetables 250 g',
                alt: 'Lean beef 220 g • rice 250 g • spinach 300 g'
            },
            maintain: {
                main: 'Salmon 200 g • rice 220 g • vegetables 300 g • 10 ml olive oil',
                alt: 'Chicken thighs 220 g • potatoes 250 g • zucchini 250 g'
            }
        },
        Snack: {
            cut: {
                main: 'Whey protein 30 g • banana 120 g',
                alt: 'Greek yogurt 200 g • almonds 15 g'
            },
            gain: {
                main: 'Whey protein 35 g • banana 150 g • peanut butter 20 g',
                alt: 'Cottage cheese 250 g • apple 180 g'
            },
            maintain: {
                main: 'Whey protein 30 g • fruit 150 g • yogurt 200 g',
                alt: 'Protein shake 30 g • berries 150 g'
            }
        }
    };

    return mealNames.map((mealName, index) => {
        const templateKey = isCut ? 'cut' : goal === 'gain' || goal === 'muscle' ? 'gain' : 'maintain';
        const proteinRatio = isCut ? 0.32 : goal === 'gain' || goal === 'muscle' ? 0.35 : 0.33;
        const protein = Math.round((calories[index] * proteinRatio) / 4);

        return {
            name: mealName,
            calories: calories[index],
            protein,
            detail: mealTemplates[mealName][templateKey]
        };
    });
}

function getFoodPlanSummary(plan) {
    const targets = calculateFoodPlanTargets(plan.age, plan.weight, plan.height, plan.goal, plan.gender);
    const meals = getWeeklyCaloriesBreakdown(plan);

    return {
        ...targets,
        days: meals,
        weeklyAverage: Math.round(meals.reduce((sum, day) => sum + day.calories, 0) / meals.length),
        weeklyTotal: meals.reduce((sum, day) => sum + day.calories, 0)
    };
}

function foodPlanToRow(plan, userId) {
    const summary = getFoodPlanSummary(plan);
    return {
        user_id: userId,
        name: plan.name,
        gender: plan.gender,
        weight_kg: Number(plan.weight.toFixed(1)),
        height_cm: plan.height,
        age: plan.age,
        days: plan.days,
        goal: plan.goal,
        maintenance_calories: Math.round(summary.maintenance),
        daily_target_calories: summary.dailyTarget,
        weekly_target_calories: summary.weeklyTotal,
        protein_target_g: summary.proteinTarget
    };
}

function rowToFoodPlan(row) {
    return {
        name: row.name || '',
        gender: row.gender,
        weight: Number(row.weight_kg),
        height: Number(row.height_cm),
        age: Number(row.age),
        days: Number(row.days),
        goal: row.goal,
        maintenance_calories: Number(row.maintenance_calories),
        daily_target_calories: Number(row.daily_target_calories),
        weekly_target_calories: Number(row.weekly_target_calories),
        protein_target_g: Number(row.protein_target_g || 0)
    };
}

function formatCalories(value) {
    return `${new Intl.NumberFormat('en-US').format(value)} kcal`;
}

function createFoodPlanPdf(plan) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 52;
    const width = pageWidth - (margin * 2);
    const summary = getFoodPlanSummary(plan);
    let y = 52;

    function paintPageBackground() {
        doc.setFillColor(8, 8, 8);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
    }

    paintPageBackground();

    doc.setFillColor(18, 18, 18);
    doc.roundedRect(margin, 28, width, 48, 12, 12, 'F');
    doc.setTextColor(212, 248, 94);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('BROTEIN', margin + 16, 52);
    doc.setTextColor(180, 180, 180);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('FOOD PLAN', margin + 110, 52);

    y += 24;
    doc.setTextColor(245, 245, 245);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(`${plan.name || 'Athlete'} nutrition plan`, margin, y);
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(178, 178, 173);
    doc.text(`${plan.goal ? plan.goal.charAt(0).toUpperCase() + plan.goal.slice(1) : 'Maintain'} goal`, margin, y);

    y += 22;
    doc.setDrawColor(67, 68, 70);
    doc.setFillColor(16, 16, 16);
    doc.roundedRect(margin, y, width, 92, 12, 12, 'FD');
    doc.setTextColor(245, 245, 245);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text('TARGETS', margin + 16, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(`Daily target: ${formatCalories(summary.dailyTarget)}`, margin + 16, y + 38);
    doc.text(`Weekly target: ${formatCalories(summary.weeklyTotal)}`, margin + 260, y + 38);
    doc.text(`Maintenance: ${formatCalories(summary.maintenance)}`, margin + 16, y + 56);
    doc.text(`Protein target: ${summary.proteinTarget} g/day`, margin + 260, y + 56);
    doc.text(`Goal: ${summary.goalLabel}`, margin + 16, y + 74);

    y += 116;
    summary.days.forEach((dayPlan) => {
        const mealLines = [
            `${dayPlan.day} — ${formatCalories(dayPlan.calories)}`,
            `Protein: ${dayPlan.protein}g | Carbs: ${dayPlan.carbs}g | Fats: ${dayPlan.fats}g`,
            ...dayPlan.meals.map((meal) => {
                const detail = typeof meal.detail === 'string' ? { main: meal.detail, alt: '' } : meal.detail;
                const altText = detail.alt ? ` | Alt: ${detail.alt}` : '';
                return `- ${meal.name}: ${meal.calories} kcal • ${meal.protein}g protein | ${detail.main}${altText}`;
            })
        ];

        // Measure the real height first: every line can wrap onto several lines.
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        const wrappedLines = mealLines.slice(1).map((line) => doc.splitTextToSize(line, width - 36));
        const bodyHeight = wrappedLines.reduce((total, wrapped) => total + wrapped.length * 11 + 6, 0);
        const blockHeight = 32 + bodyHeight + 10;

        if (y + blockHeight > pageHeight - 40) {
            doc.addPage();
            paintPageBackground();
            y = 52;
        }

        doc.setDrawColor(89, 90, 93);
        doc.setFillColor(16, 16, 16);
        doc.roundedRect(margin, y, width, blockHeight, 8, 8, 'F');
        doc.setTextColor(245, 245, 245);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(dayPlan.day.toUpperCase(), margin + 16, y + 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(225, 225, 225);
        let lineY = y + 32;
        wrappedLines.forEach((wrapped) => {
            doc.text(wrapped, margin + 18, lineY);
            lineY += wrapped.length * 11 + 6;
        });

        y += blockHeight + 12;
    });

    return doc;
}

function getFoodPlanFilename(plan) {
    return `${(plan.name || 'athlete').replace(/\s+/g, '_').toLowerCase()}_brotein_food_plan.pdf`;
}
