(function(){
var pages=['about','projects','contact'],links=document.querySelectorAll('nav a');
function swap(id){
pages.forEach(function(p){document.getElementById(p).classList.toggle('active',p===id)});
links.forEach(function(a){a.classList.toggle('on',a.dataset.p===id)});
document.querySelectorAll('.rv').forEach(function(e){e.classList.remove('in');io.observe(e)});
window.scrollTo(0,0);upd();
}
var leaveT;
function show(){
var id=(location.hash||'').replace('#','');if(pages.indexOf(id)<0)id='about';
var c=document.querySelector('.page.active');
links.forEach(function(a){a.classList.toggle('on',a.dataset.p===id)});
clearTimeout(leaveT);
if(c&&c.id===id){c.classList.remove('leaving');return}
if(!c||matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelectorAll('.page.leaving').forEach(function(p){p.classList.remove('leaving')});swap(id);return}
c.classList.add('leaving');
leaveT=setTimeout(function(){c.classList.remove('leaving');swap(id)},300);
}
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.15,rootMargin:'0px 0px -6% 0px'});
var wEl=document.getElementById('words'),txt=wEl.textContent.trim().split(/\s+/);
wEl.innerHTML=txt.map(function(w){return '<span>'+w+'</span>'}).join(' ');
var ws=wEl.querySelectorAll('span'),hero=document.getElementById('hero'),tick=false;
function upd(){
tick=false;var vh=innerHeight,y=scrollY;
var t=Math.min(y/(vh*.8),1);
hero.style.opacity=1-t;hero.style.transform='scale('+(1-t*.08)+') translateY('+(y*.15)+'px)';
var r=wEl.getBoundingClientRect(),p=(vh*.8-r.top)/(r.height+vh*.2);p=Math.max(0,Math.min(1,p));
var n=Math.round(p*ws.length);
for(var i=0;i<ws.length;i++)ws[i].classList.toggle('on',i<n);
}
addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(upd)}},{passive:true});
addEventListener('hashchange',show);
var root=document.documentElement,tb=document.getElementById('theme');
function cur(){var t=root.getAttribute('data-theme');if(t)return t;return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
function paint(){tb.textContent=cur()==='dark'?'☀︎':'☾'}
try{var st=localStorage.getItem('theme');if(st==='light'||st==='dark')root.setAttribute('data-theme',st)}catch(e){}
tb.addEventListener('click',function(){var n=cur()==='dark'?'light':'dark';root.classList.add('theming');root.setAttribute('data-theme',n);clearTimeout(window.__tt);window.__tt=setTimeout(function(){root.classList.remove('theming')},700);try{localStorage.setItem('theme',n)}catch(e){}paint()});
paint();
var vio=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;if(e.isIntersecting){var p=v.play();if(p&&p.catch)p.catch(function(){})}else v.pause()})},{threshold:.5});
document.querySelectorAll('video[data-auto]').forEach(function(v){vio.observe(v)});
addEventListener('resize',upd);
show();
})();
