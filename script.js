const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const HELSINKI_TZ = "Europe/Helsinki";
const OPEN_HOUR = 9;
const CLOSE_HOUR = 18;
const WEEKDAY = {
	Mon: 1,
	Monday: 1,
	Tue: 2,
	Tuesday: 2,
	Wed: 3,
	Wednesday: 3,
	Thu: 4,
	Thursday: 4,
	Fri: 5,
	Friday: 5,
	Sat: 6,
	Saturday: 6,
	Sun: 7,
	Sunday: 7,
};

const helsinkiTimeEl = document.getElementById("helsinki-time");
const hoursCardEl = document.getElementById("time");
const openClosedEl = hoursCardEl?.querySelector(".open-closed");
const reopensEl = hoursCardEl?.querySelector(".reopens");
const contactClockEl = document.querySelector(".contact-clock");
const clockHoursEl = contactClockEl?.querySelector(".t-hours");
const clockMinutesEl = contactClockEl?.querySelector(".t-minutes");
const clockSecondsEl = contactClockEl?.querySelector(".t-seconds");
const helsinkiTime = new Intl.DateTimeFormat("en-GB", {
	timeZone: HELSINKI_TZ,
	hour: "numeric",
	minute: "2-digit",
	hourCycle: "h23",
});
const helsinkiParts = new Intl.DateTimeFormat("en-GB", {
	timeZone: HELSINKI_TZ,
	weekday: "short",
	year: "numeric",
	month: "numeric",
	day: "numeric",
	hour: "numeric",
	minute: "numeric",
	second: "numeric",
	hourCycle: "h23",
});
const helsinkiWallCheck = new Intl.DateTimeFormat("en-GB", {
	timeZone: HELSINKI_TZ,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hourCycle: "h23",
});

function helsinkiClockParts(date = new Date()) {
	const parts = helsinkiParts.formatToParts(date);
	const raw = (type) => parts.find((part) => part.type === type)?.value;
	const value = (type) => Number(raw(type) ?? 0);
	return {
		weekday: WEEKDAY[raw("weekday")] ?? 0,
		year: value("year"),
		month: value("month"),
		day: value("day"),
		hour: value("hour"),
		minute: value("minute"),
		second: value("second"),
	};
}

function isHelsinkiOpen(parts) {
	if (parts.weekday < 1 || parts.weekday > 5) return false;
	const seconds = parts.hour * 3600 + parts.minute * 60 + parts.second;
	return seconds >= OPEN_HOUR * 3600 && seconds < CLOSE_HOUR * 3600;
}

function addCalendarDays(year, month, day, amount) {
	const utc = new Date(Date.UTC(year, month - 1, day + amount));
	return {
		year: utc.getUTCFullYear(),
		month: utc.getUTCMonth() + 1,
		day: utc.getUTCDate(),
	};
}

function helsinkiWallToUtc(year, month, day, hour, minute = 0, second = 0) {
	const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
	const seen = Object.fromEntries(
		helsinkiWallCheck
			.formatToParts(new Date(utcGuess))
			.filter((part) => part.type !== "literal")
			.map((part) => [part.type, Number(part.value)]),
	);
	const asUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
	return utcGuess + (utcGuess - asUtc);
}

function nextOpenUtc(parts) {
	const seconds = parts.hour * 3600 + parts.minute * 60 + parts.second;
	let addDays = 1;

	if (parts.weekday >= 1 && parts.weekday <= 5 && seconds < OPEN_HOUR * 3600) {
		addDays = 0;
	} else if (parts.weekday === 5 && seconds >= CLOSE_HOUR * 3600) {
		addDays = 3;
	} else if (parts.weekday === 6) {
		addDays = 2;
	} else if (parts.weekday === 7) {
		addDays = 1;
	}

	const next = addCalendarDays(parts.year, parts.month, parts.day, addDays);
	return helsinkiWallToUtc(next.year, next.month, next.day, OPEN_HOUR);
}

function hoursUntilOpen(parts, date = new Date()) {
	const remaining = nextOpenUtc(parts) - date.getTime();
	return Math.max(1, Math.round(remaining / 3_600_000));
}

