// 3D-weergave (three.js) van dag 2 t/m 10 — wordt pas geladen als iemand op "3D-weergave" klikt.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/OrbitControls.js';
import {CSS2DRenderer,CSS2DObject} from 'three/addons/CSS2DRenderer.js';

const META={z:10,x0:538,y0:357,w:2560,h:2048}, S=10;
const M_PER_UNIT=(156543.03/2**META.z)*Math.cos(46.6*Math.PI/180)*S; // ±1050 m per eenheid
const VEX=3; // hoogte-overdrijving
const COLORS=["#64748b","#2563eb","#0891b2","#dc2626","#9333ea","#16a34a","#ea580c","#db2777","#ca8a04","#0d9488","#475569"];
const P=window.PLACES,PS=window.PASSES,RG=window.ROUTEGEO||{};
const DAYS=window.DAYS.filter(d=>d.n>=2&&d.n<=10);
const xy=(lat,lng)=>{const n=2**META.z;const px=((lng+180)/360*n-META.x0)*256;const r=lat*Math.PI/180;const py=((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n-META.y0)*256;return [(px-META.w/2)/S,(py-META.h/2)/S]};
const inside=(x,z)=>Math.abs(x)<META.w/2/S-1&&Math.abs(z)<META.h/2/S-1;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

const css=`
#v3d{position:fixed;inset:0;z-index:10000;background:#0b1217;display:none;font-family:Inter,system-ui,sans-serif;color:#0f172a}
#v3d.on{display:block}
#v3d .scene{position:absolute;inset:0}
#v3d .hud{position:absolute;z-index:5}
#v3d .top{top:12px;left:12px;right:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;pointer-events:none}
#v3d .top>*{pointer-events:auto}
#v3d .close{border:0;border-radius:10px;padding:9px 13px;font:600 13px Inter,sans-serif;cursor:pointer;background:#fff;color:#0f172a;display:flex;gap:6px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.3)}
#v3d .days{display:flex;gap:4px;flex-wrap:wrap;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);padding:5px;border-radius:12px}
#v3d .days button{border:0;background:transparent;border-radius:8px;padding:6px 9px;font:600 12.5px Inter,sans-serif;cursor:pointer;color:#0f172a;display:flex;gap:6px;align-items:center}
#v3d .days button i{width:9px;height:9px;border-radius:50%}
#v3d .days button:hover{background:#f1f5f9}
#v3d .days button.on{background:#0f172a;color:#fff}
#v3d .card{left:12px;bottom:12px;width:min(360px,calc(100vw - 24px));background:rgba(255,255,255,.95);backdrop-filter:blur(10px);border-radius:16px;padding:15px 17px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
#v3d .k{font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:#64748b;font-weight:700}
#v3d h2{font-family:Oswald,Inter,sans-serif;font-weight:600;font-size:23px;margin:4px 0 10px;line-height:1.1;text-transform:uppercase}
#v3d .m{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}
#v3d .m div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:6px 8px}
#v3d .m b{display:block;font-family:Oswald,Inter,sans-serif;font-size:17px;font-weight:500}
#v3d .m span{font-size:10.5px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
#v3d p{font-size:13px;line-height:1.5;margin:0 0 10px;color:#334155}
#v3d .acts{display:flex;gap:8px;flex-wrap:wrap}
#v3d .b{border:0;border-radius:9px;padding:9px 12px;font:600 13px Inter,sans-serif;cursor:pointer;background:#c2410c;color:#fff}
#v3d .b.g{background:#e2e8f0;color:#0f172a}
#v3d .tip{position:absolute;pointer-events:none;background:#0f172a;color:#fff;font-size:12px;padding:6px 9px;border-radius:7px;display:none;z-index:6;white-space:nowrap}
#v3d .v3note{right:12px;bottom:12px;max-width:290px;background:rgba(15,23,42,.75);color:#cbd5e1;font-size:11px;line-height:1.45;padding:8px 10px;border-radius:10px}
#v3d .v3note a{color:#e2e8f0}
#v3d .lbl{font:600 11px Inter,sans-serif;color:#0f172a;background:rgba(255,255,255,.93);padding:2px 6px;border-radius:5px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:translateY(-14px)}
#v3d .lbl small{color:#64748b;font-weight:500}
#v3d .lbl.base{background:#c2410c;color:#fff}
#v3d .help{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:13px;background:rgba(0,0,0,.55);padding:8px 14px;border-radius:20px;transition:opacity 1s;z-index:4;pointer-events:none;text-align:center}
#v3d .err{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#e2e8f0;padding:30px;text-align:center;font-size:15px}
@media (max-width:700px){#v3d .v3note{display:none}#v3d h2{font-size:19px}#v3d .card p{display:none}}
`;

let root,renderer,labels,scene,camera,controls,dayObjs={},pillars=[],passLabels={},current=null,flyS=null,camAnim=null,last=0,onClose=null;

function build(){
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  root=document.createElement('div');root.id='v3d';root.setAttribute('role','dialog');root.setAttribute('aria-label','3D-weergave');
  root.innerHTML=`<div class="scene"></div>
    <div class="hud top"><button class="close" title="Terug naar de kaart (Esc)">✕ Terug naar kaart</button><div class="days"></div></div>
    <div class="hud card"></div>
    <div class="hud v3note">3D-weergave. Ondergrond: Sentinel-2 cloudless (<a href="https://s2maps.eu">s2maps.eu</a>, EOX; bevat gewijzigde Copernicus Sentinel-data 2020). De ondergrond is vlak; de zuilen tonen de echte pashoogte (×3 overdreven). Routes indicatief (OSRM). Dag 1 en 11 vallen buiten dit gebied.</div>
    <div class="tip"></div><div class="help">Slepen = draaien · scrollen/knijpen = zoomen<br>rechts slepen of twee vingers = schuiven</div>`;
  document.body.appendChild(root);
  root.querySelector('.close').onclick=close;
  addEventListener('keydown',e=>{if(e.key==='Escape'&&root.classList.contains('on'))close()});
  const el=root.querySelector('.scene');

  try{renderer=new THREE.WebGLRenderer({antialias:true})}catch(e){el.innerHTML='<div class="err">Je browser of apparaat ondersteunt geen 3D (WebGL). De gewone kaart werkt wel gewoon.</div>';return false}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;el.appendChild(renderer.domElement);
  labels=new CSS2DRenderer();Object.assign(labels.domElement.style,{position:'absolute',top:'0',pointerEvents:'none'});el.appendChild(labels.domElement);

  scene=new THREE.Scene();scene.background=new THREE.Color('#0b1217');scene.fog=new THREE.Fog('#0b1217',260,520);
  camera=new THREE.PerspectiveCamera(42,1,0.5,2000);camera.position.set(0,190,200);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.47;controls.minDistance=12;controls.maxDistance=420;
  scene.add(new THREE.HemisphereLight('#ffffff','#334155',1.6));
  const sun=new THREE.DirectionalLight('#fff4e0',2.2);sun.position.set(-80,160,60);scene.add(sun);

  const tex=new THREE.TextureLoader().load(window.SAT3D_URL||'sat3d.jpg');tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(META.w/S,META.h/S),new THREE.MeshStandardMaterial({map:tex,roughness:1}));ground.rotation.x=-Math.PI/2;scene.add(ground);
  const edge=new THREE.Mesh(new THREE.BoxGeometry(META.w/S,2,META.h/S),new THREE.MeshStandardMaterial({color:'#1e293b'}));edge.position.y=-1.02;scene.add(edge);

  DAYS.forEach(d=>{
    const g=new THREE.Group(),col=new THREE.Color(COLORS[d.n-1]);
    const mk=(pts,dashed)=>{
      const v=pts.map(([la,ln])=>{const [x,z]=xy(la,ln);return new THREE.Vector3(x,.35,z)}).filter(p=>inside(p.x,p.z));
      if(v.length<2)return;
      const path=new THREE.CurvePath();for(let i=1;i<v.length;i++)path.add(new THREE.LineCurve3(v[i-1],v[i]));
      const mat=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.35,transparent:true});
      g.add(new THREE.Mesh(new THREE.TubeGeometry(path,Math.min(v.length*2,4000),dashed?.16:.28,6,false),mat));
      if(!dashed)g.userData.pts=v;
    };
    mk(RG[d.geo]||d.route.map(k=>P[k]),false);
    if(d.altgeo&&RG[d.altgeo])mk(RG[d.altgeo],true);
    scene.add(g);dayObjs[d.n]=g;
  });

  Object.entries(PS).forEach(([k,alt])=>{
    const [x,z]=xy(P[k][0],P[k][1]);if(!inside(x,z))return;
    const h=alt/M_PER_UNIT*VEX;
    const m=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,h,12),new THREE.MeshStandardMaterial({color:'#f8fafc',emissive:'#ffffff',emissiveIntensity:.15,transparent:true}));
    m.position.set(x,h/2,z);m.userData={k,alt,name:P[k][2]};scene.add(m);pillars.push(m);
    const cap=new THREE.Mesh(new THREE.SphereGeometry(.75,16,12),new THREE.MeshStandardMaterial({color:'#ea580c'}));cap.position.set(x,h,z);m.userData.cap=cap;scene.add(cap);
    const div=document.createElement('div');div.className='lbl';div.innerHTML=`${P[k][2].replace(/^Passo (di )?/,'').replace(/ \/.*$/,'')} <small>${alt} m</small>`;
    const lab=new CSS2DObject(div);lab.position.set(x,h+1,z);lab.visible=false;scene.add(lab);passLabels[k]=lab;
  });
  [["nauders","Nauders · nacht 2–5"],["selva","Selva · nacht 6–9"]].forEach(([k,t])=>{
    const [x,z]=xy(P[k][0],P[k][1]);
    const pin=new THREE.Mesh(new THREE.ConeGeometry(1.1,3,20),new THREE.MeshStandardMaterial({color:'#ea580c',emissive:'#7c2d12'}));pin.rotation.x=Math.PI;pin.position.set(x,1.6,z);scene.add(pin);
    const div=document.createElement('div');div.className='lbl base';div.textContent=t;const lab=new CSS2DObject(div);lab.position.set(x,4,z);scene.add(lab);
  });

  const days=root.querySelector('.days');
  const all=document.createElement('button');all.textContent='Alles';all.onclick=()=>select(null);days.appendChild(all);
  DAYS.forEach(d=>{const b=document.createElement('button');b.dataset.n=d.n;b.innerHTML=`<i style="background:${COLORS[d.n-1]}"></i>Dag ${d.n}`;b.onclick=()=>select(d.n);days.appendChild(b)});

  const ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),tip=root.querySelector('.tip');
  renderer.domElement.addEventListener('pointermove',e=>{const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(mouse,camera);
    const hit=ray.intersectObjects(pillars.filter(p=>p.material.opacity>.5))[0];
    if(hit){const u=hit.object.userData;tip.style.display='block';tip.style.left=e.clientX+12+'px';tip.style.top=e.clientY+12+'px';tip.textContent=`${u.name} · ${u.alt} m`;renderer.domElement.style.cursor='pointer'}
    else{tip.style.display='none';renderer.domElement.style.cursor=''}});
  renderer.domElement.addEventListener('pointerdown',()=>{root.querySelector('.help').style.opacity=0;if(flyS){flyS=null;controls.enabled=true}});
  addEventListener('resize',resize);
  return true;
}
function resize(){if(!renderer||!root.classList.contains('on'))return;const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);labels.setSize(w,h)}
const fmt=h=>{const m=Math.round(h*2)/2;return m%1?Math.floor(m)+',5':String(m)};
const rit=d=>d.rit.length>1?`${fmt(d.rit[0])}–${fmt(d.rit[1])} u`:`±${fmt(d.rit[0])} u`;
function frame(n,instant){
  const b=new THREE.Box3();(n?[dayObjs[n]]:Object.values(dayObjs)).forEach(g=>b.expandByObject(g));
  const c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3()),dist=(Math.max(s.x,s.z)*(n?1.25:.95)+20)*Math.max(1,.85/camera.aspect);
  scene.fog.near=Math.max(260,dist*1.4);scene.fog.far=Math.max(520,dist*3);
  const toT=c.setY(0),toP=new THREE.Vector3(c.x+dist*.15,dist*.85,c.z+dist*.75);
  if(instant||reduce){camera.position.copy(toP);controls.target.copy(toT);camAnim=null}
  else camAnim={t:0,fromP:camera.position.clone(),fromT:controls.target.clone(),toT,toP};
}
function select(n,instant){
  current=n;flyS=null;controls.enabled=true;
  [...root.querySelectorAll('.days button')].forEach(b=>b.classList.toggle('on',n?b.dataset.n==n:!b.dataset.n));
  Object.entries(dayObjs).forEach(([k,g])=>g.traverse(o=>{if(o.material){o.material.opacity=!n||+k===n?1:.18;o.material.depthWrite=!n||+k===n}}));
  const d=n&&DAYS.find(x=>x.n===n);
  pillars.forEach(p=>{const on=!n||d.passes.includes(p.userData.k)||d.route.includes(p.userData.k);p.material.opacity=on?1:.15;p.userData.cap.visible=on;passLabels[p.userData.k].visible=!!n&&on});
  frame(n,instant);
  const card=root.querySelector('.card');
  card.innerHTML=n?`<div class="k" style="color:${COLORS[n-1]}">Dag ${n} van 11 · ${d.type}</div><h2>${d.title}</h2>
    <div class="m"><div><b>${d.km}</b><span>km</span></div><div><b>${rit(d)}</b><span>rijtijd</span></div><div><b>${d.passes.length?Math.max(...d.passes.map(k=>PS[k])).toLocaleString('nl-NL'):'–'}</b><span>hoogste m</span></div></div>
    <p>${d.text}</p><div class="acts"><button class="b" data-a="fly">▶ Vlieg de route</button><button class="b g" data-a="all">Alle dagen</button></div>`
   :`<div class="k">3D-overzicht</div><h2>Dag 2 t/m 10 in 3D</h2><p>Gekleurde lijnen zijn de dagroutes, witte zuilen de passen (echte pashoogte, ×3 overdreven). Kies een dag om in te zoomen of laat de camera een route vliegen.</p><div class="acts"><button class="b" data-a="d4">Bekijk dag 4: Stelvio</button></div>`;
  card.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const a=b.dataset.a;if(a==='fly')fly(n);else if(a==='all')select(null);else select(4)});
}
function fly(n){const pts=dayObjs[n].userData.pts;if(!pts)return;const curve=new THREE.CatmullRomCurve3(pts.filter((_,i)=>i%3===0));flyS={curve,t:0,len:curve.getLength()};camAnim=null;controls.enabled=false}
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function loop(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(camAnim){camAnim.t=Math.min(1,camAnim.t+dt/1.6);const e=ease(camAnim.t);camera.position.lerpVectors(camAnim.fromP,camAnim.toP,e);controls.target.lerpVectors(camAnim.fromT,camAnim.toT,e);if(camAnim.t>=1)camAnim=null}
  if(flyS){flyS.t+=dt*34/flyS.len;if(flyS.t>=1){flyS=null;controls.enabled=true;frame(current)}else{
    const p=flyS.curve.getPointAt(flyS.t),a=flyS.curve.getPointAt(Math.min(1,flyS.t+.02)),dir=a.clone().sub(p).setY(0).normalize();
    camera.position.lerp(p.clone().addScaledVector(dir,-34).setY(24),.06);controls.target.lerp(a.clone().setY(1),.12)}}
  controls.update();renderer.render(scene,camera);labels.render(scene,camera);
}

export function open3D(n,closeCb){
  onClose=closeCb||null;
  if(!root)build();
  if(!renderer){root.classList.add('on');return}
  root.classList.add('on');document.body.style.overflow='hidden';resize();
  select(n>=2&&n<=10?n:null,true);last=performance.now();renderer&&renderer.setAnimationLoop(loop);
  root.querySelector('.close').focus();
  const help=root.querySelector('.help');help.style.opacity=1;setTimeout(()=>help.style.opacity=0,4500);
}
function close(){
  root.classList.remove('on');document.body.style.overflow='';renderer&&renderer.setAnimationLoop(null);
  if(onClose)onClose(current);
}
