// Gym Finder: finds gyms around the user's location (or a searched place) using
// OpenStreetMap's free Nominatim search. No API keys; the location is only used in the
// browser to search and is never saved.
(function () {
    const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
    const NOMINATIM_MAX_RESULTS = 40;
    // Nominatim's usage policy allows at most one request per second.
    const MIN_REQUEST_GAP_MS = 1100;
    let lastRequestAt = 0;

    const statusEl = document.getElementById('gymStatus');
    const listEl = document.getElementById('gymList');
    const countEl = document.getElementById('gymCount');
    const radiusEl = document.getElementById('gymRadius');
    const searchForm = document.getElementById('gymSearchForm');
    const searchInput = document.getElementById('gymSearchInput');
    const locateButton = document.getElementById('gymLocateButton');

    let map = null;
    let resultsLayer = null;
    let lastSearch = null;

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

    async function fetchGyms(lat, lon, radiusKm) {
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
            for (const quarter of quarters) {
                results = results.concat(await gymsInBox(quarter));
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

    function renderResults(gyms, origin) {
        listEl.innerHTML = '';
        resultsLayer.clearLayers();

        L.circleMarker([origin.lat, origin.lon], {
            radius: 8, color: '#fafafa', weight: 3, fillColor: '#000000', fillOpacity: 1
        }).bindPopup(origin.isUser ? 'You are here' : origin.label).addTo(resultsLayer);

        countEl.textContent = gyms.length ? `${gyms.length} gym${gyms.length === 1 ? '' : 's'} found` : '';

        if (!gyms.length) {
            map.setView([origin.lat, origin.lon], 13);
            const empty = document.createElement('li');
            empty.className = 'gym-empty';
            empty.textContent = 'No gyms found in this area. Try a bigger radius.';
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
            bounds.push([gym.lat, gym.lon]);

            const item = document.createElement('li');
            item.className = 'gym-item';

            const head = document.createElement('div');
            head.className = 'gym-item-head';
            const name = document.createElement('button');
            name.type = 'button';
            name.className = 'gym-name';
            name.textContent = gym.name;
            name.addEventListener('click', function () {
                map.setView([gym.lat, gym.lon], 16);
                marker.openPopup();
                document.getElementById('gymMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
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
            head.append(name, side);
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
        const radiusKm = Number(radiusEl.value);
        setBusy(true);
        setStatus(`Looking for gyms within ${radiusKm} km...`);
        document.getElementById('gymResults').hidden = false;
        map.invalidateSize();

        try {
            const results = await fetchGyms(origin.lat, origin.lon, radiusKm);
            const timeZone = origin.isUser ? Intl.DateTimeFormat().resolvedOptions().timeZone : timeZoneAt(origin.lat, origin.lon);
            const now = localNow(timeZone);
            const seen = new Set();
            const statusOrder = { open: 0, unknown: 1, closed: 2 };
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
                })
                // Open now first, then gyms without listed hours, then closed; nearest first within each.
                .sort((a, b) => (statusOrder[a.today.status] - statusOrder[b.today.status]) || (a.distance - b.distance));

            renderResults(gyms, origin);
            const openCount = gyms.filter((gym) => gym.today.status === 'open').length;
            const place = origin.isUser ? 'near you' : `near ${origin.label}`;
            setStatus(`Showing gyms ${place}. ${openCount} open now (local time ${formatClock(now)}), shown first.`, 'success');
        } catch (error) {
            console.error('Gym search failed:', error);
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
        setBusy(true);
        setStatus('Getting your location...');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                searchAround({ lat: position.coords.latitude, lon: position.coords.longitude, label: 'your location', isUser: true });
            },
            (error) => {
                setBusy(false);
                setStatus(error.code === error.PERMISSION_DENIED
                    ? 'Location access was blocked. Search for a city or address instead.'
                    : 'Couldn\'t get your location. Search for a city or address instead.', 'error');
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    });

    searchForm.addEventListener('submit', async function (event) {
        event.preventDefault();
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
})();
