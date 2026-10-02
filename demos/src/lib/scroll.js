export function createScrollState() {
  let y = window.scrollY;
  let vh = window.innerHeight;
  const onScroll = () => {
    y = window.scrollY;
  };
  const onResize = () => {
    y = window.scrollY;
    vh = window.innerHeight;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  return {
    get y() {
      return y;
    },
    get vh() {
      return vh;
    },
    dispose() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    },
  };
}

export function measureTops(elements) {
  const y = window.scrollY;
  return elements.map((el) => el.getBoundingClientRect().top + y);
}
