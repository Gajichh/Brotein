// "All Tools" dropdown in the top navigation (shared by every page).
// Opens on hover or click and stays open until you click somewhere else or press Escape.
(function () {
    const menu = document.querySelector('.tools-menu');
    if (!menu) return;
    const trigger = menu.querySelector('.tools-trigger');

    function setOpen(open) {
        menu.classList.toggle('is-open', open);
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    menu.addEventListener('mouseenter', () => setOpen(true));

    trigger.addEventListener('click', function (event) {
        setOpen(!menu.classList.contains('is-open'));
        event.stopPropagation();
    });

    document.addEventListener('click', function (event) {
        if (!menu.contains(event.target)) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && menu.classList.contains('is-open')) {
            setOpen(false);
            trigger.focus();
        }
    });

    // Highlight the current tool.
    const page = location.pathname.split('/').pop() || 'index.html';
    menu.querySelectorAll('.tools-dropdown a').forEach((link) => {
        if (link.getAttribute('href') === page) link.setAttribute('aria-current', 'page');
    });
})();