function updateHelsinkiTime() {
	if (!helsinkiTimeEl) return;
	setText(helsinkiTimeEl, helsinkiTime.format(new Date()));
}

function updateOpenHours(parts) {
	if (!hoursCardEl || !openClosedEl || !reopensEl) return;

	const open = isHelsinkiOpen(parts);
	hoursCardEl.classList.toggle("is-closed", !open);
	setText(openClosedEl, open ? "Open" : "Closed");

	if (open) {
		reopensEl.hidden = true;
		return;
	}

	const hours = hoursUntilOpen(parts);
	reopensEl.hidden = false;
	setText(reopensEl, `Opens in ${hours} ${hours === 1 ? "hour" : "hours"}`);
}

function setText(element, text) {
	if (element.textContent !== text) element.textContent = text;
}

function updateContactClock() {
	if (!clockHoursEl || !clockMinutesEl || !clockSecondsEl) return;

	const parts = helsinkiClockParts();
	const { hour, minute, second } = parts;
	clockHoursEl.style.transform = `rotate(${(hour % 12) * 30 + minute * 0.5 + second * (0.5 / 60)}deg)`;
	clockMinutesEl.style.transform = `rotate(${minute * 6 + second * 0.1}deg)`;
	clockSecondsEl.style.transform = `rotate(${second * 6}deg)`;

	updateOpenHours(parts);

	if (contactClockEl) {
		const status = isHelsinkiOpen(parts) ? "Open" : "Closed";
		contactClockEl.setAttribute("aria-label", `Helsinki time ${helsinkiTime.format(new Date())}, ${status}`);
	}
}

function msUntilNextSecond() {
	return 1000 - (Date.now() % 1000) || 1000;
}

function startHelsinkiClock() {
	updateHelsinkiTime();
	updateContactClock();
	const tick = () => {
		updateHelsinkiTime();
		updateContactClock();
		setTimeout(tick, msUntilNextSecond());
	};
	setTimeout(tick, msUntilNextSecond());
}

startHelsinkiClock();

const particleCanvas = document.getElementById("particles");
const particleField = particleCanvas ? startParticleCanvas(particleCanvas) : null;

