// RT3D site (2026-11-06): the top bar and "more from RT3D" on every designer page, linking the products together.
(() => {
  const PRODUCTS = [
    { id: "bumpers", name: "Bottle Bumperz", nav: "Bottle Bumperz", blurb: "Custom TPU boots for Yeti, Stanley and Owala bottles.", go: "Design your bumper" },
    { id: "bag-tags", name: "TPU bag tags", nav: "Bag tags", blurb: "Flexible name tags for school bags, luggage and sports gear.", go: "Design your tag" },
    { id: "letters", name: "Wall letters", nav: "Wall letters", blurb: "Puffy 3D letters that spell out any name on the wall.", go: "Design your letters" },
  ];
  const here = PRODUCTS.find(p => location.pathname.includes("/" + p.id + "/"));
  const root = here ? "../" : "";
  const nav = document.createElement("nav");
  nav.className = "rt3d-nav"; nav.setAttribute("aria-label", "RT3D products");
  nav.innerHTML = `<a class="logo" href="${root}index.html">RT<span>3D</span></a>` + PRODUCTS.map(p => `<a class="pill${p === here ? " on" : ""}" href="${root}${p.id}/"${p === here ? ' aria-current="page"' : ""}>${p.nav}</a>`).join("");
  document.body.prepend(nav);
  if (!here) return;
  const more = document.createElement("section");
  more.className = "rt3d-more";
  more.innerHTML = `<h2>More you can make yours</h2><p>Same idea, same easy design code. Add them to your order.</p><div class="list">` +
    PRODUCTS.filter(p => p !== here).map(p => `<a href="../${p.id}/"><img src="../img/${p.id}.jpg" alt="" loading="lazy"><span><b>${p.name}</b><small>${p.blurb}</small><em>${p.go} →</em></span></a>`).join("") + `</div>`;
  const main = document.querySelector("main");
  if (main) main.after(more);
})();
