(function () {
  var listEl = document.getElementById("blog-list");
  var countEl = document.getElementById("blog-count");
  var articleEl = document.getElementById("blog-article");
  var metaEl = document.getElementById("blog-reader-meta");
  var converter = new showdown.Converter({
    tables: true,
    strikethrough: true,
    simplifiedAutoLink: true,
    openLinksInNewWindow: true
  });
  var posts = [];
  var selectedPath = null;

  function esc(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  }

  function encodePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  function protectMath(markdown) {
    var chunks = [];
    var text = markdown.replace(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+?\$/g, function (match) {
      var token = "MATHZZ" + chunks.length + "ZZ";
      chunks.push(match);
      return token;
    });
    return {
      text: text,
      restore: function (html) {
        return html.replace(/MATHZZ(\d+)ZZ/g, function (_, index) {
          return chunks[Number(index)] || _;
        });
      }
    };
  }

  function markdownToHtml(markdown) {
    var protectedMath = protectMath(markdown);
    return protectedMath.restore(converter.makeHtml(protectedMath.text));
  }

  function extractFootnotes(markdown) {
    var defs = [];
    var body = [];
    markdown.split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^\[\^([^\]]+)\]:\s*(.*)$/);
      if (m) defs.push({ id: m[1], text: m[2] });
      else body.push(line);
    });
    var html = markdownToHtml(body.join("\n"));
    if (!defs.length) return html;

    var order = {};
    defs.forEach(function (item, index) { order[item.id] = index + 1; });
    html = html.replace(/\[\^([^\]]+)\]/g, function (_, id) {
      if (!order[id]) return _;
      return '<sup class="blog-footnote-ref"><a href="#fn-' + esc(id) + '" id="fnref-' + esc(id) + '">' + order[id] + "</a></sup>";
    });

    var foot = '<section class="blog-footnotes"><hr><ol>';
    defs.forEach(function (item) {
      var rendered = markdownToHtml(item.text);
      foot += '<li id="fn-' + esc(item.id) + '">' + rendered + ' <a class="blog-footnote-back" href="#fnref-' + esc(item.id) + '" aria-label="Back to reference">↩</a></li>';
    });
    foot += "</ol></section>";
    return html + foot;
  }

  function typesetMath(scope) {
    function run() {
      if (!window.MathJax || typeof window.MathJax.typesetPromise !== "function") return;
      try {
        if (typeof window.MathJax.typesetClear === "function") window.MathJax.typesetClear([scope]);
      } catch (_) {}
      window.MathJax.typesetPromise([scope]).catch(function () {});
    }
    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") run();
    else if (Array.isArray(window.__mathjaxWaiters)) window.__mathjaxWaiters.push(run);
  }

  function renderList() {
    countEl.textContent = String(posts.length);
    if (!posts.length) {
      listEl.innerHTML = '<div class="blogs-empty">No Markdown posts yet.</div>';
      return;
    }
    listEl.innerHTML = posts.map(function (post) {
      var active = post.path === selectedPath ? " active" : "";
      return '<button class="blog-index-item' + active + '" type="button" data-path="' + esc(post.path) + '">' +
        '<span class="blog-index-title">' + esc(post.title) + "</span>" +
        '<span class="blog-index-date">' + esc(formatDate(post.modified)) + "</span>" +
        '<span class="blog-index-excerpt">' + esc(post.excerpt || "") + "</span>" +
      "</button>";
    }).join("");
    listEl.querySelectorAll(".blog-index-item").forEach(function (button) {
      button.addEventListener("click", function () { selectPost(button.dataset.path, true); });
    });
  }

  async function selectPost(path, updateUrl) {
    var post = posts.find(function (item) { return item.path === path; });
    if (!post) return;
    selectedPath = post.path;
    renderList();
    metaEl.textContent = formatDate(post.modified) + " · " + post.path;
    articleEl.innerHTML = '<p class="blogs-loading">Loading…</p>';

    try {
      var response = await fetch("blogs/" + encodePath(post.path), { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var markdown = await response.text();
      var raw = extractFootnotes(markdown);
      var safe = window.DOMPurify ? DOMPurify.sanitize(raw) : raw;
      articleEl.innerHTML = safe;
      typesetMath(articleEl);
      document.title = post.title + " - Blogs - Xu-Jiaqi";
      if (updateUrl) {
        var url = new URL(window.location.href);
        url.searchParams.set("post", post.path);
        history.pushState({ post: post.path }, "", url);
      }
    } catch (error) {
      articleEl.innerHTML = '<p class="blogs-error">Failed to load this Markdown file.</p>';
    }
  }

  window.addEventListener("popstate", function () {
    var requested = new URL(window.location.href).searchParams.get("post");
    if (requested && posts.some(function (p) { return p.path === requested; })) selectPost(requested, false);
  });

  (async function init() {
    try {
      var response = await fetch("data/blogs.json", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var data = await response.json();
      posts = Array.isArray(data.blogs) ? data.blogs : [];
      var requested = new URL(window.location.href).searchParams.get("post");
      selectedPath = requested && posts.some(function (p) { return p.path === requested; })
        ? requested
        : (posts[0] ? posts[0].path : null);
      renderList();
      if (selectedPath) selectPost(selectedPath, false);
      else articleEl.innerHTML = '<p class="blogs-empty">No Markdown posts yet.</p>';
    } catch (error) {
      listEl.innerHTML = '<div class="blogs-error">Failed to load blog index.</div>';
      articleEl.innerHTML = "";
    }
  })();
})();