function startParticleCanvas(canvas) {
	const ctx =
		canvas.getContext("2d", { alpha: false, desynchronized: true }) ||
		canvas.getContext("2d", { alpha: false });
	if (!ctx) return null;

	const colors = ["#FD5F1C", "#AC9CFC", "#D6F50A"];
	const count = 40;
	const maxRadius = 60;
	const maxInternalWidth = 1192;
	const scheme = window.matchMedia("(prefers-color-scheme: dark)");
	const particles = [];
	const sprites = new Map();
	const pointer = { x: 0, y: 0, inside: false };

	let width = 0;
	let height = 0;
	let cssWidth = 1;
	let cssHeight = 1;
	let magnetR = 110;
	let magnetRsq = magnetR * magnetR;
	let fill = scheme.matches ? "#EBEBEB" : "#000";
	let running = false;
	let onScreen = true;
	let covered = false;
	let rafId = 0;

	function randomBetween(min, max) {
		return Math.floor(Math.random() * (max - min) + min);
	}

	function makeSprite(color) {
		const size = maxRadius * 2;
		const sprite = document.createElement("canvas");
		sprite.width = size;
		sprite.height = size;
		const spriteCtx = sprite.getContext("2d");
		if (!spriteCtx) return sprite;
		spriteCtx.fillStyle = color;
		spriteCtx.beginPath();
		spriteCtx.arc(maxRadius, maxRadius, maxRadius, 0, Math.PI * 2);
		spriteCtx.fill();
		return sprite;
	}

	for (const color of colors) sprites.set(color, makeSprite(color));

	function spawn(fromBottom) {
		const radius = randomBetween(30, maxRadius);
		const speed = randomBetween(2, 8);
		const color = colors[randomBetween(0, colors.length)];
		return {
			x: Math.random() * width,
			y: fromBottom ? height + radius : Math.random() * height,
			vx: 0,
			vy: speed,
			speed,
			radius,
			color,
			sprite: sprites.get(color),
		};
	}

	function resize() {
		const rect = canvas.getBoundingClientRect();
		cssWidth = Math.max(1, rect.width);
		cssHeight = Math.max(1, rect.height);
		const scale = Math.min(1, maxInternalWidth / cssWidth);
		const nextWidth = Math.max(1, Math.round(cssWidth * scale));
		const nextHeight = Math.max(1, Math.round(cssHeight * scale));

		if (nextWidth === width && nextHeight === height) return false;

		width = nextWidth;
		height = nextHeight;
		magnetR = Math.min(180, Math.max(110, Math.min(width, height) * 0.42));
		magnetRsq = magnetR * magnetR;
		canvas.width = width;
		canvas.height = height;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.imageSmoothingEnabled = true;

		if (particles.length === 0) {
			for (let i = 0; i < count; i += 1) particles.push(spawn(false));
			return true;
		}

		for (const particle of particles) {
			particle.x = Math.min(particle.x, width);
			particle.y = Math.min(particle.y, height);
		}
		return true;
	}

	function draw() {
		ctx.fillStyle = fill;
		ctx.fillRect(0, 0, width, height);

		for (const particle of particles) {
			const size = particle.radius * 2;
			ctx.drawImage(
				particle.sprite,
				particle.x - particle.radius,
				particle.y - particle.radius,
				size,
				size,
			);
		}
	}

	function tick() {
		if (!running) return;

		for (const particle of particles) {
			let influence = 0;

			if (pointer.inside) {
				const dx = pointer.x - particle.x;
				const dy = pointer.y - particle.y;
				const distSq = dx * dx + dy * dy;

				if (distSq < magnetRsq) {
					const falloff = 1 - Math.sqrt(distSq) / magnetR;
					influence = falloff * falloff;
				}
			}

			if (influence > 0) {
				particle.vx += (pointer.x - particle.x) * 0.14 * influence;
				particle.vx *= 1 - 0.22 * influence;
				particle.vy = particle.speed * (1 - influence * 0.9);
			} else {
				particle.vx *= 0.9;
				if (particle.vx > -0.04 && particle.vx < 0.04) particle.vx = 0;
				particle.vy += (particle.speed - particle.vy) * 0.1;
			}

			particle.x += particle.vx;
			particle.y -= particle.vy;

			if (particle.y <= -particle.radius * 2) {
				particle.x = Math.random() * width;
				particle.y = height + particle.radius;
				particle.vx = 0;
				particle.vy = particle.speed;
			}
		}

		draw();
		rafId = requestAnimationFrame(tick);
	}

	function start() {
		if (running) return;
		running = true;
		rafId = requestAnimationFrame(tick);
	}

	function stop() {
		running = false;
		cancelAnimationFrame(rafId);
	}

	function shouldAnimate() {
		return onScreen && !covered && !reduceMotion.matches && document.visibilityState === "visible";
	}

	function syncPlayback() {
		if (shouldAnimate()) start();
		else {
			stop();
			draw();
		}
	}

	function updatePointer(event) {
		pointer.x = event.offsetX * (width / cssWidth);
		pointer.y = event.offsetY * (height / cssHeight);
		pointer.inside = true;
	}

	resize();
	draw();
	syncPlayback();

	const resizeObserver = new ResizeObserver(() => {
		if (resize() && !running) draw();
	});
	resizeObserver.observe(canvas);

	const visibility = new IntersectionObserver(([entry]) => {
		onScreen = entry.isIntersecting;
		syncPlayback();
	});
	visibility.observe(canvas);

	canvas.addEventListener("pointerenter", updatePointer, { passive: true });
	canvas.addEventListener("pointermove", updatePointer, { passive: true });
	canvas.addEventListener("pointerleave", () => {
		pointer.inside = false;
	}, { passive: true });

	document.addEventListener("visibilitychange", syncPlayback);
	reduceMotion.addEventListener("change", syncPlayback);
	scheme.addEventListener("change", () => {
		fill = scheme.matches ? "#EBEBEB" : "#000";
		if (!running) draw();
	});

	// The focused gallery fades the header out; stop drawing once it is hidden.
	let coverTimer = 0;
	return {
		setCovered(next) {
			window.clearTimeout(coverTimer);
			if (!next) {
				covered = false;
				syncPlayback();
				return;
			}
			coverTimer = window.setTimeout(() => {
				covered = true;
				syncPlayback();
			}, cssMs(document.documentElement, "--time-cards"));
		},
	};
}

