document.addEventListener('DOMContentLoaded', function () {
    const navbar = document.querySelector('.navbar');
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('.section');
    const menuToggle = document.getElementById('menuToggle') || document.querySelector('.menu-toggle');
    const navMenu = document.getElementById('navLinks') || document.querySelector('.nav-links');
    const mobileAuthButtons = document.getElementById('mobileAuth') || document.querySelector('.mobile-auth-buttons');
    const navBackdrop = document.getElementById('navBackdrop');
    const menuClose = document.getElementById('menuClose');

    // === Тема ===
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }

    // === Активная навигация ===
    function updateActiveNav() {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.scrollY >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    }

    let navScrollTicking = false;
    window.addEventListener('scroll', function () {
        if (navScrollTicking) return;
        navScrollTicking = true;
        requestAnimationFrame(function () {
            updateActiveNav();
            navScrollTicking = false;
        });
    }, { passive: true });

    // === Мобильное меню ===
    function setMenu(open) {
        if (!navMenu) return;
        navMenu.classList.toggle('active', open);
        if (mobileAuthButtons) mobileAuthButtons.classList.toggle('active', open);
        if (navBackdrop) navBackdrop.classList.toggle('active', open);
        document.body.classList.toggle('menu-open', open);
        if (menuToggle) menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function closeMenu() {
        setMenu(false);
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            setMenu(!navMenu.classList.contains('active'));
        });
    }

    if (menuClose) {
        menuClose.addEventListener('click', closeMenu);
    }

    if (navBackdrop) {
        navBackdrop.addEventListener('click', closeMenu);
    }

    // === Закрытие меню при клике вне его ===
    document.addEventListener('click', (e) => {
        if (!navMenu || !navMenu.classList.contains('active')) return;
        if (navbar && !navbar.contains(e.target)) {
            closeMenu();
        }
    });

    // === Закрытие по Escape ===
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });

    // === Меню не нужно на десктопе ===
    window.addEventListener('resize', function () {
        if (window.innerWidth > 768) closeMenu();
    }, { passive: true });

    // === Плавная прокрутка к якорям ===
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href') || '';
            if (href.charAt(0) !== '#') return;
            e.preventDefault();
            const targetSection = document.getElementById(href.substring(1));
            if (targetSection) {
                window.scrollTo({
                    top: targetSection.offsetTop,
                    behavior: 'smooth'
                });
                closeMenu();
            }
        });
    });

    // === Хаб игр (игры хранятся в js/games и грузятся по требованию) ===
    const hub = document.getElementById('gameHub');
    if (!hub) return;

    const frame = document.getElementById('gameFrame');
    const hubTitle = document.getElementById('gameHubTitle');
    const hubClose = document.getElementById('gameHubClose');
    const hubLoader = document.getElementById('gameHubLoader');
    const gameLinks = document.querySelectorAll('[data-game]');

    const templateLoading = Object.create(null);
    const srcdocCache = Object.create(null);
    let isHubOpen = false;
    let currentSlug = null;
    let loadFallbackTimer = null;

    // На медленном соединении или при включённой экономии трафика не грузим
    // игры заранее — только по явному клику.
    function canPrefetch() {
        const connection = navigator.connection;
        if (connection) {
            if (connection.saveData) return false;
            if (/(^|-)2g$/.test(connection.effectiveType || '')) return false;
        }
        return true;
    }

    function slugFromValue(value) {
        if (!value) return '';
        return String(value)
            .replace(/^.*[\\/]/, '')
            .replace(/\.html?$/i, '')
            .trim();
    }

    function findGame(slug) {
        for (let i = 0; i < gameLinks.length; i++) {
            if (gameLinks[i].getAttribute('data-game') === slug) return gameLinks[i];
        }
        return null;
    }

    function loadTemplate(slug) {
        const cache = window.__GAME_TEMPLATES;
        if (cache && cache[slug]) return Promise.resolve(cache[slug]);
        if (templateLoading[slug]) return templateLoading[slug];

        templateLoading[slug] = new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = 'js/games/' + slug + '.js';
            script.async = true;
            script.onload = function () {
                const templates = window.__GAME_TEMPLATES;
                if (templates && templates[slug]) resolve(templates[slug]);
                else reject(new Error('Шаблон не найден: ' + slug));
            };
            script.onerror = function () {
                // Не запоминаем неудачу навсегда — при повторном клике попробуем снова.
                delete templateLoading[slug];
                script.remove();
                reject(new Error('Не удалось загрузить игру: ' + slug));
            };
            document.head.appendChild(script);
        });

        return templateLoading[slug];
    }

    function buildSrcdoc(html) {
        // Виртуальная база /games/ — относительные пути игр (../assets, ../images)
        // продолжают работать, хотя папки games больше нет.
        const base = new URL('games/', window.location.href).href;
        const safeBase = base.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const baseTag = '<base href="' + safeBase + '">';

        if (/<head[^>]*>/i.test(html)) {
            return html.replace(/<head[^>]*>/i, function (match) {
                return match + baseTag;
            });
        }
        return baseTag + html;
    }

    function pausePageEffects() {
        if (window.RoomEffects) {
            window.RoomEffects.pauseMusic();
            window.RoomEffects.pauseSnow();
        }
    }

    function resumePageEffects() {
        if (window.RoomEffects) {
            window.RoomEffects.resumeMusic();
            window.RoomEffects.resumeSnow();
        }
    }

    function openGame(value, title, push) {
        const slug = slugFromValue(value);
        if (!slug || !frame) return;

        // Повторный клик по уже открытой игре просто обновляет заголовок.
        if (isHubOpen && currentSlug === slug) return;

        const cleanTitle = title || 'Игра';
        currentSlug = slug;
        isHubOpen = true;

        hub.classList.add('is-open');
        hub.setAttribute('aria-hidden', 'false');
        document.body.classList.add('hub-open');

        if (hubTitle) hubTitle.textContent = cleanTitle;
        if (hubLoader) hubLoader.classList.remove('is-hidden');

        pausePageEffects();

        if (push !== false) {
            try {
                history.pushState(
                    { game: slug, title: cleanTitle },
                    '',
                    '#game=' + encodeURIComponent(slug)
                );
            } catch (err) { /* игнорируем */ }
        }

        closeMenu();

        loadTemplate(slug).then(function (html) {
            if (!isHubOpen || currentSlug !== slug) return;

            if (!srcdocCache[slug]) srcdocCache[slug] = buildSrcdoc(html);
            frame.removeAttribute('src');
            frame.srcdoc = srcdocCache[slug];

            // Страховка: если какой-то ресурс игры «завис», лоадер не останется навсегда.
            clearTimeout(loadFallbackTimer);
            loadFallbackTimer = setTimeout(function () {
                if (isHubOpen && hubLoader) hubLoader.classList.add('is-hidden');
            }, 1500);
        }).catch(function () {
            if (!isHubOpen) return;
            if (hubLoader) {
                hubLoader.innerHTML = '<p>Не удалось загрузить игру. Проверь соединение и попробуй ещё раз.</p>';
            }
        });
    }

    function closeGame(fromPop) {
        if (!isHubOpen) return;
        isHubOpen = false;
        currentSlug = null;
        clearTimeout(loadFallbackTimer);

        hub.classList.remove('is-open');
        hub.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('hub-open');

        if (frame) {
            frame.removeAttribute('srcdoc');
            frame.src = 'about:blank';
        }
        if (hubLoader) hubLoader.classList.add('is-hidden');

        resumePageEffects();

        if (!fromPop) {
            try {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (err) { /* игнорируем */ }
        }
    }

    gameLinks.forEach(function (link) {
        const slug = link.getAttribute('data-game');
        if (!slug) return;

        // Лёгкий prefetch шаблона при наведении/фокусе — открытие почти мгновенное.
        const prefetch = function () {
            if (!canPrefetch()) return;
            loadTemplate(slug).catch(function () {});
        };
        link.addEventListener('pointerenter', prefetch, { once: true });
        link.addEventListener('focus', prefetch, { once: true });
        // На тач-экранах наведения нет, зато есть момент касания — грузим тогда.
        link.addEventListener('touchstart', prefetch, { once: true, passive: true });

        link.addEventListener('click', function (e) {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            openGame(slug, link.getAttribute('data-title'));
        });
    });

    if (hubClose) {
        hubClose.addEventListener('click', function () { closeGame(); });
    }

    if (frame) {
        frame.addEventListener('load', function () {
            if (!isHubOpen) return;

            clearTimeout(loadFallbackTimer);
            if (hubLoader) hubLoader.classList.add('is-hidden');

            // Внутри iframe прячем его собственные «назад в меню» и перехватываем переходы.
            try {
                const doc = frame.contentDocument;
                if (!doc) return;

                if (!doc.getElementById('re-embed-style')) {
                    const style = doc.createElement('style');
                    style.id = 're-embed-style';
                    style.textContent =
                        'a[href*="index.html"],[onclick*="index.html"],a[href$="../"],a[href$=".."]{display:none!important}' +
                        'body{padding-bottom:env(safe-area-inset-bottom);}';
                    (doc.head || doc.documentElement).appendChild(style);
                }
            } catch (err) { /* документ ещё не готов */ }
        });
    }

    window.addEventListener('popstate', function () {
        if (isHubOpen) closeGame(true);
    });

    window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'room-effects:close-game' && isHubOpen) {
            closeGame();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isHubOpen) closeGame();
    });

    // === Прямая ссылка #game=book (поддерживаем и старый #game=games/book.html) ===
    const hashMatch = /^#game=(.+)$/.exec(window.location.hash);
    if (hashMatch) {
        let value = '';
        try {
            value = decodeURIComponent(hashMatch[1]);
        } catch (err) {
            value = '';
        }
        const slug = slugFromValue(value);
        const game = slug ? findGame(slug) : null;
        if (game) openGame(slug, game.getAttribute('data-title'), false);
    }
});