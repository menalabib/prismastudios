const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const header = $(".site-header");
const menuButton = $(".menu-btn");
const nav = $("#nav");

if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
}

function wrapWords(element) {
  const words = element.textContent.trim().split(/\s+/);
  element.textContent = "";
  return words.map((word, index) => {
    const outer = document.createElement("span");
    outer.className = "w";
    const inner = document.createElement("span");
    inner.textContent = word;
    inner.style.setProperty("--i", index);
    outer.append(inner);
    element.append(outer, " ");
    return outer;
  });
}

$$("[data-split]").forEach((element) => {
  const label = element.textContent.trim();
  wrapWords(element);
  element.setAttribute("aria-label", label);
  $$(".w", element).forEach((word) => word.setAttribute("aria-hidden", "true"));
});

const litBlocks = $$("[data-lit]").map((element) => {
  const words = wrapWords(element);
  words.forEach((word) => word.replaceChildren(...word.firstChild.childNodes));
  return { element, words, lit: 0 };
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
);
$$(".reveal, .split").forEach((element) => {
  if (reduce) element.classList.add("in");
  else revealObserver.observe(element);
});

/* scroll-linked effects */
const progress = $(".progress");
const parallax = $$("[data-parallax]");
const hscroll = $(".hscroll");
const hscrollTrack = hscroll && $(".hscroll-track", hscroll);
const hscrollQuery = matchMedia("(min-width: 900px) and (prefers-reduced-motion: no-preference)");
let hscrollDistance = 0;
let hscrollTop = 0;

function measureHscroll() {
  if (!hscroll) return;
  if (!hscrollQuery.matches) {
    hscroll.style.height = "";
    hscrollTrack.style.transform = "";
    hscrollDistance = 0;
    return;
  }
  hscrollDistance = Math.max(0, hscrollTrack.scrollWidth - innerWidth + 48);
  hscroll.style.height = `${innerHeight + hscrollDistance}px`;
  hscrollTop = hscroll.getBoundingClientRect().top + scrollY;
}

function update() {
  const y = scrollY;
  const max = root.scrollHeight - innerHeight;
  header.classList.toggle("scrolled", y > 24);
  if (progress) progress.style.setProperty("--p", max > 0 ? clamp(y / max, 0, 1) : 0);

  if (!reduce) {
    parallax.forEach((element) => {
      const rect = element.parentElement.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > innerHeight + 200) return;
      element.style.setProperty("--py", `${(innerHeight / 2 - (rect.top + rect.height / 2)) * -0.12}px`);
    });
  }

  litBlocks.forEach((block) => {
    const rect = block.element.getBoundingClientRect();
    const start = innerHeight * 0.88;
    const end = innerHeight * 0.4;
    const p = clamp((start - rect.top) / (start - end + rect.height), 0, 1);
    const count = reduce ? block.words.length : Math.round(p * block.words.length);
    if (count === block.lit) return;
    block.words.forEach((word, index) => word.classList.toggle("on", index < count));
    block.lit = count;
  });

  if (hscrollDistance) {
    const p = clamp((y - hscrollTop) / hscrollDistance, 0, 1);
    hscrollTrack.style.transform = `translate3d(${-p * hscrollDistance}px, 0, 0)`;
  }
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    update();
  });
}
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", () => {
  measureHscroll();
  onScroll();
});
addEventListener("load", () => {
  measureHscroll();
  update();
});
measureHscroll();
update();

/* equalizer canvas */
const spectrum = ["#ff0a1e", "#ff2bd9", "#6a2cf0", "#0a63f0", "#0cc3e6", "#00e45a"];