const contactButton = document.querySelector(".contact-button");
const contactToggle = contactButton?.querySelector(".contact-toggle");
const contactMenu = contactButton?.querySelector(".contact-menu");

function isContactOpen() {
	return !!contactButton?.classList.contains("is-open");
}

function setContactOpen(open) {
	if (!contactButton || !contactToggle || !contactMenu) return;
	if (open === isContactOpen()) return;
	if (open) setGalleryFocus(null);
	contactButton.classList.toggle("is-open", open);
	contactToggle.setAttribute("aria-expanded", String(open));
	contactToggle.setAttribute("aria-label", open ? "Close contact" : "Contact");
	contactMenu.setAttribute("aria-hidden", String(!open));
	if (!open && contactMenu.contains(document.activeElement)) contactToggle.focus({ preventScroll: true });
}

function measureContactButton() {
	if (!contactButton || !contactToggle) return;
	contactButton.style.setProperty("--contact-btn-w", `${Math.ceil(contactToggle.offsetWidth)}px`);
}

contactToggle?.addEventListener("click", (event) => {
	event.stopPropagation();
	setContactOpen(!isContactOpen());
});

document.addEventListener("pointerdown", (event) => {
	if (!isContactOpen()) return;
	if (contactButton.contains(event.target)) return;
	setContactOpen(false);
});

if (contactToggle) {
	measureContactButton();
	document.fonts?.ready.then(measureContactButton);
	new ResizeObserver(measureContactButton).observe(contactToggle);
}

const bookOpener = document.querySelector('a.inline[href="#book"]');
bookOpener?.addEventListener("click", (event) => {
	event.preventDefault();
	focusGallery(BOOK_ID);
});

document.querySelectorAll(".email [data-copy]").forEach((button) => {
	button.addEventListener("click", async () => {
		const value = button.getAttribute("data-copy");
		const email = button.closest(".email");
		if (!value || !email) return;
		try {
			await navigator.clipboard.writeText(value);
			email.classList.add("copied");
			window.setTimeout(() => {
				email.classList.remove("copied");
			}, 1000);
		} catch {
			/* ignore clipboard errors */
		}
	});
});

const gallery = document.getElementById("gallery");
const galleryDismiss = document.querySelector(".gallery-dismiss");
const galleryCards = gallery ? [...gallery.querySelectorAll(".gallery-card")] : [];
const galleryCount = galleryCards.length;
// The book sits at the back of the stack. It is not one of the counted cards, but
// it is focused through the same state machine: galleryActive === BOOK_ID.
const BOOK_ID = "book";
const book = gallery?.querySelector(".book") ?? null;
const bookScroll = book?.querySelector(".book-scroll") ?? null;
const galleryHeader = document.querySelector("header");
const galleryMobile = window.matchMedia("(max-width: 700px)");
let galleryActive = null;
let galleryOrigin = 0;
let galleryPeek = 60;
const workItemIndexByCard = new WeakMap();

function galleryTabSize() {
	return parseFloat(getComputedStyle(gallery).getPropertyValue("--gallery-tab")) || 60;
}

function galleryIsMobile() {
	return galleryMobile.matches;
}

function updateGalleryMetrics() {
	const tab = galleryTabSize();
	galleryOrigin = galleryHeader ? galleryHeader.getBoundingClientRect().bottom : 0;
	const available = Math.max(0, window.innerHeight - galleryOrigin);
	galleryPeek = Math.max(tab, available / galleryCount);

	gallery?.style.setProperty("--gallery-origin", `${galleryOrigin}px`);
	gallery?.style.setProperty("--gallery-peek", `${galleryPeek}px`);
}

function galleryIsBook(active = galleryActive) {
	return active === BOOK_ID;
}

