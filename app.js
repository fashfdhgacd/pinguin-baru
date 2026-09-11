(function () {
  var ALL = [];
  var CATS = ["JAV","Amatir","Jilbab","STW","Viral","Colmek","Tobrut","Live","Series","Film","Lulu","Streamtape","Umum"];
  var FEEDS = [
    "https://cdn.jsdelivr.net/gh/fashfdhgacd/koleksi-dr-pinguin@main/data/videos.json",
    "https://cdn.jsdelivr.net/gh/fashfdhgacd/koleksi-dr-pinguin@main/data/putarin.json",
    "https://cdn.jsdelivr.net/gh/fashfdhgacd/koleksi-dr-pinguin@main/data/campur.json"
  ];
  function esc(s){ return String(s||"").replace(/[&<>"]/g, function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[c]; }); }
  function embedOf(v){ return String((v && (v.embed || v.direct || v.e)) || "").replace("/d/", "/e/"); }
  function idOf(v){
    var u = embedOf(v);
    var m = u.match(/[?&]id=([A-Za-z0-9_-]+)/) || u.match(/\/(?:e|v|d)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : "";
  }
  function titleOf(v){
    return String((v && v.title) || "Video").replace(/\(Koleksi[^)]*Pinguin[^)]*\)/ig,"").replace(/koleksidrpinguin\.com/ig,"").replace(/_/g," ").replace(/\s+/g," ").trim();
  }
  function catOf(v){
    var raw = embedOf(v), t = titleOf(v), c = String((v && (v.category || v.folder)) || "").trim();
    if (c && !/^(putarin|campur|mix|pilihan|lainnya)$/i.test(c)) return c;
    if (/lulu/i.test(raw)) return "Lulu";
    if (/streamtape|strcloud/i.test(raw)) return "Streamtape";
    if (/putarin|puterin|\bjav\b|[a-z]{2,6}-\d{3}/i.test(raw+" "+t)) return "JAV";
    return c || "Umum";
  }
  function hostOf(v){
    var raw = embedOf(v);
    if (/indoav/i.test(raw)) return "indoav";
    if (/userbokep/i.test(raw)) return "userbokep";
    if (/lulu/i.test(raw)) return "lulu";
    if (/streamtape|strcloud/i.test(raw)) return "streamtape";
    return "x";
  }
  function posterOf(v){
    return "/api/thumb?h=" + encodeURIComponent(hostOf(v)) + "&id=" + encodeURIComponent(idOf(v));
  }
  function route(){
    var h = location.hash || "#/";
    var w = h.match(/^#\/v\/([^/?]+)/);
    if (w) return { name:"watch", id: decodeURIComponent(w[1]) };
    var q="", cat="all", page=1;
    (h.split("?")[1]||"").split("&").forEach(function(p){
      var kv=p.split("=");
      if(kv[0]==="q") q=decodeURIComponent(kv[1]||"");
      if(kv[0]==="cat") cat=decodeURIComponent(kv[1]||"all");
      if(kv[0]==="page") page=parseInt(kv[1]||"1",10)||1;
    });
    return { name:"home", q:q, cat:cat, page:page };
  }
  function href(q,cat,page){
    var p=[];
    if(cat && cat!=="all") p.push("cat="+encodeURIComponent(cat));
    if(q) p.push("q="+encodeURIComponent(q));
    if(page>1) p.push("page="+page);
    return "#/" + (p.length?"?"+p.join("&"):"");
  }
  function card(v){
    return '<a class="card" href="#/v/'+encodeURIComponent(idOf(v))+'"><div class="ph"><img src="'+esc(posterOf(v))+'" alt="" loading="lazy"><span class="tag">'+esc(catOf(v))+'</span><span class="play"><i>▶</i></span></div><h3>'+esc(titleOf(v))+'</h3></a>';
  }
  function filtered(cat,q){
    return ALL.filter(function(v){
      if(cat && cat!=="all" && catOf(v).toLowerCase().replace(/\s+/g,"-")!==String(cat).toLowerCase()) return false;
      if(q && (titleOf(v)+" "+catOf(v)).toLowerCase().indexOf(String(q).toLowerCase())<0) return false;
      return true;
    });
  }
  function home(r){
    var list=filtered(r.cat,r.q), per=24, pages=Math.max(1,Math.ceil(list.length/per));
    var p=Math.min(r.page,pages), slice=list.slice((p-1)*per,p*per), hero=list[0]||ALL[0];
    var html="";
    if(hero && !r.q && r.cat==="all" && p===1){
      html += '<section class="hero"><a class="hero-art" href="#/v/'+encodeURIComponent(idOf(hero))+'"><img src="'+esc(posterOf(hero))+'" alt=""></a><div class="hero-side"><div class="kicker">Now playing</div><h1>'+esc(titleOf(hero))+'</h1><p>'+esc(catOf(hero))+' · '+ALL.length+' video</p><a class="btn" href="#/v/'+encodeURIComponent(idOf(hero))+'">Putar</a></div></section>';
    }
    html += '<div class="pills"><a class="pill'+(r.cat==="all"?" on":"")+'" href="#/">Semua</a>';
    CATS.forEach(function(c){ var s=c.toLowerCase().replace(/\s+/g,"-"); html += '<a class="pill'+(r.cat===s?" on":"")+'" href="'+href(r.q,s,1)+'">'+esc(c)+"</a>"; });
    html += '</div><p class="count">'+list.length+' video</p><div class="grid">'+slice.map(card).join("")+"</div>";
    var pg='<div class="pager">';
    if(p>1) pg += '<a href="'+href(r.q,r.cat,p-1)+'">Prev</a>';
    for(var i=Math.max(1,p-2);i<=Math.min(pages,p+2);i++) pg += i===p?"<b>"+i+"</b>":'<a href="'+href(r.q,r.cat,i)+'">'+i+"</a>";
    if(p<pages) pg += '<a href="'+href(r.q,r.cat,p+1)+'">Next</a>';
    return html+pg+"</div>";
  }
  function watch(id){
    var v=ALL.find(function(x){return idOf(x)===id;})||ALL[0];
    if(!v) return "<p>Tidak ada.</p>";
    var rel=filtered(catOf(v).toLowerCase().replace(/\s+/g,"-"),"").filter(function(x){return idOf(x)!==id;}).slice(0,10);
    if(rel.length<6) rel=ALL.filter(function(x){return idOf(x)!==id;}).slice(2,12);
    return '<div class="watch"><div><div class="player"><iframe src="'+esc(embedOf(v))+'" allow="autoplay;encrypted-media;fullscreen" allowfullscreen></iframe></div><h1>'+esc(titleOf(v))+'</h1><p class="count">'+esc(catOf(v))+' · 18+</p></div><aside class="rel"><div class="kicker">Berikutnya</div>'+rel.map(function(x){return '<a href="#/v/'+encodeURIComponent(idOf(x))+'"><div class="ph"><img src="'+esc(posterOf(x))+'" alt="" loading="lazy"></div><h3>'+esc(titleOf(x))+'</h3></a>';}).join("")+"</aside></div>";
  }
  function render(){
    var r=route();
    document.getElementById("app").innerHTML = r.name==="watch"?watch(r.id):home(r);
    if(r.q) document.getElementById("q").value=r.q;
  }
  document.getElementById("sf").addEventListener("submit", function(e){ e.preventDefault(); location.hash=href(document.getElementById("q").value.trim(),"all",1); });
  window.addEventListener("hashchange", render);
  document.getElementById("enter").onclick=function(){ try{localStorage.setItem("kdp_ok","1");}catch(_){ } document.getElementById("gate").classList.add("ok"); };
  document.getElementById("leave").onclick=function(){ location.href="https://google.com"; };
  try{ if(localStorage.getItem("kdp_ok")) document.getElementById("gate").classList.add("ok"); }catch(_){}
  Promise.all(FEEDS.map(function(u){ return fetch(u).then(function(r){ return r.ok?r.json():[]; }).catch(function(){ return []; }); }))
    .then(function(pack){
      var seen={};
      ALL=[].concat(pack[0]||[],pack[1]||[],pack[2]||[]).filter(function(v){
        var id=idOf(v); if(!id||/videy/i.test(embedOf(v))||seen[id]) return false; seen[id]=1; return true;
      });
      render();
    });
})();