function startEqualizer(canvas) {
  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let step = 14;
  let values = new Float32Array(0);
  let gradient;
  let pointer = -1;
  let visible = true;
  let start = performance.now();

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    step = width < 700 ? 10 : 14;
    values = new Float32Array(Math.ceil(width / step));
    gradient = ctx.createLinearGradient(0, 0, width, 0);
    spectrum.forEach((color, index) => gradient.addColorStop(index / (spectrum.length - 1), color));
  }

  function draw(now) {
    const t = (now - start) / 1000;
    const intro = reduce ? 1 : 1 - Math.pow(1 - clamp(t / 1.8, 0, 1), 3);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = gradient;
    const count = values.length;
    for (let i = 0; i < count; i++) {
      const x = i / count;
      let target = (0.5 + 0.5 * Math.sin(t * 1.4 + i * 0.23)) * (0.5 + 0.5 * Math.sin(t * 0.7 + i * 0.09 + 1.7));
      target = 0.08 + target * (0.35 + 0.4 * Math.sin(Math.PI * x));
      if (pointer >= 0) target += Math.exp(-Math.pow(x - pointer, 2) / 0.004) * 0.75;
      values[i] += (Math.min(target, 1) * intro - values[i]) * 0.14;
      const barHeight = Math.max(2, values[i] * height);
      ctx.fillRect(i * step, height - barHeight, step * 0.5, barHeight);
    }
  }

  function loop(now) {
    if (visible && !document.hidden) draw(now);
    requestAnimationFrame(loop);
  }

  resize();
  addEventListener("resize", resize);
  if (reduce) {
    start = performance.now() - 3000;
    draw(performance.now());
    return;
  }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(canvas);
  const area = canvas.parentElement;
  area.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer = (event.clientX - rect.left) / rect.width;
  });
  area.addEventListener("pointerleave", () => { pointer = -1; });
  requestAnimationFrame(loop);
}
$$("canvas[data-eq]").forEach(startEqualizer);

/* cursor glow */
const glow = $(".glow");
if (glow && fine && !reduce) {
  let x = innerWidth / 2;
  let y = innerHeight / 2;
  let gx = x;
  let gy = y;
  addEventListener("pointermove", (event) => {
    x = event.clientX;
    y = event.clientY;
    glow.classList.add("on");
  }, { passive: true });
  (function follow() {
    gx += (x - gx) * 0.08;
    gy += (y - gy) * 0.08;
    glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
    requestAnimationFrame(follow);
  })();
}

/* floating photo that follows the cursor over index rows */
if (fine && !reduce) {
  const rows = $$("[data-img]");
  if (rows.length) {
    const peek = document.createElement("img");
    peek.className = "peek";
    peek.alt = "";
    document.body.append(peek);
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let running = false;

    function move() {
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      const width = peek.offsetWidth;
      const left = Math.min(x + 36, innerWidth - width - 16);
      peek.style.setProperty("--x", `${left}px`);
      peek.style.setProperty("--y", `${y - peek.offsetHeight / 2}px`);
      if (running) requestAnimationFrame(move);
    }

    rows.forEach((row) => {
      row.addEventListener("pointerenter", (event) => {
        peek.src = row.dataset.img;
        tx = x = event.clientX;
        ty = y = event.clientY;
        peek.classList.add("on");
        if (!running) {
          running = true;
          move();
        }
      });
      row.addEventListener("pointermove", (event) => {
        tx = event.clientX;
        ty = event.clientY;
      });
      row.addEventListener("pointerleave", () => {
        peek.classList.remove("on");
        running = false;
      });
    });
  }
}

/* tilt and light on people cards */
if (fine && !reduce) {
  $$("[data-tilt]").forEach((card) => {
    const frame = $(".frame", card);
    card.addEventListener("pointermove", (event) => {
      const rect = frame.getBoundingClientRect();
      const px = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const py = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      frame.style.setProperty("--mx", `${px * 100}%`);
      frame.style.setProperty("--my", `${py * 100}%`);
      frame.style.transform = `rotateX(${(0.5 - py) * 9}deg) rotateY(${(px - 0.5) * 11}deg) scale(1.02)`;
    });
    card.addEventListener("pointerleave", () => {
      frame.style.transform = "";
    });
  });
}

