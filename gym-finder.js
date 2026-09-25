// Gym Finder: finds gyms around the user's location (or a searched place) using
// OpenStreetMap's free Nominatim search. No API keys; the location is only used in the
// browser to search and is never saved.
(function () {
    const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
    const NOMINATIM_MAX_RESULTS = 40;
    // Nominatim's usage policy allows at most one request per second.
    const MIN_REQUEST_GAP_MS = 1100;
    let lastRequestAt = 0;

    const db = window.broteinSupabase;
    const LAST_QUERY_KEY = 'brotein_last_gym_query';
    const UNIT_KEY = 'brotein_gym_unit';

    const statusEl = document.getElementById('gymStatus');
    const listEl = document.getElementById('gymList');
    const countEl = document.getElementById('gymCount');
    const radiusEl = document.getElementById('gymRadius');
    const searchForm = document.getElementById('gymSearchForm');
    const searchInput = document.getElementById('gymSearchInput');
    const locateButton = document.getElementById('gymLocateButton');
    const suggestionsEl = document.getElementById('gymSuggestions');
    const filtersEl = document.getElementById('gymFilters');
    const sortToggleEl = document.getElementById('gymSortToggle');
    const unitToggleEl = document.getElementById('gymUnitToggle');
    const mapSkeletonEl = document.getElementById('gymMapSkeleton');
    const favoritesSection = document.getElementById('gymFavorites');
    const favoritesListEl = document.getElementById('gymFavoritesList');

    let map = null;
    let resultsLayer = null;
    let lastSearch = null;
    let lastGyms = [];
    let sortMode = 'open';
    let unit = localStorage.getItem(UNIT_KEY) || 'km';
    const activeFilters = new Set();
    let currentUserId = null;
    let favoriteIds = new Set();

    function setStatus(message, type = '') {
        statusEl.textContent = message;
        statusEl.className = 'gym-status' + (type ? ` ${type}` : '');
    }

    function setBusy(busy) {
        locateButton.disabled = busy;
        searchForm.querySelector('button').disabled = busy;
        radiusEl.disabled = busy;
    }

    function initMap() {
        if (map || !window.L) return;
        map = L.map('gymMap', { scrollWheelZoom: false }).setView([50, 10], 4);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
        }).addTo(map);
        resultsLayer = L.layerGroup().addTo(map);
    }

    function distanceKm(lat1, lon1, lat2, lon2) {
        const toRad = (deg) => deg * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function formatDistance(km) {
        if (unit === 'mi') {
            const miles = km * 0.621371;
            return miles < 0.1 ? `${Math.round(miles * 5280)} ft` : `${miles.toFixed(1)} mi`;
        }
        return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
    }

    function safeUrl(value) {
        if (!value) return null;
        const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
        } catch (error) {
            return null;
        }
    }

    async function nominatimSearch(params) {
        const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        lastRequestAt = Date.now();

        const response = await fetch(`${NOMINATIM_URL}?${new URLSearchParams({ format: 'jsonv2', ...params })}`, {
            headers: { 'Accept-Language': navigator.language || 'en' }
        });
        if (!response.ok) throw new Error(`Server responded ${response.status}`);
        return response.json();
    }

    function boxAround(lat, lon, radiusKm) {
        const dLat = radiusKm / 111;
        const dLon = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
        return { west: lon - dLon, east: lon + dLon, north: lat + dLat, south: lat - dLat };
    }

    function gymsInBox(box) {
        return nominatimSearch({
            q: '[leisure=fitness_centre]',
            viewbox: `${box.west},${box.north},${box.east},${box.south}`,
            bounded: '1',
            limit: String(NOMINATIM_MAX_RESULTS),
            addressdetails: '1',
            extratags: '1'
        });
    }

    async function fetchGyms(lat, lon, radiusKm, onProgress) {
        const box = boxAround(lat, lon, radiusKm);
        let results = await gymsInBox(box);

        // Hit the result cap: search each quarter of the area too, so busy cities aren't cut short.
        if (results.length >= NOMINATIM_MAX_RESULTS) {
            const midLat = (box.north + box.south) / 2;
            const midLon = (box.west + box.east) / 2;
            const quarters = [
                { west: box.west, east: midLon, north: box.north, south: midLat },
                { west: midLon, east: box.east, north: box.north, south: midLat },
                { west: box.west, east: midLon, north: midLat, south: box.south },
                { west: midLon, east: box.east, north: midLat, south: box.south }
            ];
            for (let i = 0; i < quarters.length; i++) {
                if (onProgress) onProgress(i + 1, quarters.length);
                results = results.concat(await gymsInBox(quarters[i]));
            }
        }

        return results;
    }

    function buildAddress(address = {}) {
        const street = [address.road, address.house_number].filter(Boolean).join(' ');
        const city = address.city || address.town || address.village || address.suburb;
        return [street, city].filter(Boolean).join(', ');
    }

    const SPORT_LABELS = {
        fitness: 'Gym & fitness',
        weightlifting: 'Weightlifting',
        crossfit: 'CrossFit',
        bodybuilding: 'Bodybuilding',
        yoga: 'Yoga',
        pilates: 'Pilates',
        boxing: 'Boxing',
        martial_arts: 'Martial arts',
        kickboxing: 'Kickboxing',
        gymnastics: 'Gymnastics',
        climbing: 'Climbing',
        swimming: 'Swimming',
        dance: 'Dance',
        aerobics: 'Aerobics'
    };

    function isYes(value) {
        return ['yes', 'only', 'designated'].includes(String(value || '').toLowerCase());
    }

    // Turns the OpenStreetMap tags we get back into a short list of what the gym offers.
    // Only includes what's actually recorded; most gyms have little beyond their sport.
    function describeFeatures(tags) {
        const training = String(tags.sport || '')
            .split(';')
            .map((sport) => sport.trim())
            .filter(Boolean)
            .map((sport) => SPORT_LABELS[sport] || sport.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()));

        const has = [];
        const hasNot = [];
        const add = (condition, label) => { if (condition) has.push(label); };
        const addNot = (value, label) => { if (String(value || '').toLowerCase() === 'no') hasNot.push(label); };

        add(String(tags.opening_hours || '').trim() === '24/7', 'Open 24/7');
        add(isYes(tags.sauna), 'Sauna');
        addNot(tags.sauna, 'Sauna');
        add(isYes(tags.swimming_pool) || /(^|;)\s*swimming/.test(tags.sport || ''), 'Swimming pool');
        addNot(tags.swimming_pool, 'Swimming pool');
        add(isYes(tags.shower), 'Showers');
        add(isYes(tags.personal_trainer), 'Personal trainers');
        add(tags.female === 'only', 'Women only');
        add(isYes(tags.air_conditioning), 'Air conditioning');
        add(['wlan', 'wifi', 'yes'].includes(String(tags.internet_access || '').toLowerCase()), 'Wi-Fi');
        add(tags.wheelchair === 'yes', 'Wheelchair accessible');
        add(tags.wheelchair === 'limited', 'Limited wheelchair access');
        addNot(tags.wheelchair, 'Wheelchair access');
        add(isYes(tags.parking), 'Parking');
        add(isYes(tags['payment:credit_cards']) || isYes(tags['payment:debit_cards']) || isYes(tags['payment:contactless']), 'Card payments');
        add(String(tags.fee || '').toLowerCase() === 'no', 'Free entry');

        return { training, has, hasNot };
    }

    // Current wall-clock time at the searched place, as a Date whose local fields
    // (getDay/getHours) match that place. opening_hours.js reads those fields.
    function localNow(timeZone) {
        if (!timeZone) return new Date();
        try {
            const parts = {};
            new Intl.DateTimeFormat('en-US', {
                timeZone, hourCycle: 'h23',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).formatToParts(new Date()).forEach((part) => { parts[part.type] = part.value; });
            return new Date(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
        } catch (error) {
            return new Date();
        }
    }

    function timeZoneAt(lat, lon) {
        try {
            return typeof window.tzlookup === 'function' ? window.tzlookup(lat, lon) : null;
        } catch (error) {
            return null;
        }
    }

    function formatClock(date) {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    // Reads the OpenStreetMap opening_hours value and works out today's hours and
    // whether the gym is open right now. status: 'open' | 'closed' | 'unknown'.
    function hoursToday(value, now, place) {
        const unknown = { status: 'unknown', text: 'Hours not listed' };
        if (!value || typeof window.opening_hours !== 'function') return unknown;

        try {
            const oh = new window.opening_hours(value, place);
            const dayStart = new Date(now);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);

            const intervals = oh.getOpenIntervals(dayStart, dayEnd).filter(([from, to]) => to > from);
            let text;
            if (!intervals.length) {
                text = 'Closed today';
            } else if (intervals.length === 1 && intervals[0][0] <= dayStart && intervals[0][1] >= dayEnd) {
                text = 'Open 24 hours today';
            } else {
                text = 'Today ' + intervals
                    .map(([from, to]) => `${formatClock(from)}–${to >= dayEnd ? '24:00' : formatClock(to)}`)
                    .join(', ');
            }

            const status = oh.getUnknown(now) ? 'unknown' : (oh.getState(now) ? 'open' : 'closed');
            return { status, text };
        } catch (error) {
            // Hours written in a way the parser doesn't understand.
            return { status: 'unknown', text: 'Hours: see details' };
        }
    }

    function toGym(result, originLat, originLon, now) {
        const lat = Number(result.lat);
        const lon = Number(result.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const extra = result.extratags || {};
        return {
            id: `${result.osm_type}/${result.osm_id}`,
            name: result.name || extra.brand || 'Gym (no name listed)',
            lat,
            lon,
            distance: distanceKm(originLat, originLon, lat, lon),
            address: buildAddress(result.address),
            hours: extra.opening_hours || '',
            website: safeUrl(extra.website || extra['contact:website']),
            phone: extra.phone || extra['contact:phone'] || '',
            today: hoursToday(extra.opening_hours, now, {
                lat,
                lon,
                address: {
                    country_code: result.address?.country_code || '',
                    state: result.address?.state || ''
                }
            }),
            features: describeFeatures(extra),
            osmUrl: `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`
        };
    }

    async function geocode(place) {
        const results = await nominatimSearch({ limit: '1', q: place });
        if (!results.length) return null;
        return { lat: Number(results[0].lat), lon: Number(results[0].lon), label: results[0].name || results[0].display_name.split(',')[0] };
    }

    function directionsUrl(gym) {
        return `https://www.google.com/maps/dir/?api=1&destination=${gym.lat},${gym.lon}`;
    }

    function popupContent(gym) {
        const wrap = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = gym.name;
        wrap.appendChild(title);
        const meta = document.createElement('div');
        meta.textContent = [formatDistance(gym.distance), gym.today.text, gym.address].filter(Boolean).join(' • ');
        wrap.appendChild(meta);
        const link = document.createElement('a');
        link.href = directionsUrl(gym);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Directions';
        wrap.appendChild(link);
        return wrap;
    }

    function chipList(labels, className) {
        const list = document.createElement('ul');
        list.className = `gym-chips ${className}`;
        labels.forEach((label) => {
            const chip = document.createElement('li');
            chip.textContent = label;
            list.appendChild(chip);
        });
        return list;
    }

    function buildFeaturesMenu(gym) {
        const { training, has, hasNot } = gym.features;
        const total = training.length + has.length;

        const menu = document.createElement('details');
        menu.className = 'gym-extras';

        const summary = document.createElement('summary');
        summary.textContent = total ? `What's here (${total})` : "What's here";
        menu.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'gym-extras-body';

        const section = (title, labels, className) => {
            if (!labels.length) return;
            const heading = document.createElement('p');
            heading.className = 'gym-extras-title';
            heading.textContent = title;
            body.append(heading, chipList(labels, className));
        };

        section('Training', training, '');
        section('Services & facilities', has, 'is-yes');
        section('Not available', hasNot, 'is-no');

        if (!total && !hasNot.length) {
            const empty = document.createElement('p');
            empty.className = 'gym-extras-empty';
            empty.textContent = 'No extra services recorded for this gym yet.';
            body.appendChild(empty);
        }

        const note = document.createElement('p');
        note.className = 'gym-extras-note';
        note.append('Info comes from OpenStreetMap and may be incomplete. Know this gym? ');
        const edit = document.createElement('a');
        edit.href = gym.osmUrl;
        edit.target = '_blank';
        edit.rel = 'noopener noreferrer';
        edit.textContent = 'Add details on OpenStreetMap';
        note.appendChild(edit);
        body.appendChild(note);

        menu.appendChild(body);
        return menu;
    }

    function starSvg() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17.6 6.4 20.6l1.4-6.3-4.8-4.3 6.4-.6L12 3.5Z"/></svg>';
    }

    const FILTER_LABELS = {
        open24: 'Open 24/7',
        sauna: 'Sauna',
        pool: 'Swimming pool',
        women: 'Women only',
        wheelchair: 'Wheelchair accessible',
        showers: 'Showers'
    };

    function gymMatchesFilters(gym) {
        if (!activeFilters.size) return true;
        return [...activeFilters].every((key) => gym.features.has.includes(FILTER_LABELS[key]));
    }

    function sortGyms(gyms) {
        const statusOrder = { open: 0, unknown: 1, closed: 2 };
        return gyms.slice().sort((a, b) => {
            if (sortMode === 'distance') return a.distance - b.distance;
            return (statusOrder[a.today.status] - statusOrder[b.today.status]) || (a.distance - b.distance);
        });
    }

    // Re-filters and re-sorts the last fetched results without hitting the network again.
    function applyFiltersAndSort() {
        const filtered = sortGyms(lastGyms.filter(gymMatchesFilters));
        renderResults(filtered, lastSearch);
        return filtered;
    }

    function highlightListItem(id) {
        listEl.querySelectorAll('.gym-item').forEach((el) => el.classList.remove('is-highlighted'));
        const el = listEl.querySelector(`[data-gym-id="${id}"]`);
        if (el) el.classList.add('is-highlighted');
    }

    function appendRetryButton(afterEl) {
        const radiusValues = ['2', '5', '10', '20'];
        const idx = radiusValues.indexOf(radiusEl.value);
        if (idx === -1 || idx >= radiusValues.length - 1) return;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'gym-retry-btn';
        retry.textContent = `Search within ${radiusValues[idx + 1]} km`;
        retry.addEventListener('click', () => {
            radiusEl.value = radiusValues[idx + 1];
            if (lastSearch) searchAround(lastSearch);
        });
        afterEl.appendChild(document.createElement('br'));
        afterEl.appendChild(retry);
    }

    function renderSkeleton() {
        listEl.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const skeleton = document.createElement('li');
            skeleton.className = 'gym-skeleton';
            listEl.appendChild(skeleton);
        }
        countEl.textContent = '';
        if (mapSkeletonEl) mapSkeletonEl.hidden = false;
    }

    // ---- Favorite gyms (signed-in accounts only) ----
    async function initFavorites() {
        if (!db) return;
        const { data: { session } } = await db.auth.getSession();
        if (!session) return;
        currentUserId = session.user.id;

        const { data, error } = await db.from('favorite_gyms').select('*').eq('user_id', currentUserId);
        if (error) {
            console.error('Could not load favorite gyms:', error.message);
            return;
        }
        favoriteIds = new Set((data || []).map((row) => row.gym_osm_id));
        renderFavoritesSection(data || []);
    }

    function renderFavoritesSection(rows) {
        if (!favoritesSection || !favoritesListEl) return;
        if (!rows.length) {
            favoritesSection.hidden = true;
            return;
        }
        favoritesSection.hidden = false;
        favoritesListEl.innerHTML = '';

        rows.forEach((row) => {
            const item = document.createElement('li');
            item.className = 'gym-item';

            const head = document.createElement('div');
            head.className = 'gym-item-head';

            const name = document.createElement('button');
            name.type = 'button';
            name.className = 'gym-name';
            name.textContent = row.name;
            name.addEventListener('click', function () {
                initMap();
                document.getElementById('gymResults').hidden = false;
                map.invalidateSize();
                map.setView([Number(row.lat), Number(row.lon)], 16);
                document.getElementById('gymMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'gym-favorite-btn is-favorite';
            remove.innerHTML = starSvg();
            remove.title = 'Remove from favorites';
            remove.addEventListener('click', async function () {
                await toggleFavorite({ id: row.gym_osm_id, name: row.name, lat: Number(row.lat), lon: Number(row.lon), address: row.address }, true);
            });

            head.append(name, remove);
            item.appendChild(head);

            if (row.address) {
                const addr = document.createElement('p');
                addr.className = 'gym-meta';
                addr.textContent = row.address;
                item.appendChild(addr);
            }

            favoritesListEl.appendChild(item);
        });
    }

    async function refreshFavoritesList() {
        if (!currentUserId) return;
        const { data, error } = await db.from('favorite_gyms').select('*').eq('user_id', currentUserId);
        if (error) {
            console.error('Could not refresh favorite gyms:', error.message);
            return;
        }
        renderFavoritesSection(data || []);
    }

    async function toggleFavorite(gym, isCurrentlyFavorite) {
        if (!currentUserId) {
            setStatus('Log in to save favorite gyms.', 'error');
            return;
        }

        if (isCurrentlyFavorite) {
            favoriteIds.delete(gym.id);
            const { error } = await db.from('favorite_gyms').delete().eq('user_id', currentUserId).eq('gym_osm_id', gym.id);
            if (error) console.error('Could not remove favorite gym:', error.message);
        } else {
            favoriteIds.add(gym.id);
            const { error } = await db.from('favorite_gyms').upsert({
                user_id: currentUserId,
                gym_osm_id: gym.id,
                name: gym.name,
                lat: gym.lat,
                lon: gym.lon,
                address: gym.address || null
            }, { onConflict: 'user_id,gym_osm_id' });
            if (error) console.error('Could not save favorite gym:', error.message);
        }

        await refreshFavoritesList();
    }

    function renderResults(gyms, origin) {
        if (mapSkeletonEl) mapSkeletonEl.hidden = true;
        listEl.innerHTML = '';
        resultsLayer.clearLayers();

        L.circleMarker([origin.lat, origin.lon], {
            radius: 8, color: '#fafafa', weight: 3, fillColor: '#000000', fillOpacity: 1
        }).bindPopup(origin.isUser ? 'You are here' : origin.label).addTo(resultsLayer);

        if (activeFilters.size && lastGyms.length) {
            countEl.textContent = `${gyms.length} of ${lastGyms.length} gym${lastGyms.length === 1 ? '' : 's'} match your filters`;
        } else {
            countEl.textContent = gyms.length ? `${gyms.length} gym${gyms.length === 1 ? '' : 's'} found` : '';
        }

        if (!gyms.length) {
            map.setView([origin.lat, origin.lon], 13);
            const empty = document.createElement('li');
            empty.className = 'gym-empty';
            if (lastGyms.length && activeFilters.size) {
                empty.textContent = 'No gyms match your filters. Try clearing some.';
            } else {
                empty.textContent = 'No gyms found in this area. Try a bigger radius.';
                appendRetryButton(empty);
            }
            listEl.appendChild(empty);
            return;
        }

        const bounds = [[origin.lat, origin.lon]];

        gyms.forEach((gym) => {
            const isClosed = gym.today.status === 'closed';
            const marker = L.circleMarker([gym.lat, gym.lon], {
                radius: 8,
                color: isClosed ? '#6b6b66' : '#8fb81f',
                weight: 2,
                fillColor: isClosed ? '#8a8a85' : '#c5f23f',
                fillOpacity: isClosed ? 0.7 : 0.95
            }).bindPopup(popupContent(gym)).addTo(resultsLayer);
            marker.on('click', () => highlightListItem(gym.id));
            bounds.push([gym.lat, gym.lon]);

            const item = document.createElement('li');
            item.className = 'gym-item';
            item.dataset.gymId = gym.id;

            const head = document.createElement('div');
            head.className = 'gym-item-head';

            const nameRow = document.createElement('div');
            nameRow.className = 'gym-name-row';
            const name = document.createElement('button');
            name.type = 'button';
            name.className = 'gym-name';
            name.textContent = gym.name;
            name.addEventListener('click', function () {
                map.setView([gym.lat, gym.lon], 16);
                marker.openPopup();
                document.getElementById('gymMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            const isFav = favoriteIds.has(gym.id);
            const favBtn = document.createElement('button');
            favBtn.type = 'button';
            favBtn.className = 'gym-favorite-btn' + (isFav ? ' is-favorite' : '');
            favBtn.innerHTML = starSvg();
            favBtn.title = isFav ? 'Remove from favorites' : 'Save to favorites';
            favBtn.addEventListener('click', async function () {
                const currentlyFav = favoriteIds.has(gym.id);
                await toggleFavorite(gym, currentlyFav);
                favBtn.classList.toggle('is-favorite', !currentlyFav);
                favBtn.title = !currentlyFav ? 'Remove from favorites' : 'Save to favorites';
            });

            nameRow.append(name, favBtn);

            const side = document.createElement('div');
            side.className = 'gym-side';
            const distance = document.createElement('span');
            distance.className = 'gym-distance';
            distance.textContent = formatDistance(gym.distance);
            side.appendChild(distance);
            if (gym.today.status !== 'unknown') {
                const state = document.createElement('span');
                state.className = `gym-state is-${gym.today.status}`;
                state.textContent = gym.today.status === 'open' ? 'Open now' : 'Closed now';
                side.appendChild(state);
            }
            const today = document.createElement('span');
            today.className = 'gym-today';
            today.textContent = gym.today.text;
            side.appendChild(today);
            head.append(nameRow, side);
            item.appendChild(head);


            [gym.address, gym.hours && `Hours: ${gym.hours}`, gym.phone && `Phone: ${gym.phone}`]
                .filter(Boolean)
                .forEach((text) => {
                    const line = document.createElement('p');
                    line.className = 'gym-meta';
                    line.textContent = text;
                    item.appendChild(line);
                });

            item.appendChild(buildFeaturesMenu(gym));

            const links = document.createElement('div');
            links.className = 'gym-links';
            const directions = document.createElement('a');
            directions.href = directionsUrl(gym);
            directions.target = '_blank';
            directions.rel = 'noopener noreferrer';
            directions.textContent = 'Directions';
            links.appendChild(directions);
            if (gym.website) {
                const site = document.createElement('a');
                site.href = gym.website;
                site.target = '_blank';
                site.rel = 'noopener noreferrer';
                site.textContent = 'Website';
                links.appendChild(site);
            }
            item.appendChild(links);

            listEl.appendChild(item);
        });

        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }

    async function searchAround(origin) {
        initMap();
        lastSearch = origin;
        hideSuggestions();
        const radiusKm = Number(radiusEl.value);
        setBusy(true);
        setStatus(`Looking for gyms within ${radiusKm} km...`);
        document.getElementById('gymResults').hidden = false;
        map.invalidateSize();
        renderSkeleton();

        try {
            const results = await fetchGyms(origin.lat, origin.lon, radiusKm, (step, total) => {
                setStatus(`Busy area — searching part ${step} of ${total}...`);
            });
            const timeZone = origin.isUser ? Intl.DateTimeFormat().resolvedOptions().timeZone : timeZoneAt(origin.lat, origin.lon);
            const now = localNow(timeZone);
            const seen = new Set();
            const gyms = results
                .map((result) => toGym(result, origin.lat, origin.lon, now))
                .filter((gym) => {
                    if (!gym || gym.distance > radiusKm) return false;
                    // Same gym can come back from overlapping searches, or be mapped twice (building + point).
                    const key = `${gym.name.toLowerCase()}|${gym.lat.toFixed(3)}|${gym.lon.toFixed(3)}`;
                    if (seen.has(gym.id) || seen.has(key)) return false;
                    seen.add(gym.id);
                    seen.add(key);
                    return true;
                });

            lastGyms = gyms;
            applyFiltersAndSort();
            const openCount = gyms.filter((gym) => gym.today.status === 'open').length;
            const place = origin.isUser ? 'near you' : `near ${origin.label}`;
            setStatus(`Showing gyms ${place}. ${openCount} open now (local time ${formatClock(now)}), shown first.`, 'success');
        } catch (error) {
            console.error('Gym search failed:', error);
            if (mapSkeletonEl) mapSkeletonEl.hidden = true;
            listEl.innerHTML = '';
            countEl.textContent = '';
            setStatus('The gym search service is busy right now. Please try again in a moment.', 'error');
        } finally {
            setBusy(false);
        }
    }

    locateButton.addEventListener('click', function () {
        if (!navigator.geolocation) {
            setStatus('Your browser can\'t share your location. Search for a city instead.', 'error');
            return;
        }
        if (!window.isSecureContext) {
            setStatus('Location only works over HTTPS (or localhost). Open this page via a secure URL, or search for a city instead.', 'error');
            return;
        }
        hideSuggestions();
        setBusy(true);
        setStatus('Getting your location...');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                searchAround({ lat: position.coords.latitude, lon: position.coords.longitude, label: 'your location', isUser: true });
            },
            (error) => {
                setBusy(false);
                setStatus(error.code === error.PERMISSION_DENIED
                    ? 'Location access was blocked. Allow location for this site in your browser settings, or search for a city instead.'
                    : 'Couldn\'t get your location. Search for a city or address instead.', 'error');
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    });

    searchForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        hideSuggestions();
        const place = searchInput.value.trim();
        if (!place) {
            setStatus('Type a city or address to search.', 'error');
            return;
        }
        setBusy(true);
        setStatus(`Finding ${place}...`);
        try {
            const origin = await geocode(place);
            if (!origin) {
                setBusy(false);
                setStatus(`Couldn't find "${place}". Try a different spelling or a nearby city.`, 'error');
                return;
            }
            localStorage.setItem(LAST_QUERY_KEY, place);
            searchAround(origin);
        } catch (error) {
            console.error('Place search failed:', error);
            setBusy(false);
            setStatus('The place search service is busy right now. Please try again in a moment.', 'error');
        }
    });

    radiusEl.addEventListener('change', function () {
        if (lastSearch) searchAround(lastSearch);
    });

    // ---- Autocomplete suggestions ----
    let suggestDebounce = null;

    function hideSuggestions() {
        suggestionsEl.hidden = true;
        suggestionsEl.innerHTML = '';
    }

    function renderSuggestions(results) {
        if (!results.length) {
            hideSuggestions();
            return;
        }
        suggestionsEl.innerHTML = '';
        results.forEach((result) => {
            const label = result.display_name.split(',').slice(0, 2).join(',');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = result.display_name;
            btn.addEventListener('click', () => {
                searchInput.value = label;
                localStorage.setItem(LAST_QUERY_KEY, label);
                hideSuggestions();
                searchAround({ lat: Number(result.lat), lon: Number(result.lon), label, isUser: false });
            });
            suggestionsEl.appendChild(btn);
        });
        suggestionsEl.hidden = false;
    }

    async function fetchSuggestions(query) {
        try {
            const results = await nominatimSearch({ q: query, limit: '5', addressdetails: '1' });
            // The query can change while we were waiting on the throttled request.
            if (searchInput.value.trim() === query) renderSuggestions(results);
        } catch (error) {
            console.error('Suggestion search failed:', error);
        }
    }

    searchInput.addEventListener('input', function () {
        clearTimeout(suggestDebounce);
        const query = searchInput.value.trim();
        if (query.length < 3) {
            hideSuggestions();
            return;
        }
        suggestDebounce = setTimeout(() => fetchSuggestions(query), 450);
    });

    document.addEventListener('click', function (event) {
        if (!event.target.closest('.gym-search-wrap')) hideSuggestions();
    });

    // ---- Sort / unit / filter toolbar ----
    sortToggleEl.addEventListener('click', function (event) {
        const btn = event.target.closest('button[data-sort]');
        if (!btn) return;
        sortMode = btn.dataset.sort;
        sortToggleEl.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
        if (lastGyms.length) applyFiltersAndSort();
    });

    unitToggleEl.addEventListener('click', function (event) {
        const btn = event.target.closest('button[data-unit]');
        if (!btn) return;
        unit = btn.dataset.unit;
        localStorage.setItem(UNIT_KEY, unit);
        unitToggleEl.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
        if (lastGyms.length) applyFiltersAndSort();
    });

    filtersEl.addEventListener('click', function (event) {
        const btn = event.target.closest('button[data-filter]');
        if (!btn) return;
        const key = btn.dataset.filter;
        if (activeFilters.has(key)) activeFilters.delete(key); else activeFilters.add(key);
        btn.classList.toggle('is-active', activeFilters.has(key));
        if (lastGyms.length) applyFiltersAndSort();
    });

    if (unit === 'mi') {
        unitToggleEl.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.dataset.unit === 'mi'));
    }

    const savedQuery = localStorage.getItem(LAST_QUERY_KEY);
    if (savedQuery) searchInput.value = savedQuery;

    initFavorites();
})();
