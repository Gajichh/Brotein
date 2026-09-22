// Quick stats questionnaire shown to logged-in users whose profile is missing
// weight, height, age or gender (e.g. right after signing up). Works on any page
// that loads supabase-client.js first. Saves to the user's profile and refreshes
// the calculators / plan form / profile form if they're on the page.
(function () {
    const CURRENT_USER_KEY = 'brotein_current_user';
    const db = window.broteinSupabase;

    function readCurrentUser() {
        try {
            const user = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null');
            return user && user.loggedIn ? user : null;
        } catch (error) {
            return null;
        }
    }

    function skipKey(userId) {
        return `brotein_questionnaire_skipped_${userId}`;
    }

    function isComplete(profile) {
        return Boolean(profile && profile.weight > 0 && profile.height > 0 && profile.age > 0 && profile.gender);
    }

    const STYLES = `
        .bq-backdrop {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            font-family: Inter, sans-serif;
            animation: bq-fade 0.2s ease;
        }

        .bq-card {
            width: min(100%, 380px);
            max-height: calc(100vh - 32px);
            overflow-y: auto;
            background: #0f0f0f;
            color: #fafafa;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 22px;
            padding: 22px 20px 18px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
        }

        .bq-card h2 {
            margin: 0 0 6px;
            font-size: 1.35rem;
            letter-spacing: -0.04em;
        }

        .bq-card p {
            margin: 0 0 16px;
            color: #a3a3a3;
            font-size: 0.88rem;
            line-height: 1.5;
        }

        .bq-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
        }

        .bq-field {
            display: grid;
            gap: 6px;
        }

        .bq-field label {
            font-size: 0.66rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #a3a3a3;
        }

        .bq-field input,
        .bq-field select {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.04);
            color: #fafafa;
            padding: 11px 12px;
            font: inherit;
            font-size: 16px;
            color-scheme: dark;
        }

        .bq-field input:focus,
        .bq-field select:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.3);
        }

        .bq-field select option {
            background: #151515;
        }

        .bq-status {
            min-height: 18px;
            margin-top: 10px;
            font-size: 0.72rem;
            color: #ff6b6b;
        }

        .bq-actions {
            display: flex;
            gap: 10px;
            margin-top: 6px;
        }

        .bq-actions button {
            flex: 1;
            border-radius: 999px;
            padding: 12px 16px;
            font: inherit;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            cursor: pointer;
        }

        .bq-save {
            border: 1px solid rgba(255, 255, 255, 0.18);
            background: #fafafa;
            color: #000000;
        }

        .bq-save:disabled {
            opacity: 0.6;
            cursor: wait;
        }

        .bq-skip {
            border: 1px solid rgba(255, 255, 255, 0.15);
            background: transparent;
            color: #a3a3a3;
        }

        @keyframes bq-fade {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;

    function valueOrEmpty(value) {
        return value === null || typeof value === 'undefined' ? '' : value;
    }

    function show(profile, userId) {
        const style = document.createElement('style');
        style.textContent = STYLES;
        document.head.appendChild(style);

        const backdrop = document.createElement('div');
        backdrop.className = 'bq-backdrop';
        backdrop.innerHTML = `
            <form class="bq-card" role="dialog" aria-modal="true" aria-labelledby="bqTitle" novalidate>
                <h2 id="bqTitle">Quick setup</h2>
                <p>Tell us a bit about yourself and we'll fill in the calculators and your plan for you.</p>
                <div class="bq-grid">
                    <div class="bq-field">
                        <label for="bqWeight">Weight</label>
                        <input id="bqWeight" type="number" min="1" step="0.1" inputmode="decimal" placeholder="75" />
                    </div>
                    <div class="bq-field">
                        <label for="bqWeightUnit">Unit</label>
                        <select id="bqWeightUnit">
                            <option value="kg">Kgs</option>
                            <option value="lbs">Lbs</option>
                        </select>
                    </div>
                    <div class="bq-field">
                        <label for="bqHeight">Height (cm)</label>
                        <input id="bqHeight" type="number" min="1" max="250" step="0.1" inputmode="decimal" placeholder="180" />
                    </div>
                    <div class="bq-field">
                        <label for="bqAge">Age</label>
                        <input id="bqAge" type="number" min="1" max="100" step="1" inputmode="numeric" placeholder="25" />
                    </div>
                    <div class="bq-field" style="grid-column: 1 / -1;">
                        <label for="bqGender">Gender</label>
                        <select id="bqGender">
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>
                </div>
                <div class="bq-status" aria-live="polite"></div>
                <div class="bq-actions">
                    <button type="button" class="bq-skip">Skip</button>
                    <button type="submit" class="bq-save">Save</button>
                </div>
            </form>
        `;

        const form = backdrop.querySelector('form');
        const status = backdrop.querySelector('.bq-status');
        const field = (id) => backdrop.querySelector(`#${id}`);

        field('bqWeight').value = valueOrEmpty(profile.weight);
        field('bqWeightUnit').value = profile.weight_unit || 'kg';
        field('bqHeight').value = valueOrEmpty(profile.height);
        field('bqAge').value = valueOrEmpty(profile.age);
        field('bqGender').value = profile.gender || 'male';

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        function close() {
            backdrop.remove();
            style.remove();
            document.body.style.overflow = previousOverflow;
        }

        backdrop.querySelector('.bq-skip').addEventListener('click', function () {
            try {
                localStorage.setItem(skipKey(userId), '1');
            } catch (error) {
                // Private mode: it will just show again next time.
            }
            close();
        });

        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            const weight = Number(field('bqWeight').value);
            const height = Number(field('bqHeight').value);
            const age = Number(field('bqAge').value);

            if (!(weight > 0) || !(height > 0) || height > 250 || !Number.isInteger(age) || age < 1 || age > 100) {
                status.textContent = 'Enter your weight, height (up to 250 cm) and age (1–100).';
                return;
            }

            const saved = {
                weight,
                weightUnit: field('bqWeightUnit').value,
                height,
                age,
                gender: field('bqGender').value
            };

            const saveButton = backdrop.querySelector('.bq-save');
            saveButton.disabled = true;
            status.textContent = '';

            const { error } = await db
                .from('profiles')
                .update({
                    weight: saved.weight,
                    weight_unit: saved.weightUnit,
                    height: saved.height,
                    age: saved.age,
                    gender: saved.gender
                })
                .eq('id', userId);

            if (error) {
                saveButton.disabled = false;
                status.textContent = 'Could not save: ' + error.message;
                return;
            }

            // Pages prefill their forms from the stored current user.
            const user = readCurrentUser();
            if (user) {
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
                    ...user,
                    profile: { ...(user.profile || {}), ...saved }
                }));
            }

            close();

            // Fill in whatever form is on this page right away.
            if (typeof window.applySavedProfileToCalculators === 'function') window.applySavedProfileToCalculators();
            if (typeof window.applySavedProfileToPlan === 'function') window.applySavedProfileToPlan();
            if (typeof window.fillProfileFormFromUser === 'function') window.fillProfileFormFromUser();
        });

        document.body.appendChild(backdrop);
        field('bqWeight').focus();
    }

    async function init() {
        const user = readCurrentUser();
        if (!db || !user || user.guest) return;

        const { data: { session } } = await db.auth.getSession();
        if (!session) return;

        try {
            if (localStorage.getItem(skipKey(session.user.id))) return;
        } catch (error) {
            // Ignore storage errors and just check the profile.
        }

        const { data: profile, error } = await db
            .from('profiles')
            .select('weight, weight_unit, height, age, gender')
            .eq('id', session.user.id)
            .maybeSingle();

        if (error || !profile || isComplete(profile)) return;
        show(profile, session.user.id);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