function galleryCardY(index, active) {
	if (active === null) {
		return `${galleryOrigin + (galleryCount - 1 - index) * galleryPeek}px`;
	}

	// With the book open every card moves to its "front" slot.
	const front = galleryIsBook(active) || index < active;

	if (galleryIsMobile()) {
		// The open book takes the whole screen: push every card out of view.
		if (galleryIsBook(active)) return `${window.innerHeight}px`;
		const peek = galleryTabSize();
		if (!front) return `${(galleryCount - 1 - index) * peek}px`;
		return `${window.innerHeight - (index + 1) * peek}px`;
	}

	if (!front) {
		return "0px";
	}

	return `${window.innerHeight - galleryTabSize()}px`;
}

function setGalleryFocus(nextIndex) {
	const prev = galleryActive;
	const changed = prev !== nextIndex;
	galleryActive = nextIndex;
	const focused = nextIndex !== null;
	const bookActive = galleryIsBook(nextIndex);
	if (changed && typeof nextIndex === "number") {
		workItemIndexByCard.delete(galleryCards[nextIndex]);
	}

	gallery?.classList.toggle("is-focused", focused);
	gallery?.classList.toggle("is-book", bookActive);
	if (changed) particleField?.setCovered(focused);
	gallery?.style.setProperty("--gallery-front", focused ? String(bookActive ? galleryCount : nextIndex) : "0");

	if (!focused) {
		const active = document.activeElement;
		if (active instanceof HTMLElement && gallery?.contains(active)) active.blur();
	}

	galleryCards.forEach((card, index) => {
		const isActive = index === nextIndex;
		card.classList.toggle("is-active", isActive);
		card.classList.toggle("is-front", focused && (bookActive || index < nextIndex));
		card.classList.toggle("is-back", focused && !bookActive && index > nextIndex);
		card.setAttribute("aria-current", isActive ? "true" : "false");
		card.tabIndex = focused && isActive ? -1 : 0;
		card.style.setProperty("--gallery-y", galleryCardY(index, nextIndex));
	});

	if (book) {
		book.classList.toggle("is-active", bookActive);
		book.setAttribute("aria-current", bookActive ? "true" : "false");
		book.tabIndex = bookActive ? -1 : 0;
		bookOpener?.setAttribute("aria-expanded", bookActive ? "true" : "false");
		if (changed && bookActive) {
			// From the unfocused stack the card transition first carries the book to
			// the middle and lays it flat; when another card was focused it is
			// already there, so the cover can open right away.
			openBook(prev === null);
		} else if (changed && galleryIsBook(prev)) {
			closeBook();
		}
	}
}

// User-driven focus changes go through here so dismissing the open book can
// fold the cover before the gallery transitions back to the stack.
function focusGallery(next) {
	if (next === null && galleryIsBook() && bookIsOpen()) {
		closeBook(() => {
			if (galleryIsBook()) setGalleryFocus(null);
		});
		return;
	}
	setGalleryFocus(next);
}

function layoutGallery() {
	updateGalleryMetrics();
	setGalleryFocus(galleryActive);
}

galleryCards.forEach((card, index) => {
	card.addEventListener("click", () => {
		if (galleryActive === index) return;
		focusGallery(index);
	});

	card.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			if (galleryActive !== index) focusGallery(index);
		}
	});
});

book?.addEventListener("click", () => {
	if (!galleryIsBook()) focusGallery(BOOK_ID);
});
book?.addEventListener("keydown", (event) => {
	if (galleryIsBook()) return;
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		focusGallery(BOOK_ID);
	}
});

function workItems(card) {
	const row = card?.querySelector(".work-images");
	return row ? [...row.children] : [];
}

function workItemPad(item) {
	return parseFloat(getComputedStyle(item.parentElement).paddingInlineStart) || 0;
}

function workItemScrollLeft(content, item) {
	const row = item.parentElement;
	return item.offsetLeft + (row && row !== content ? row.offsetLeft : 0);
}

function leadingWorkItemIndex(content, items) {
	if (!items.length) return 0;
	const origin = content.getBoundingClientRect().left + workItemPad(items[0]);
	let best = 0;
	let bestDist = Infinity;
	items.forEach((item, index) => {
		const dist = Math.abs(item.getBoundingClientRect().left - origin);
		if (dist < bestDist) {
			bestDist = dist;
			best = index;
		}
	});
	return best;
}

