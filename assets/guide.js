// Pima Ballot Guide: renders every section from /data/gub.json. All text goes in through textContent.
(function () {
  "use strict";
  var ANS_KEY = "bb-answers-v1";
  var data = null, byId = {};

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function link(href, text) { var a = el("a", null, text); a.href = href; if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; } return a; }
  function list(items, cls) { var ul = el("ul", cls); (items || []).forEach(function (t) { ul.appendChild(el("li", null, t)); }); return ul; }
  function loadAns() { try { return JSON.parse(localStorage.getItem(ANS_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function saveAns(a) { try { localStorage.setItem(ANS_KEY, JSON.stringify(a)); } catch (e) { /* storage unavailable */ } }

  function sourceLine(ids) {
    var p = el("p", "src");
    p.appendChild(document.createTextNode("Sources: "));
    (ids || []).forEach(function (id, i) {
      var s = data.sources[id]; if (!s) return;
      if (i) p.appendChild(document.createTextNode("; "));
      if (s.url) p.appendChild(link(s.url, s.title)); else p.appendChild(document.createTextNode(s.title));
    });
    return p;
  }

  // ---------- races ----------
  function candCard(c) {
    var d = el("details", "cand"); d.id = "entry-" + c.id;
    var s = el("summary");
    var top = el("div", "cand-top");
    top.appendChild(el("span", "cand-name", c.title));
    top.appendChild(el("span", "party", c.party));
    s.appendChild(top);
    s.appendChild(el("span", "cand-sum", c.summary));
    s.appendChild(el("span", "more", "Record, both sides, sources"));
    d.appendChild(s);
    var b = el("div", "cand-body");
    b.appendChild(el("p", null, c.body));
    if (c.details && c.details["Running mate"]) b.appendChild(el("p", null, "Running mate: " + c.details["Running mate"]));
    if (c.record && c.record.length) { b.appendChild(el("h4", null, "What they've done")); b.appendChild(list(c.record)); }
    if ((c.supporters_point_to || []).length || (c.critics_point_to || []).length) {
      var two = el("div", "two");
      var pro = el("div", "pro"); pro.appendChild(el("h4", null, "Supporters point to")); pro.appendChild(list(c.supporters_point_to.length ? c.supporters_point_to : ["Nothing documented."]));
      var con = el("div", "con"); con.appendChild(el("h4", null, "Critics point to")); con.appendChild(list(c.critics_point_to.length ? c.critics_point_to : ["Nothing documented."]));
      two.appendChild(pro); two.appendChild(con); b.appendChild(two);
    }
    b.appendChild(sourceLine(c.sources));
    d.appendChild(b);
    return d;
  }

  function renderRaces() {
    var host = document.getElementById("race-list"); host.textContent = "";
    data.races.forEach(function (r) {
      var sec = el("article", "race" + (r.candidates.length >= 4 ? " wide" : ""));
      var head = el("div", "race-head");
      head.appendChild(el("h3", null, r.title.replace(/ \(vote for 2\)/, "")));
      head.appendChild(el("span", "rule", r.rule));
      sec.appendChild(head);
      var grid = el("div", "cands");
      r.candidates.forEach(function (id) { if (byId[id]) grid.appendChild(candCard(byId[id])); });
      sec.appendChild(grid);
      host.appendChild(sec);
    });
  }

  // ---------- compare ----------
  function stanceOf(c, sid) { var s = c.stances && c.stances[sid]; return s ? s[0] : 0; }

  function renderCompare() {
    var sel = document.getElementById("race-select");
    var races = data.races.filter(function (r) {
      return r.candidates.filter(function (id) { return byId[id] && Object.keys(byId[id].stances || {}).length; }).length >= 2;
    });
    sel.textContent = "";
    races.forEach(function (r, i) { var o = el("option", null, r.title.replace(/ \(vote for 2\)/, "")); o.value = String(i); sel.appendChild(o); });
    var gov = races.findIndex(function (r) { return r.title === "Governor"; });
    sel.value = String(gov >= 0 ? gov : 0);
    function draw() { buildQuiz(races[Number(sel.value)]); }
    sel.addEventListener("change", draw);
    draw();
  }

  function buildQuiz(race) {
    var quiz = document.getElementById("quiz"); quiz.textContent = "";
    var cands = race.candidates.map(function (id) { return byId[id]; }).filter(Boolean);
    var answers = loadAns();
    var usable = [];
    data.categories.forEach(function (cat) {
      var stmts = cat.statements.filter(function (s) { return cands.some(function (c) { return stanceOf(c, s.id) !== 0; }); });
      if (!stmts.length) return;
      usable.push({ cat: cat, stmts: stmts });
      var box = el("div", "qcat");
      box.appendChild(el("h3", null, cat.label));
      box.appendChild(el("p", "why", cat.why));
      stmts.forEach(function (s) {
        var fs = el("fieldset", "stmt");
        fs.appendChild(el("legend", null, s.text));
        var ch = el("div", "choices");
        [["1", "Agree"], ["0", "Not sure"], ["-1", "Disagree"]].forEach(function (opt) {
          var lab = el("label"); var inp = el("input"); inp.type = "radio"; inp.name = s.id; inp.value = opt[0];
          if (String(answers[s.id] == null ? "0" : answers[s.id]) === opt[0]) inp.checked = true;
          lab.appendChild(inp); lab.appendChild(document.createTextNode(opt[1])); ch.appendChild(lab);
        });
        fs.appendChild(ch); box.appendChild(fs);
      });
      quiz.appendChild(box);
    });
    quiz.onchange = function (e) {
      if (e.target && e.target.name) { var a = loadAns(); a[e.target.name] = Number(e.target.value); saveAns(a); score(race, cands, usable); }
    };
    score(race, cands, usable);
  }

  function score(race, cands, usable) {
    var out = document.getElementById("compare-out"); out.textContent = "";
    var answers = loadAns();
    var answered = usable.some(function (u) { return u.stmts.some(function (s) { return answers[s.id] === 1 || answers[s.id] === -1; }); });
    if (!answered) { out.appendChild(el("p", "empty", "Mark Agree or Disagree on at least one statement to see match scores.")); positions(out, cands, usable); return; }
    var table = el("table", "score-table");
    table.appendChild(el("caption", "sr-only", "Match scores by category for " + race.title));
    var thead = el("thead"), hr = el("tr");
    hr.appendChild(el("th", null, "Category"));
    cands.forEach(function (c) { var th = el("th", null, c.title); th.scope = "col"; hr.appendChild(th); });
    thead.appendChild(hr); table.appendChild(thead);
    var tbody = el("tbody");
    var totals = cands.map(function () { return { m: 0, n: 0 }; });
    usable.forEach(function (u) {
      var tr = el("tr"); var th = el("th", null, u.cat.label); th.scope = "row"; tr.appendChild(th);
      cands.forEach(function (c, i) {
        var m = 0, n = 0;
        u.stmts.forEach(function (s) {
          var a = answers[s.id], st = stanceOf(c, s.id);
          if ((a === 1 || a === -1) && st !== 0) { n++; if (a === st) m++; }
        });
        totals[i].m += m; totals[i].n += n;
        tr.appendChild(cell(c.title, m, n));
      });
      tbody.appendChild(tr);
    });
    var tr = el("tr"); var th = el("th", null, "Overall"); th.scope = "row"; tr.appendChild(th);
    cands.forEach(function (c, i) { tr.appendChild(cell(c.title, totals[i].m, totals[i].n)); });
    tbody.appendChild(tr);
    table.appendChild(tbody);
    out.appendChild(table);
    positions(out, cands, usable);
  }

  function cell(label, m, n) {
    var td = el("td"); td.setAttribute("data-label", label);
    var wrap = el("div");
    if (!n) { wrap.appendChild(el("span", "na", "Not enough documented positions")); td.appendChild(wrap); return td; }
    var pct = Math.round((m / n) * 100);
    wrap.appendChild(el("span", "pct", pct + "%"));
    var bar = el("span", "bar"); var fill = el("span"); fill.style.width = pct + "%"; bar.appendChild(fill); wrap.appendChild(bar);
    wrap.appendChild(el("span", "basis", "based on " + n + (n === 1 ? " statement" : " statements")));
    td.appendChild(wrap); return td;
  }

  function positions(out, cands, usable) {
    var box = el("div", "positions");
    box.appendChild(el("h3", null, "Where each candidate stands"));
    var grid = el("div", "pos-grid");
    usable.forEach(function (u) {
      u.stmts.forEach(function (s) {
        var card = el("div", "pos");
        card.appendChild(el("span", "kicker", u.cat.label));
        card.appendChild(el("p", null, s.text));
        var ul = el("ul");
        cands.forEach(function (c) {
          var st = c.stances && c.stances[s.id];
          var li = el("li");
          li.appendChild(el("strong", null, c.title.replace(/ \(with .*\)$/, "") + ":"));
          var v = st ? st[0] : 0;
          li.appendChild(el("span", "tag " + (v === 1 ? "agree" : v === -1 ? "disagree" : "unknown"), v === 1 ? "Agrees" : v === -1 ? "Disagrees" : "No documented position"));
          if (st && st[2]) li.appendChild(el("span", null, st[2]));
          if (st && data.sources[st[1]] && data.sources[st[1]].url) li.appendChild(link(data.sources[st[1]].url, "source"));
          ul.appendChild(li);
        });
        card.appendChild(ul); grid.appendChild(card);
      });
    });
    box.appendChild(grid); out.appendChild(box);
  }

  // ---------- propositions ----------
  function renderProps() {
    var host = document.getElementById("prop-list"); host.textContent = "";
    data.entries.filter(function (e) { return e.type === "proposition"; }).forEach(function (p) {
      var a = el("article", "prop"); a.id = "entry-" + p.id;
      a.appendChild(el("span", "scope", p.scope));
      a.appendChild(el("h3", null, p.title));
      a.appendChild(el("p", "sum", p.summary));
      var yn = el("div", "yn");
      var y = el("div"); y.appendChild(el("strong", null, "A YES vote")); y.appendChild(document.createTextNode(p.yes_means));
      var n = el("div"); n.appendChild(el("strong", null, "A NO vote")); n.appendChild(document.createTextNode(p.no_means));
      yn.appendChild(y); yn.appendChild(n); a.appendChild(yn);
      var two = el("div", "two");
      var pro = el("div", "pro"); pro.appendChild(el("h4", null, "Supporters argue")); pro.appendChild(list(p.arguments_for));
      var con = el("div", "con"); con.appendChild(el("h4", null, "Opponents argue")); con.appendChild(list(p.arguments_against));
      two.appendChild(pro); two.appendChild(con); a.appendChild(two);
      var dl = el("dl");
      [["How it got here", p.how_it_got_here], ["Cost and fiscal notes", p.fiscal]].forEach(function (kv) { dl.appendChild(el("dt", null, kv[0])); dl.appendChild(el("dd", null, kv[1])); });
      a.appendChild(dl);
      a.appendChild(sourceLine(p.sources));
      host.appendChild(a);
    });
    document.getElementById("other-pima").textContent = data.meta.other_pima;
  }

  // ---------- other sections ----------
  function kv(details) {
    var dl = el("dl", "kv");
    Object.keys(details).forEach(function (k) {
      var d = el("div"); d.appendChild(el("dt", null, k));
      var v = details[k], dd = el("dd");
      if (/^https?:\/\//.test(v)) dd.appendChild(link(v, v.replace(/^https?:\/\//, ""))); else dd.textContent = v;
      d.appendChild(dd); dl.appendChild(d);
    });
    return dl;
  }
  function prose(host, e) {
    var d = el("div", "prose");
    d.appendChild(el("p", null, e.summary));
    d.appendChild(el("p", null, e.body));
    host.appendChild(d);
    if (e.details && Object.keys(e.details).length) host.appendChild(kv(e.details));
    host.appendChild(sourceLine(e.sources));
  }
  function renderGuideEntries() {
    var get = function (id) { return data.entries.filter(function (e) { return e.id === id; })[0]; };
    prose(document.getElementById("judges-body"), get("judges"));
    prose(document.getElementById("vote-body"), get("how-to-vote"));
    prose(document.getElementById("method-body"), get("method"));
    var mc = get("mail-check"), host = document.getElementById("mail-body");
    var intro = el("div", "prose"); intro.appendChild(el("p", null, mc.summary + " " + mc.body)); host.appendChild(intro);
    var t = el("table", "fc-table"); t.appendChild(el("caption", "sr-only", "Mailer claims and what we found"));
    var th = el("thead"), hr = el("tr"); ["Claim", "Verdict", "What we found"].forEach(function (h) { hr.appendChild(el("th", null, h)); }); th.appendChild(hr); t.appendChild(th);
    var tb = el("tbody");
    mc.items.forEach(function (it) {
      var tr = el("tr");
      var c1 = el("td"); c1.setAttribute("data-label", "Claim"); c1.appendChild(el("span", null, it.claim));
      var c2 = el("td"); c2.setAttribute("data-label", "Verdict");
      var warn = /misleading|overstated|not verified/i.test(it.verdict);
      c2.appendChild(el("span", "verdict " + (warn ? "warn" : "ok"), it.verdict));
      var c3 = el("td"); c3.setAttribute("data-label", "What we found");
      var c3w = el("span"); c3w.appendChild(document.createTextNode(it.note + " "));
      var s = data.sources[it.source]; if (s && s.url) c3w.appendChild(link(s.url, "Source"));
      c3.appendChild(c3w);
      tr.appendChild(c1); tr.appendChild(c2); tr.appendChild(c3); tb.appendChild(tr);
    });
    t.appendChild(tb); host.appendChild(t);
    var ol = document.getElementById("source-list");
    Object.keys(data.sources).forEach(function (k) {
      var s = data.sources[k], li = el("li");
      if (s.url) li.appendChild(link(s.url, s.title)); else li.textContent = s.title;
      ol.appendChild(li);
    });
    document.getElementById("disclaimer").textContent = data.meta.disclaimer;
  }

  function openHash() {
    var h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    var target = document.getElementById(h);
    if (!target) return;
    if (target.tagName === "DETAILS") target.open = true;
    target.scrollIntoView({ block: "start" });
  }

  fetch("/data/gub.json", { headers: { Accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw new Error("load"); return r.json(); })
    .then(function (json) {
      data = json;
      data.entries.forEach(function (e) { byId[e.id] = e; });
      renderRaces(); renderCompare(); renderProps(); renderGuideEntries();
      openHash();
      window.addEventListener("hashchange", openHash);
    })
    .catch(function () {
      var host = document.getElementById("race-list"); host.textContent = "";
      host.appendChild(el("p", "loading", "The guide data didn't load. Refresh the page to try again."));
    });
})();
