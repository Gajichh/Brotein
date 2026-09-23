// Account menu (profile icon, top left) for pages that don't carry their own copy
// of this logic inline (login, upgrade, pricing). Pages that already define
// updateAccountMenu() are left alone.
(function () {
    if (typeof window.updateAccountMenu === 'function') return;

    const CURRENT_USER_KEY = 'brotein_current_user';
    const wrap = document.querySelector('.account-wrap');
    if (!wrap) return;

    const menu = wrap.querySelector('.account-menu');
    const nameEl = wrap.querySelector('.account-name');
    const buttons = {
        profile: wrap.querySelector('.profile-btn'),
        admin: wrap.querySelector('.admin-btn'),
        upgrade: wrap.querySelector('.upgrade-btn'),
        login: wrap.querySelector('.login-btn'),
        logout: wrap.querySelector('.logout-btn')
    };

    function readUser() {
        try {
            const user = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null');
            return user && user.loggedIn ? user : null;
        } catch (error) {
            return null;
        }
    }

    function show(button, visible) {
        if (button) button.style.display = visible ? 'block' : 'none';
    }

    function render() {
        const user = readUser();
        const member = Boolean(user && !user.guest);
        const isPremium = String(user?.package || 'FREE').toUpperCase() === 'PREMIUM';

        nameEl.textContent = member ? (user.name || 'User') : 'Guest';
        nameEl.classList.toggle('premium-user', member && isPremium);
        show(buttons.profile, member);
        show(buttons.admin, member && Boolean(user.isAdmin));
        show(buttons.upgrade, member && !isPremium);
        show(buttons.logout, member);
        show(buttons.login, !member);
    }

    // Refresh name, package and admin flag from Supabase when signed in.
    async function syncFromProfile() {
        const db = window.broteinSupabase;
        const user = readUser();
        if (!db || !user || user.guest) return;
        const { data: { session } } = await db.auth.getSession();
        if (!session) return;
        const { data: profile } = await db
            .from('profiles')
            .select('name, package, is_admin')
            .eq('id', session.user.id)
            .maybeSingle();
        if (!profile) return;
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
            ...user,
            name: profile.name || user.name,
            package: String(profile.package || 'FREE').toUpperCase(),
            isAdmin: Boolean(profile.is_admin)
        }));
        render();
    }

    buttons.login?.addEventListener('click', () => { window.location.href = 'login.html'; });
    buttons.profile?.addEventListener('click', () => { window.location.href = 'profile.html'; });
    buttons.admin?.addEventListener('click', () => { window.location.href = 'admin.html'; });
    buttons.upgrade?.addEventListener('click', () => { window.location.href = 'upgrade.html'; });
    buttons.logout?.addEventListener('click', function () {
        localStorage.removeItem(CURRENT_USER_KEY);
        const signOut = window.broteinSupabase ? window.broteinSupabase.auth.signOut() : Promise.resolve();
        signOut.finally(() => window.location.reload());
    });

    // Keep the menu centred under the icon, nudging it only when it would go off-screen.
    function keepOnScreen() {
        const rect = wrap.getBoundingClientRect();
        const left = rect.left + rect.width / 2 - menu.offsetWidth / 2;
        const right = left + menu.offsetWidth;
        const gap = 8;
        let shift = 0;
        if (left < gap) shift = gap - left;
        else if (right > window.innerWidth - gap) shift = window.innerWidth - gap - right;
        menu.style.setProperty('--menu-shift', `${shift}px`);
    }

    // Opens on hover or click and stays open until you click somewhere else.
    wrap.addEventListener('mouseenter', () => wrap.classList.add('is-open'));
    wrap.querySelector('.account-trigger')?.addEventListener('click', function (event) {
        wrap.classList.add('is-open');
        event.stopPropagation();
    });
    document.addEventListener('click', function (event) {
        if (!wrap.contains(event.target)) wrap.classList.remove('is-open');
    });

    keepOnScreen();
    window.addEventListener('resize', keepOnScreen);
    render();
    syncFromProfile().catch(() => {});
})();