function lastReachableWorkItemIndex(content, items) {
	const max = Math.max(0, content.scrollWidth - content.clientWidth);
	let last = 0;
	for (let i = 0; i < items.length; i++) {
		last = i;
		if (workItemScrollLeft(content, items[i]) >= max - 1) break;
	}
	return last;
}

function scrollWorkItemIntoView(content, item) {
	const max = Math.max(0, content.scrollWidth - content.clientWidth);
	const target = Math.max(0, Math.min(max, workItemScrollLeft(content, item)));
	if (Math.abs(content.scrollLeft - target) < 1) return;
	content.scrollTo({ left: content.scrollLeft, behavior: "auto" });
	content.scrollTo({ left: target, behavior: "smooth" });
}

function navigateWorkItems(delta) {
	if (galleryActive === null || galleryIsBook()) return false;
	const card = galleryCards[galleryActive];
	const content = card?.querySelector(".gallery-content");
	const items = workItems(card);
	if (!content || items.length === 0) return false;

	const last = lastReachableWorkItemIndex(content, items);
	const leading = leadingWorkItemIndex(content, items);
	const stored = workItemIndexByCard.get(card);
	const current = Math.min(last, stored ?? leading);
	const next = Math.max(0, Math.min(last, current + delta));
	workItemIndexByCard.set(card, next);
	scrollWorkItemIntoView(content, items[next]);
	return true;
}

galleryDismiss?.addEventListener("click", () => {
	focusGallery(null);
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && galleryActive !== null) {
		event.preventDefault();
		focusGallery(null);
		return;
	}

	if (event.key === "Escape" && isContactOpen()) {
		setContactOpen(false);
		return;
	}

	if (event.metaKey || event.ctrlKey || event.altKey) return;

	if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
		if (navigateWorkItems(event.key === "ArrowRight" ? 1 : -1)) event.preventDefault();
		return;
	}

	if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

	const inGallery = gallery?.contains(document.activeElement) || galleryActive !== null;
	if (!inGallery && galleryActive === null) return;

	event.preventDefault();

	// Up walks toward the back of the stack (Squid, then the book); down returns.
	if (event.key === "ArrowUp") {
		if (galleryIsBook()) return;
		if (galleryActive === null) {
			focusGallery(0);
		} else if (galleryActive >= galleryCount - 1) {
			focusGallery(book ? BOOK_ID : galleryActive);
		} else {
			focusGallery(galleryActive + 1);
		}
		return;
	}

	if (galleryActive === null || galleryIsBook()) {
		focusGallery(galleryCount - 1);
		return;
	}
	focusGallery(Math.max(0, galleryActive - 1));
});

document.querySelectorAll(".gallery-content:has(.work-images)").forEach((content) => {
	content.addEventListener("wheel", (event) => {
		const card = content.closest(".gallery-card");
		if (!gallery?.classList.contains("is-focused") || !card?.classList.contains("is-active")) return;
		if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
		if (content.scrollWidth <= content.clientWidth) return;
		event.preventDefault();
		content.scrollLeft += event.deltaY;
		workItemIndexByCard.set(card, leadingWorkItemIndex(content, workItems(card)));
	}, { passive: false });
});

layoutGallery();
window.addEventListener("resize", layoutGallery);
galleryMobile.addEventListener("change", layoutGallery);
if (galleryHeader) {
	new ResizeObserver(layoutGallery).observe(galleryHeader);
}

let bookTimer = 0;
let bookAfterClose = null;

function bookIsOpen() {
	return !!book?.classList.contains("is-open");
}

function cssMs(element, name) {
	if (reduceMotion.matches) return 0;
	const raw = getComputedStyle(element).getPropertyValue(name).trim();
	const value = parseFloat(raw);
	if (Number.isNaN(value)) return 0;
	return raw.endsWith("ms") ? value : value * 1000;
}

