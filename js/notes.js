(function () {
  var listEl = document.getElementById("note-list");
  var countEl = document.getElementById("note-count");
  var articleEl = document.getElementById("note-article");
  var metaEl = document.getElementById("note-reader-meta");
  var converter = new showdown.Converter({ tables: true, strikethrough: true, simplifiedAutoLink: true, openLinksInNewWindow: true });
  var notes = [];
  var selectedPath = null;

  function esc(value) { var d=document.createElement("div"); d.textContent=value==null?"":String(value); return d.innerHTML; }
  function formatDate(iso) { var d=new Date(iso); return Number.isNaN(d.getTime())?"":d.toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric"}); }

  function excerpt(content) {
    var text = String(content||"")
      .replace(/```[\s\S]*?```/g," ")
      .replace(/\$\$[\s\S]*?\$\$/g," ")
      .replace(/^#+\s+/gm,"")
      .replace(/\[\^[^\]]+\]/g,"")
      .replace(/\[([^\]]+)\]\([^)]*\)/g,"$1")
      .replace(/[*_>`~]/g," ")
      .replace(/\s+/g," ").trim();
    return text.length>180 ? text.slice(0,177).trim()+"…" : text;
  }

  function protectMath(markdown) {
    var chunks=[];
    var text=markdown.replace(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+?\$/g,function(m){var t="MATHZZ"+chunks.length+"ZZ";chunks.push(m);return t;});
    return { text:text, restore:function(html){return html.replace(/MATHZZ(\d+)ZZ/g,function(_,i){return chunks[Number(i)]||_;});} };
  }

  function markdownToHtml(markdown) { var m=protectMath(markdown); return m.restore(converter.makeHtml(m.text)); }

  function renderMarkdown(markdown) {
    var defs=[], body=[];
    markdown.split(/\r?\n/).forEach(function(line){var m=line.match(/^\[\^([^\]]+)\]:\s*(.*)$/); if(m) defs.push({id:m[1],text:m[2]}); else body.push(line);});
    var html=markdownToHtml(body.join("\n"));
    if(!defs.length) return html;
    var order={}; defs.forEach(function(x,i){order[x.id]=i+1;});
    html=html.replace(/\[\^([^\]]+)\]/g,function(all,id){if(!order[id])return all;return '<sup class="blog-footnote-ref"><a href="#fn-'+esc(id)+'" id="fnref-'+esc(id)+'">'+order[id]+'</a></sup>';});
    var foot='<section class="blog-footnotes"><hr><ol>';
    defs.forEach(function(x){foot+='<li id="fn-'+esc(x.id)+'">'+markdownToHtml(x.text)+' <a class="blog-footnote-back" href="#fnref-'+esc(x.id)+'">↩</a></li>';});
    return html+foot+"</ol></section>";
  }

  function typesetMath(scope) {
    function run(){ if(!window.MathJax||typeof window.MathJax.typesetPromise!=="function")return; try{if(typeof window.MathJax.typesetClear==="function")window.MathJax.typesetClear([scope]);}catch(_){} window.MathJax.typesetPromise([scope]).catch(function(){}); }
    if(window.MathJax&&typeof window.MathJax.typesetPromise==="function")run(); else if(Array.isArray(window.__mathjaxWaiters))window.__mathjaxWaiters.push(run);
  }

  function renderList() {
    countEl.textContent=String(notes.length);
    if(!notes.length){listEl.innerHTML='<div class="blogs-empty">No notes yet.</div>'; return;}
    listEl.innerHTML=notes.map(function(note){var active=note.path===selectedPath?" active":""; return '<button class="blog-index-item'+active+'" type="button" data-path="'+esc(note.path)+'"><span class="blog-index-title">'+esc(note.title)+'</span><span class="blog-index-date">'+esc(formatDate(note.time))+'</span><span class="blog-index-excerpt">'+esc(excerpt(note.content))+'</span></button>';}).join("");
    listEl.querySelectorAll(".blog-index-item").forEach(function(b){b.addEventListener("click",function(){selectNote(b.dataset.path,true);});});
  }

  function selectNote(path, updateUrl) {
    var note=notes.find(function(x){return x.path===path;}); if(!note)return;
    selectedPath=path; renderList(); metaEl.textContent=formatDate(note.time)+" · "+note.path;
    var raw=renderMarkdown(note.content||""); articleEl.innerHTML=window.DOMPurify?DOMPurify.sanitize(raw):raw; typesetMath(articleEl);
    document.title=(note.title||"Note")+" - Notes - Xu-Jiaqi";
    if(updateUrl){var url=new URL(window.location.href);url.searchParams.set("note",note.path);history.pushState({note:note.path},"",url);}
  }

  window.addEventListener("popstate",function(){var p=new URL(window.location.href).searchParams.get("note"); if(p&&notes.some(function(x){return x.path===p;}))selectNote(p,false);});

  (async function(){
    try {
      var response=await fetch("data/notes.json",{cache:"no-store"}); if(!response.ok)throw new Error("HTTP "+response.status);
      var data=await response.json(); notes=Array.isArray(data.notes)?data.notes:[];
      var requested=new URL(window.location.href).searchParams.get("note"); selectedPath=requested&&notes.some(function(x){return x.path===requested;})?requested:(notes[0]?notes[0].path:null);
      renderList(); if(selectedPath)selectNote(selectedPath,false); else articleEl.innerHTML='<p class="blogs-empty">No notes yet.</p>';
    } catch(error) { listEl.innerHTML='<div class="blogs-error">Failed to load notes.</div>'; articleEl.innerHTML=""; }
  })();
})();