/* artist player: the Spotify embed loads only when an artist is opened */
const artistDialog = $("dialog.artist-dialog");
if (artistDialog) {
  const slot = $(".artist-dialog-slot", artistDialog);
  const title = $("h2", artistDialog);
  const link = $(".link-arrow", artistDialog);
  $$("a.person[data-spotify]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      title.textContent = card.dataset.name;
      link.href = card.href;
      const frame = document.createElement("iframe");
      frame.src = `https://open.spotify.com/embed/artist/${card.dataset.spotify}?utm_source=generator&theme=0`;
      frame.title = `${artistDialog.dataset.player}: ${card.dataset.name}`;
      frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      slot.replaceChildren(frame);
      artistDialog.showModal();
    });
  });
  $(".close", artistDialog).addEventListener("click", () => artistDialog.close());
  artistDialog.addEventListener("click", (event) => {
    if (event.target === artistDialog) artistDialog.close();
  });
  artistDialog.addEventListener("close", () => slot.replaceChildren());
}

/* videos: the YouTube player loads only when a video is played */
let playing = null;
$$("a.video-poster[data-yt]").forEach((poster) => {
  poster.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    if (playing) playing.frame.replaceWith(playing.poster);
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${poster.dataset.yt}?autoplay=1&rel=0&playsinline=1`;
    frame.title = poster.dataset.title;
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allowFullscreen = true;
    poster.replaceWith(frame);
    playing = { poster, frame };
  });
});

/* songs: the list is built from data/playlist.json, which a scheduled job keeps up to date */
const songs = $("#songs");
if (songs) {
  const LIMIT = 12;
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const duration = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const closeSong = (item) => {
    item.classList.remove("open");
    $(".track-head", item).setAttribute("aria-expanded", "false");
    setTimeout(() => {
      if (!item.classList.contains("open")) $("iframe", item)?.remove();
    }, 700);
  };
  const openSong = (item) => {
    const slot = $(".track-slot", item);
    if (!$("iframe", slot)) {
      const frame = document.createElement("iframe");
      frame.src = `https://open.spotify.com/embed/track/${item.dataset.id}?utm_source=generator&theme=0`;
      frame.title = item.dataset.title;
      frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      slot.append(frame);
    }
    item.classList.add("open");
    $(".track-head", item).setAttribute("aria-expanded", "true");
  };

  fetch(songs.dataset.src)
    .then((response) => {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then((data) => {
      const meta = el("p", "songs-meta", `${data.name} \u00b7 ${data.tracks.length} ${songs.dataset.countLabel}`);
      const list = el("ol", "tracklist");
      data.tracks.forEach((track, index) => {
        const item = el("li", "track reveal");
        item.style.setProperty("--d", index % 4);
        item.dataset.id = track.id;
        item.dataset.title = `${songs.dataset.player}: ${track.title}`;
        if (index >= LIMIT) item.hidden = true;

        const head = el("a", "track-head");
        head.href = `https://open.spotify.com/track/${track.id}`;
        head.target = "_blank";
        head.rel = "noopener";
        head.setAttribute("role", "button");
        head.setAttribute("aria-expanded", "false");
        head.setAttribute("aria-controls", `song-${index}`);

        const title = el("span", "track-title", track.title);
        if (track.explicit) {
          const badge = el("abbr", "badge", "E");
          badge.title = songs.dataset.explicit;
          title.append(badge);
        }
        const text = el("span");
        text.append(title, el("span", "track-artists", track.artists));

        const icon = el("i", "eqicon");
        icon.setAttribute("aria-hidden", "true");
        icon.append(el("b"), el("b"), el("b"));
        const play = el("span", "track-play");
        play.append(icon, el("span", "", songs.dataset.listen));

        head.append(el("span", "num", String(index + 1).padStart(2, "0")), text, el("span", "track-time", duration(track.duration)), play);

        const panel = el("div", "track-panel");
        panel.id = `song-${index}`;
        panel.append(el("div", "track-slot"));
        item.append(head, panel);
        list.append(item);
        if (reduce) item.classList.add("in");
        else revealObserver.observe(item);
      });

      list.addEventListener("click", (event) => {
        const head = event.target.closest(".track-head");
        if (!head || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        const item = head.closest(".track");
        const wasOpen = item.classList.contains("open");
        $$(".track.open", list).forEach(closeSong);
        if (!wasOpen) openSong(item);
      });
      list.addEventListener("keydown", (event) => {
        if (event.key === " " && event.target.matches(".track-head")) {
          event.preventDefault();
          event.target.click();
        }
      });

      $(".songs-status", songs).replaceWith(meta, list);

      if (data.tracks.length > LIMIT) {
        const more = el("button", "more-btn", songs.dataset.more);
        more.type = "button";
        more.setAttribute("aria-expanded", "false");
        more.addEventListener("click", () => {
          const expanded = more.getAttribute("aria-expanded") !== "true";
          $$(".track", list).forEach((item, index) => {
            if (index >= LIMIT) item.hidden = !expanded;
          });
          more.setAttribute("aria-expanded", String(expanded));
          more.textContent = expanded ? songs.dataset.less : songs.dataset.more;
        });
        songs.append(more);
      }
    })
    .catch(() => {
      $(".songs-status", songs).textContent = songs.dataset.error;
    });
}

/* lightbox */
const lightbox = $("dialog.lightbox");
const items = $$(".gallery button");

if (lightbox && items.length) {
  const image = $("img", lightbox);
  const canTransition = typeof document.startViewTransition === "function" && !reduce;
  let current = 0;

  const show = (index) => {
    current = (index + items.length) % items.length;
    const thumb = $("img", items[current]);
    image.src = items[current].dataset.full;
    image.alt = thumb.alt;
  };

  const thumbOf = () => $("img", items[current]);

  const openAt = (index) => {
    const origin = $("img", items[index]);
    if (!canTransition) {
      show(index);
      lightbox.showModal();
      return;
    }
    origin.style.viewTransitionName = "photo";
    const transition = document.startViewTransition(async () => {
      origin.style.viewTransitionName = "";
      show(index);
      lightbox.showModal();
      image.style.viewTransitionName = "photo";
      await image.decode().catch(() => {});
    });
    transition.finished.finally(() => { image.style.viewTransitionName = ""; });
  };

  const closeBox = () => {
    if (!canTransition) {
      lightbox.close();
      return;
    }
    image.style.viewTransitionName = "photo";
    const transition = document.startViewTransition(() => {
      image.style.viewTransitionName = "";
      lightbox.close();
      thumbOf().style.viewTransitionName = "photo";
    });
    transition.finished.finally(() => { thumbOf().style.viewTransitionName = ""; });
  };

  items.forEach((button, index) => button.addEventListener("click", () => openAt(index)));
  $(".close", lightbox).addEventListener("click", closeBox);
  $(".prev", lightbox).addEventListener("click", () => show(current - 1));
  $(".next", lightbox).addEventListener("click", () => show(current + 1));
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox || event.target.tagName === "FIGURE") closeBox();
  });
  lightbox.addEventListener("cancel", (event) => {
    if (!canTransition) return;
    event.preventDefault();
    closeBox();
  });
  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") show(current - 1);
    if (event.key === "ArrowRight") show(current + 1);
  });
  let swipeStart = null;
  lightbox.addEventListener("pointerdown", (event) => { swipeStart = event.clientX; });
  lightbox.addEventListener("pointerup", (event) => {
    if (swipeStart === null) return;
    const delta = event.clientX - swipeStart;
    swipeStart = null;
    if (Math.abs(delta) > 60) show(current + (delta < 0 ? 1 : -1));
  });
}

/* copy email */
$$("[data-copy]").forEach((button) => {
  const label = $(".copy-label", button);
  const original = label.textContent;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      label.textContent = button.dataset.done;
      setTimeout(() => { label.textContent = original; }, 1800);
    } catch {
      label.textContent = button.dataset.copy;
    }
  });
});