// Opens the cover. When `afterArrival` is set, wait for the gallery card
// transition to finish carrying the book to the middle of the screen first.
function openBook(afterArrival) {
	if (!book) return;
	window.clearTimeout(bookTimer);
	book.classList.remove("is-closing");
	bookAfterClose = null;
	setContactOpen(false);
	if (bookScroll) bookScroll.scrollTop = 0;

	const start = () => {
		window.clearTimeout(bookTimer);
		if (!galleryIsBook() || bookIsOpen()) return;
		book.classList.add("is-open");
		if (bookScroll) {
			requestAnimationFrame(() => {
				bookScroll.dispatchEvent(new Event("scroll"));
			});
		}
	};

	const wait = afterArrival ? cssMs(document.documentElement, "--time-cards") : 0;
	if (wait > 0) {
		bookTimer = window.setTimeout(start, wait + 20);
	} else {
		start();
	}
}

// Folds the cover shut. `done` runs once the fold has finished (or right away
// when there is nothing to fold), so callers can sequence the stack transition.
function closeBook(done) {
	if (!book) {
		done?.();
		return;
	}
	if (book.classList.contains("is-closing")) {
		if (done) bookAfterClose = done;
		return;
	}
	window.clearTimeout(bookTimer);
	if (!bookIsOpen()) {
		done?.();
		return;
	}

	bookAfterClose = done ?? null;
	book.classList.remove("is-open");
	book.classList.add("is-closing");
	if (book.contains(document.activeElement)) book.focus({ preventScroll: true });
	bookTimer = window.setTimeout(() => {
		book.classList.remove("is-closing");
		const after = bookAfterClose;
		bookAfterClose = null;
		after?.();
	}, cssMs(book, "--book-dismiss-duration") + 40);
}

const timeline = document.querySelector(".book-section.timeline");
if (timeline && bookScroll) {
	const dashesRoot = timeline.querySelector(".timeline-dashes");
	const yearItems = [...timeline.querySelectorAll(".timeline-years li")];
	const jobItems = [...timeline.querySelectorAll(".timeline-job")];
	const monthsPerYear = 12;
	const yearCount = yearItems.length;
	const dashCount = yearCount * monthsPerYear;
	const jobSpans = jobItems.map((item) => Math.max(1, Number(item.dataset.years) || 1));
	const jobStarts = jobSpans.reduce((starts, span, index) => {
		starts.push(index === 0 ? 0 : starts[index - 1] + jobSpans[index - 1]);
		return starts;
	}, []);

	for (let i = 0; i < dashCount; i += 1) {
		const dash = document.createElement("div");
		dash.className = "timeline-dash";
		dash.appendChild(document.createElement("span"));
		dashesRoot.appendChild(dash);
	}
	const dashMarks = [...dashesRoot.querySelectorAll("span")];

	function clamp(value, min, max) {
		return Math.min(max, Math.max(min, value));
	}

	function smoothstep(t) {
		const x = clamp(t, 0, 1);
		return x * x * (3 - 2 * x);
	}

	function jobIndexAtMonth(month) {
		const yearPos = month / monthsPerYear;
		const last = jobItems.length - 1;
		for (let i = 0; i < jobItems.length; i += 1) {
			const start = jobStarts[i];
			const span = jobSpans[i];
			const end = i === last ? yearCount : start + span;
			if (yearPos < end || i === last) {
				if (i < last && yearPos > end - 0.35) {
					return i + smoothstep((yearPos - (end - 0.35)) / 0.35);
				}
				return i;
			}
		}
		return last;
	}

	function styleJob(item, offset) {
		const company = item.querySelector("h2");
		const title = item.querySelector("h3");
		const abs = Math.abs(offset);
		const hidden = abs > 2.55;
		item.style.visibility = hidden ? "hidden" : "visible";
		if (reduceMotion.matches) {
			item.style.transform = `translateY(calc(-50% + ${offset * 98}px))`;
			company.style.transform = "none";
			title.style.transform = "none";
			company.style.opacity = String(clamp(Math.exp(-abs * 1.05), 0.04, 1));
			title.style.opacity = String(clamp(Math.exp(-abs * 0.78), 0.06, 1));
			return;
		}
		const radius = 200;
		const angle = offset * -20;
		const spread = offset * 24;
		item.style.transform = `translateY(calc(-50% + ${spread}px)) rotateX(${angle}deg) translateZ(${radius}px)`;
		company.style.transform = `translateY(${offset * -3}px) rotateX(${offset * -5}deg)`;
		title.style.transform = `translateY(${offset * -1}px) rotateX(${offset * -3}deg)`;
		company.style.opacity = String(clamp(Math.exp(-abs * 1.05), 0.04, 1));
		title.style.opacity = String(clamp(Math.exp(-abs * 0.78), 0.06, 1));
	}

	function updateTimeline() {
		if (!dashMarks.length) return;
		const pane = bookScroll.getBoundingClientRect();
		const centerY = pane.top + pane.height / 2;
		const slot = dashMarks[0].parentElement.offsetHeight || 32;
		const first = dashMarks[0].parentElement.getBoundingClientRect();
		const month = clamp((centerY - (first.top + slot / 2)) / slot, 0, dashCount - 1);
		const range = slot * 4.5;

		for (let i = 0; i < dashMarks.length; i += 1) {
			const mark = dashMarks[i];
			const dist = Math.abs((first.top + slot / 2 + i * slot) - centerY);
			const proximity = clamp(1 - dist / range, 0, 1);
			const p = proximity * proximity;
			mark.style.transform = `scaleX(${1 + p * 0.875}) scaleY(${1 + p * 0.5})`;
		}

		const currentYear = clamp(Math.floor(month / monthsPerYear), 0, yearCount - 1);
		yearItems.forEach((item, index) => {
			item.classList.toggle("is-current", index === currentYear);
		});
		const currentJob = jobIndexAtMonth(month);
		jobItems.forEach((item, index) => styleJob(item, index - currentJob));
	}

	let timelineFrame = 0;
	function requestTimelineUpdate() {
		if (timelineFrame) return;
		timelineFrame = window.requestAnimationFrame(() => {
			timelineFrame = 0;
			updateTimeline();
		});
	}

	bookScroll.addEventListener("scroll", requestTimelineUpdate, { passive: true });
	window.addEventListener("resize", requestTimelineUpdate);
	new ResizeObserver(requestTimelineUpdate).observe(bookScroll);
	updateTimeline();
}

if (document.documentElement.classList.contains("is-intro")) {
	const introRoot = document.documentElement;
	const finishIntro = () => {
		introRoot.classList.remove("is-intro", "is-intro-play", "is-intro-chrome", "is-intro-cards-done");
		document.querySelector(".hero")?.style.removeProperty("--intro-y");
	};
	if (reduceMotion.matches) {
		finishIntro();
	} else {
		const hero = document.querySelector(".hero");
		const introMs = (name) => cssMs(introRoot, name);
		const playIntro = () => {
			layoutGallery();
			if (hero) {
				const rect = hero.getBoundingClientRect();
				hero.style.setProperty("--intro-y", `${window.innerHeight / 2 - (rect.top + rect.height / 2)}px`);
			}
			requestAnimationFrame(() => {
				introRoot.classList.add("is-intro-play");
				const lastCardEnd =
					introMs("--intro-card-start") +
					Math.max(0, galleryCount - 1) * introMs("--intro-stagger") +
					introMs("--intro-card");
				const chromeStart = Math.max(0, introMs("--intro-hero") - introMs("--intro-chrome-lead"));
				const chromeEnd = chromeStart + introMs("--intro-chrome");
				window.setTimeout(() => introRoot.classList.add("is-intro-chrome"), chromeStart);
				window.setTimeout(() => introRoot.classList.add("is-intro-cards-done"), lastCardEnd);
				window.setTimeout(finishIntro, Math.max(lastCardEnd, chromeEnd) + 40);
			});
		};
		// Play once the type and the leading image of every card are ready, but
		// never hold a blank page longer than INTRO_MAX_WAIT on slow connections.
		const INTRO_MAX_WAIT = 3000;
		const leadImages = galleryCards
			.map((card) => card.querySelector(".work-images img"))
			.filter(Boolean);
		const ready = Promise.all([
			document.fonts?.ready ?? Promise.resolve(),
			...leadImages.map((img) => img.decode().catch(() => {})),
		]);
		const timeout = new Promise((resolve) => window.setTimeout(resolve, INTRO_MAX_WAIT));
		Promise.race([ready, timeout]).then(() => requestAnimationFrame(playIntro));
	}
}
